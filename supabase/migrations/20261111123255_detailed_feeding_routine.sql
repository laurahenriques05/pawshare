begin;
alter table public.feeding_settings add column meal_plan jsonb not null default '[]'::jsonb check(jsonb_typeof(meal_plan)='array'), add column warning_hours numeric check(warning_hours>0 and warning_hours<=24);
create table public.feeding_meal_events (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 routine_meal_id uuid,
 created_at timestamptz not null default now()
);
alter table public.feeding_meal_events enable row level security;
revoke all on public.feeding_meal_events from anon,authenticated;
grant select on public.feeding_meal_events to authenticated;
create policy feeding_events_read on public.feeding_meal_events for select to authenticated using(private.is_member(household_id));
alter table public.feeding_entries add column event_id uuid references public.feeding_meal_events(id);
create index feeding_entries_event_idx on public.feeding_entries(event_id);

create function private.save_feeding_plan(p_household uuid,p_plan jsonb,p_warning numeric) returns void
language plpgsql security definer set search_path='' as $$
declare meal jsonb; item jsonb; min_gap numeric; v_minutes integer[]:='{}'; n integer;
begin
 perform private.feeding_access(p_household);
 if p_plan is null or jsonb_typeof(p_plan)<>'array' or jsonb_array_length(p_plan) not between 1 and 12 then raise exception 'Choose between 1 and 12 meals'; end if;
 for meal in select value from jsonb_array_elements(p_plan) loop
  if coalesce(length(trim(meal->>'name')),0) not between 1 and 80 or coalesce(meal->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(length(meal->>'notes'),0)>500 or meal->>'id' is null then raise exception 'Each meal needs a name, a valid time and short notes'; end if;
  perform (meal->>'id')::uuid;
  v_minutes:=array_append(v_minutes,split_part(meal->>'time',':',1)::integer*60+split_part(meal->>'time',':',2)::integer);
  if meal->'items' is null or jsonb_typeof(meal->'items')<>'array' or jsonb_array_length(meal->'items') not between 1 and 12 then raise exception 'Add at least one food product to each meal'; end if;
  for item in select value from jsonb_array_elements(meal->'items') loop
   if not exists(select 1 from public.food_products where id=(item->>'product_id')::uuid and household_id=p_household) then raise exception 'Choose food from this household'; end if;
   if jsonb_typeof(item->'quantity_grams')<>'number' or (item->>'quantity_grams')::numeric is null or (item->>'quantity_grams')::numeric<=0 or (item->>'quantity_grams')::numeric>1000000 or round((item->>'quantity_grams')::numeric,2)<>(item->>'quantity_grams')::numeric then raise exception 'Enter a positive food quantity with at most two decimal places'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'product_id') from jsonb_array_elements(meal->'items')) then raise exception 'Use each food product once per meal'; end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_plan)) or (select count(*)<>count(distinct value) from unnest(v_minutes) as times(value)) then raise exception 'Each meal needs a different ID and time'; end if;
 select min(case when next_minute is null then 1440+first_minute-slot_minute else next_minute-slot_minute end)/60.0 into min_gap from (select value slot_minute,lead(value) over(order by value) next_minute,min(value) over() first_minute from unnest(v_minutes) value) gaps;
 insert into public.feeding_settings(household_id,meals_per_day,meal_plan,warning_hours) values(p_household,jsonb_array_length(p_plan),p_plan,coalesce(p_warning,min_gap))
 on conflict(household_id) do update set meals_per_day=excluded.meals_per_day,meal_plan=excluded.meal_plan,warning_hours=excluded.warning_hours;
end $$;
revoke all on function private.save_feeding_plan(uuid,jsonb,numeric) from public,anon;
grant execute on function private.save_feeding_plan(uuid,jsonb,numeric) to authenticated;
create function public.save_feeding_plan(p_household uuid,p_plan jsonb,p_warning numeric default null) returns void
language sql security invoker set search_path='' as $$ select private.save_feeding_plan(p_household,p_plan,p_warning); $$;
revoke all on function public.save_feeding_plan(uuid,jsonb,numeric) from public,anon;
grant execute on function public.save_feeding_plan(uuid,jsonb,numeric) to authenticated;

