begin;
alter table public.feeding_meal_events
 add column occurred_at timestamptz not null default now(),
 add column outcome text not null default 'given' check(outcome in ('given','partial','refused','skipped')),
 add column notes text not null default '' check(char_length(notes)<=500),
 add column meal_name text not null default 'Feeding',
 add column source text not null default 'app' check(source in ('app','nfc')),
 add column deleted_at timestamptz;
alter table public.feeding_entries add column eaten_grams numeric(12,2) check(eaten_grams>=0 and eaten_grams<=quantity_grams);
update public.feeding_meal_events m set occurred_at=coalesce((select min(occurred_at) from public.feeding_entries where event_id=m.id),m.created_at),source=coalesce((select source from public.feeding_entries where event_id=m.id limit 1),'app');
create index feeding_events_household_time_idx on public.feeding_meal_events(household_id,occurred_at desc);
create index feeding_events_creator_idx on public.feeding_meal_events(created_by);

create function private.save_meal_result(p_household uuid,p_id uuid,p_items jsonb,p_at timestamptz,p_source text,p_allow_duplicate boolean,p_routine_meal uuid,p_outcome text,p_notes text,p_remove boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_old public.feeding_meal_events; v_line public.feeding_entries; v_item jsonb; v_previous timestamptz; v_gap numeric; v_timezone text; v_name text; v_entry uuid; served numeric:=0; eaten numeric:=0; v_quantity numeric; v_eaten numeric; v_written integer;
begin
 perform private.feeding_access(p_household);
 select * into v_old from public.feeding_meal_events where id=p_id;
 if found and (v_old.household_id<>p_household or v_old.created_by<>auth.uid()) then raise exception 'You can only edit your own feeding activities' using errcode='42501'; end if;
 if p_remove then
  if v_old.id is null then raise exception 'Meal not found'; end if;
  for v_line in select * from public.feeding_entries where event_id=p_id and deleted_at is null loop
   perform private.save_feeding_entry(p_household,v_line.id,v_line.product_id,'meal',v_line.quantity_grams,v_line.occurred_at,null,null,v_line.source,true,true);
  end loop;
  update public.feeding_meal_events set deleted_at=coalesce(deleted_at,now()) where id=p_id;
  insert into public.feeding_audit(household_id,actor_id,entity_id,entity_type,before_value,after_value) select p_household,auth.uid(),p_id,'meal_result',to_jsonb(v_old),to_jsonb(m) from public.feeding_meal_events m where id=p_id;
  return p_id;
 end if;
 if v_old.deleted_at is not null then raise exception 'This meal was removed; create a new record'; end if;
 if p_at is null or p_at>now()+interval '5 minutes' or p_outcome is null or p_outcome not in ('given','partial','refused','skipped') or length(coalesce(p_notes,''))>500 or p_source is null or p_source not in ('app','nfc') then raise exception 'Check the feeding time, outcome and notes'; end if;
 select timezone into v_timezone from public.households where id=p_household;
 select m->>'name' into v_name from public.feeding_settings s cross join lateral jsonb_array_elements(s.meal_plan) m where s.household_id=p_household and (m->>'id')::uuid=p_routine_meal;
 if p_routine_meal is not null and v_name is null and (v_old.id is null or v_old.routine_meal_id is distinct from p_routine_meal) then raise exception 'The routine changed. Refresh and choose a meal.'; end if;
 if not coalesce(p_allow_duplicate,false) then
   if p_routine_meal is not null and exists(select 1 from public.feeding_meal_events where household_id=p_household and id<>p_id and routine_meal_id=p_routine_meal and deleted_at is null and (occurred_at at time zone v_timezone)::date=(p_at at time zone v_timezone)::date) then raise exception 'DUPLICATE_MEAL: This planned meal already has a record today. Check the checklist before recording an extra meal.'; end if;
 end if;
 if p_outcome<>'skipped' then
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 12 then raise exception 'Choose food served for this meal'; end if;
  if (select count(*)<>count(distinct value->>'product_id') from jsonb_array_elements(p_items)) then raise exception 'Use each food product once per feeding'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
   if not exists(select 1 from public.food_products where id=(v_item->>'product_id')::uuid and household_id=p_household) then raise exception 'Choose food from this household'; end if;
   v_quantity:=(v_item->>'quantity_grams')::numeric;
   v_eaten:=(v_item->>'eaten_grams')::numeric;
   if v_quantity is null or v_eaten is null or jsonb_typeof(v_item->'quantity_grams')<>'number' or jsonb_typeof(v_item->'eaten_grams')<>'number' or v_quantity<=0 or v_quantity>1000000 or v_eaten<0 or v_eaten>v_quantity or round(v_quantity,2)<>v_quantity or round(v_eaten,2)<>v_eaten then raise exception 'Food eaten must be between zero and the quantity served (in grams)'; end if;
   if (p_outcome='given' and v_eaten<>v_quantity) or (p_outcome='refused' and v_eaten<>0) then raise exception 'Choose the outcome that matches the food eaten'; end if;
   served:=served+v_quantity; eaten:=eaten+v_eaten;
  end loop;
  if p_outcome='partial' and not (eaten>0 and eaten<served) then raise exception 'For partially eaten, enter more than zero eaten and less than was served'; end if;
  if not coalesce(p_allow_duplicate,false) then
   if exists(select 1 from jsonb_array_elements(p_items) i join public.food_products p on p.id=(i->>'product_id')::uuid where p.category<>'treat') then
    select coalesce(warning_hours,24.0/meals_per_day) into v_gap from public.feeding_settings where household_id=p_household;
    select max(e.occurred_at) into v_previous from public.feeding_entries e join public.food_products p on p.id=e.product_id where e.household_id=p_household and e.kind='meal' and e.deleted_at is null and p.category<>'treat' and e.event_id is distinct from p_id and e.occurred_at<=p_at;
    if v_previous is not null and p_at-v_previous<make_interval(secs=>coalesce(v_gap,12)*3600) then raise exception 'DUPLICATE_MEAL: Another regular meal was recorded too recently. Review the recent feeding before confirming.'; end if;
   end if;
  end if;
 end if;
 insert into public.feeding_meal_events(id,household_id,created_by,routine_meal_id,occurred_at,outcome,notes,meal_name,source)
 values(p_id,p_household,auth.uid(),p_routine_meal,p_at,p_outcome,coalesce(p_notes,''),coalesce(v_name,v_old.meal_name,'Feeding'),p_source)
 on conflict(id) do update set routine_meal_id=excluded.routine_meal_id,occurred_at=excluded.occurred_at,outcome=excluded.outcome,notes=excluded.notes,meal_name=excluded.meal_name where public.feeding_meal_events.household_id=p_household and public.feeding_meal_events.created_by=auth.uid();
 get diagnostics v_written=row_count;
 if v_written=0 then raise exception 'Meal access denied' using errcode='42501'; end if;
 -- Replace an author's ingredient lines in one transaction. Stock remains a ledger sum.
 for v_line in select * from public.feeding_entries where event_id=p_id and deleted_at is null loop
  perform private.save_feeding_entry(p_household,v_line.id,v_line.product_id,'meal',v_line.quantity_grams,v_line.occurred_at,null,null,v_line.source,true,true);
 end loop;
 if p_outcome<>'skipped' then
  for v_item in select value from jsonb_array_elements(p_items) loop
   v_entry:=private.save_feeding_entry(p_household,gen_random_uuid(),(v_item->>'product_id')::uuid,'meal',(v_item->>'quantity_grams')::numeric,p_at,null,null,p_source,true,false);
   update public.feeding_entries set event_id=p_id,eaten_grams=(v_item->>'eaten_grams')::numeric where id=v_entry;
  end loop;
 end if;
 insert into public.feeding_audit(household_id,actor_id,entity_id,entity_type,before_value,after_value)
 select p_household,auth.uid(),p_id,'meal_result',case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(m) from public.feeding_meal_events m where id=p_id;
 return p_id;
end $$;
revoke all on function private.save_meal_result(uuid,uuid,jsonb,timestamptz,text,boolean,uuid,text,text,boolean) from public,anon;
grant execute on function private.save_meal_result(uuid,uuid,jsonb,timestamptz,text,boolean,uuid,text,text,boolean) to authenticated;
create function public.save_meal_result(p_household uuid,p_id uuid,p_items jsonb,p_at timestamptz,p_source text default 'app',p_allow_duplicate boolean default false,p_routine_meal uuid default null,p_outcome text default 'given',p_notes text default '',p_remove boolean default false) returns uuid
language sql security invoker set search_path='' as $$ select private.save_meal_result(p_household,p_id,p_items,p_at,p_source,p_allow_duplicate,p_routine_meal,p_outcome,p_notes,p_remove); $$;
revoke all on function public.save_meal_result(uuid,uuid,jsonb,timestamptz,text,boolean,uuid,text,text,boolean) from public,anon;
grant execute on function public.save_meal_result(uuid,uuid,jsonb,timestamptz,text,boolean,uuid,text,text,boolean) to authenticated;
commit;