create function private.record_feeding_meal(p_household uuid,p_id uuid,p_items jsonb,p_at timestamptz,p_source text,p_allow_duplicate boolean,p_routine_meal uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare item jsonb; existing public.feeding_meal_events; v_previous timestamptz; gap numeric; v_entry uuid;
begin
 perform private.feeding_access(p_household);
 select * into existing from public.feeding_meal_events where id=p_id;
 if found then
  if existing.household_id<>p_household or existing.created_by<>auth.uid() then raise exception 'Meal access denied' using errcode='42501'; end if;
  return p_id; -- Retries of a creation never duplicate an entire mixed meal.
 end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 12 then raise exception 'Choose at least one food product'; end if;
 if (select count(*)<>count(distinct value->>'product_id') from jsonb_array_elements(p_items)) then raise exception 'Use each product once per feeding'; end if;
 if p_routine_meal is not null and not exists(select 1 from public.feeding_settings s cross join lateral jsonb_array_elements(s.meal_plan) m where s.household_id=p_household and (m->>'id')::uuid=p_routine_meal) then raise exception 'This meal plan changed. Refresh before recording.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i join public.food_products p on p.id=(i->>'product_id')::uuid where p.category<>'treat') and not coalesce(p_allow_duplicate,false) then
  select coalesce(warning_hours,24.0/meals_per_day) into gap from public.feeding_settings where household_id=p_household;
  select max(e.occurred_at) into v_previous from public.feeding_entries e join public.food_products p on p.id=e.product_id where e.household_id=p_household and e.kind='meal' and e.deleted_at is null and p.category<>'treat' and e.occurred_at<=p_at;
  if v_previous is not null and p_at-v_previous<make_interval(secs=>coalesce(gap,12)*3600) then raise exception 'DUPLICATE_MEAL: Another meal was recorded within your routine’s minimum interval.'; end if;
 end if;
 insert into public.feeding_meal_events(id,household_id,created_by,routine_meal_id) values(p_id,p_household,auth.uid(),p_routine_meal);
 for item in select value from jsonb_array_elements(p_items) loop
  if (item->>'quantity_grams')::numeric is null or jsonb_typeof(item->'quantity_grams')<>'number' then raise exception 'Enter a food quantity'; end if;
  v_entry:=private.save_feeding_entry(p_household,gen_random_uuid(),(item->>'product_id')::uuid,'meal',(item->>'quantity_grams')::numeric,p_at,null,null,p_source,true,false);
  update public.feeding_entries set event_id=p_id where id=v_entry;
 end loop;
 return p_id;
end $$;
revoke all on function private.record_feeding_meal(uuid,uuid,jsonb,timestamptz,text,boolean,uuid) from public,anon;
grant execute on function private.record_feeding_meal(uuid,uuid,jsonb,timestamptz,text,boolean,uuid) to authenticated;
create function public.record_feeding_meal(p_household uuid,p_id uuid,p_items jsonb,p_at timestamptz,p_source text default 'app',p_allow_duplicate boolean default false,p_routine_meal uuid default null) returns uuid
language sql security invoker set search_path='' as $$ select private.record_feeding_meal(p_household,p_id,p_items,p_at,p_source,p_allow_duplicate,p_routine_meal); $$;
revoke all on function public.record_feeding_meal(uuid,uuid,jsonb,timestamptz,text,boolean,uuid) from public,anon;
grant execute on function public.record_feeding_meal(uuid,uuid,jsonb,timestamptz,text,boolean,uuid) to authenticated;
create or replace function private.save_feeding_entry(p_household uuid,p_id uuid,p_product uuid,p_kind text,p_quantity numeric,p_at timestamptz,p_package numeric,p_packages integer,p_source text,p_allow_duplicate boolean,p_delete boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_old public.feeding_entries; v_product public.food_products; v_interval interval; v_previous timestamptz; v_after public.feeding_entries;
begin
 perform private.feeding_access(p_household);
 select * into v_old from public.feeding_entries where id=p_id;
 if found then
  if v_old.household_id<>p_household then raise exception 'Activity access denied' using errcode='42501'; end if;
  if v_old.kind='meal' and v_old.created_by<>auth.uid() then raise exception 'You can only edit your own feeding activities' using errcode='42501'; end if;
  if v_old.kind<>p_kind then raise exception 'Activity type cannot be changed'; end if;
 end if;
 if p_delete then
  if v_old.id is null then raise exception 'Activity not found'; end if;
  update public.feeding_entries set deleted_at=coalesce(deleted_at,now()),updated_at=now() where id=p_id returning * into v_after;
 else
  if v_old.deleted_at is not null then raise exception 'This activity was removed; create a new record'; end if;
  select * into v_product from public.food_products where id=p_product and household_id=p_household;
  if not found then raise exception 'Choose a product from this household'; end if;
  if p_at is null or p_at>now()+interval '5 minutes' then raise exception 'Choose a valid time, not in the future'; end if;
  if p_kind='meal' and v_product.category<>'treat' and not coalesce(p_allow_duplicate,false) then
   select make_interval(secs=>coalesce((select coalesce(warning_hours,24.0/meals_per_day) from public.feeding_settings where household_id=p_household),12)*3600) into v_interval;
   select max(e.occurred_at) into v_previous from public.feeding_entries e join public.food_products p on p.id=e.product_id where e.household_id=p_household and e.kind='meal' and e.deleted_at is null and p.category<>'treat' and e.id<>p_id and (v_old.event_id is null or e.event_id is distinct from v_old.event_id) and e.occurred_at<=p_at;
   if v_previous is not null and p_at-v_previous<v_interval then raise exception 'DUPLICATE_MEAL: A regular meal was recorded too recently. Review the last meal and confirm an intentional extra meal.'; end if;
  end if;
  insert into public.feeding_entries(id,household_id,product_id,kind,quantity_grams,occurred_at,package_grams,packages,created_by,source)
  values(p_id,p_household,p_product,p_kind,p_quantity,p_at,p_package,p_packages,auth.uid(),p_source)
  on conflict(id) do update set product_id=excluded.product_id,quantity_grams=excluded.quantity_grams,occurred_at=excluded.occurred_at,package_grams=excluded.package_grams,packages=excluded.packages,updated_at=now()
  where public.feeding_entries.household_id=p_household and public.feeding_entries.kind=p_kind
    and (public.feeding_entries.kind='purchase' or public.feeding_entries.created_by=auth.uid())
  returning * into v_after;
  if v_after.id is null then raise exception 'Activity access denied' using errcode='42501'; end if;
 end if;
 if private.food_balance(v_after.product_id)<0 or (v_old.product_id is not null and private.food_balance(v_old.product_id)<0) then raise exception 'Not enough recorded stock. Add a purchase or correct opening stock first.'; end if;
 insert into public.feeding_audit(household_id,actor_id,entity_id,entity_type,before_value,after_value)
 values(p_household,auth.uid(),p_id,'entry',case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(v_after));
 return p_id;
end $$;

create or replace function private.save_feeding_settings(p_household uuid,p_meals integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.feeding_access(p_household);
 if exists(select 1 from public.feeding_settings where household_id=p_household and jsonb_array_length(meal_plan)>0 and jsonb_array_length(meal_plan)<>p_meals) then raise exception 'Edit the detailed meal plan to change the number of meals'; end if;
 insert into public.feeding_settings(household_id,meals_per_day) values(p_household,p_meals) on conflict(household_id) do update set meals_per_day=excluded.meals_per_day;
end $$;
commit;
