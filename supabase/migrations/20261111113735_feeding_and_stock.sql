begin;
create table public.feeding_settings (
 household_id uuid primary key references public.households(id) on delete cascade,
 meals_per_day integer not null default 2 check(meals_per_day between 1 and 12)
);
create table public.food_products (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 100),
 category text not null check(category in ('dry','wet','treat')),
 portion_grams numeric(12,2) not null check(portion_grams>0 and portion_grams<=1000000),
 daily_grams numeric(12,2) not null default 0 check(daily_grams>=0 and daily_grams<=1000000),
 opening_grams numeric(12,2) not null default 0 check(opening_grams>=0 and opening_grams<=100000000),
 reminder_days integer not null default 7 check(reminder_days between 0 and 90),
 created_at timestamptz not null default now(),
 unique(id,household_id)
);
-- An auditable source ledger, never a mutable stock counter.
create table public.feeding_entries (
 id uuid primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 product_id uuid not null,
 kind text not null check(kind in ('meal','purchase')),
 quantity_grams numeric(12,2) not null check(quantity_grams>0 and quantity_grams<=100000000),
 package_grams numeric(12,2),
 packages integer,
 occurred_at timestamptz not null,
 created_by uuid not null references auth.users(id),
 source text not null default 'app' check(source in ('app','nfc')),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(product_id,household_id) references public.food_products(id,household_id),
 check((kind='meal' and package_grams is null and packages is null) or
       (kind='purchase' and package_grams is not null and packages is not null and package_grams>0 and packages between 1 and 10000 and quantity_grams=package_grams*packages))
);
create index food_products_household_idx on public.food_products(household_id);
create index feeding_entries_household_time_idx on public.feeding_entries(household_id,occurred_at desc);
create index feeding_entries_product_idx on public.feeding_entries(product_id) where deleted_at is null;
create index feeding_entries_author_idx on public.feeding_entries(created_by);
create table public.feeding_audit (
 id bigint generated always as identity primary key,
 household_id uuid not null references public.households(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 entity_id uuid not null,
 entity_type text not null,
 before_value jsonb,
 after_value jsonb not null,
 changed_at timestamptz not null default now()
);
alter table public.feeding_settings enable row level security;
alter table public.food_products enable row level security;
alter table public.feeding_entries enable row level security;
alter table public.feeding_audit enable row level security;
revoke all on public.feeding_settings,public.food_products,public.feeding_entries,public.feeding_audit from anon,authenticated;
grant select on public.feeding_settings,public.food_products,public.feeding_entries,public.feeding_audit to authenticated;
create policy feeding_settings_read on public.feeding_settings for select to authenticated using(private.is_member(household_id));
create policy food_products_read on public.food_products for select to authenticated using(private.is_member(household_id));
create policy feeding_entries_read on public.feeding_entries for select to authenticated using(private.is_member(household_id));
create policy feeding_audit_read on public.feeding_audit for select to authenticated using(private.is_member(household_id));

-- Private privileged operations keep ledger writes atomic and enforce creator rules.
-- Browser roles have SELECT only; all writes go through the checked API wrappers.
create function private.feeding_access(p_household uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Household access denied' using errcode='42501'; end if;
 perform 1 from public.households where id=p_household for update;
 -- Recheck after waiting: a concurrent departure may have removed membership.
 if not private.is_member(p_household) then raise exception 'Household access denied' using errcode='42501'; end if;
end $$;
revoke all on function private.feeding_access(uuid) from public,anon,authenticated;

create function private.food_balance(p_product uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select p.opening_grams+coalesce((select sum(case when e.kind='purchase' then e.quantity_grams else -e.quantity_grams end) from public.feeding_entries e where e.product_id=p.id and e.deleted_at is null),0) from public.food_products p where p.id=p_product;
$$;
revoke all on function private.food_balance(uuid) from public,anon,authenticated;

create function private.save_food_product(p_household uuid,p_id uuid,p_name text,p_category text,p_portion numeric,p_daily numeric,p_opening numeric,p_reminder integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_old public.food_products; v_written integer;
begin
 perform private.feeding_access(p_household);
 select * into v_old from public.food_products where id=p_id;
 if found and v_old.household_id<>p_household then raise exception 'Product access denied' using errcode='42501'; end if;
 if v_old.id is not null and v_old.category<>p_category and exists(select 1 from public.feeding_entries where product_id=p_id) then raise exception 'Keep the food type consistent for recorded history; add a different product instead'; end if;
 insert into public.food_products(id,household_id,name,category,portion_grams,daily_grams,opening_grams,reminder_days)
 values(p_id,p_household,trim(p_name),p_category,p_portion,p_daily,p_opening,p_reminder)
 on conflict(id) do update set name=excluded.name,category=excluded.category,portion_grams=excluded.portion_grams,daily_grams=excluded.daily_grams,opening_grams=excluded.opening_grams,reminder_days=excluded.reminder_days where public.food_products.household_id=p_household;
 get diagnostics v_written = row_count;
 if v_written=0 then raise exception 'Product access denied' using errcode='42501'; end if;
 if private.food_balance(p_id)<0 then raise exception 'Opening stock cannot be reduced below recorded consumption'; end if;
 insert into public.feeding_audit(household_id,actor_id,entity_id,entity_type,before_value,after_value)
 select p_household,auth.uid(),p_id,'product',case when v_old.id is null then null else to_jsonb(v_old) end,to_jsonb(p) from public.food_products p where id=p_id;
 return p_id;
end $$;

create function private.save_feeding_settings(p_household uuid,p_meals integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.feeding_access(p_household);
 insert into public.feeding_settings(household_id,meals_per_day) values(p_household,p_meals) on conflict(household_id) do update set meals_per_day=excluded.meals_per_day;
end $$;

create function private.save_feeding_entry(p_household uuid,p_id uuid,p_product uuid,p_kind text,p_quantity numeric,p_at timestamptz,p_package numeric,p_packages integer,p_source text,p_allow_duplicate boolean,p_delete boolean) returns uuid
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
   select interval '24 hours'/coalesce((select meals_per_day from public.feeding_settings where household_id=p_household),2) into v_interval;
   select max(e.occurred_at) into v_previous from public.feeding_entries e join public.food_products p on p.id=e.product_id where e.household_id=p_household and e.kind='meal' and e.deleted_at is null and p.category<>'treat' and e.id<>p_id and e.occurred_at<=p_at;
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
revoke all on function private.save_food_product(uuid,uuid,text,text,numeric,numeric,numeric,integer),private.save_feeding_settings(uuid,integer),private.save_feeding_entry(uuid,uuid,uuid,text,numeric,timestamptz,numeric,integer,text,boolean,boolean) from public,anon;
grant execute on function private.save_food_product(uuid,uuid,text,text,numeric,numeric,numeric,integer),private.save_feeding_settings(uuid,integer),private.save_feeding_entry(uuid,uuid,uuid,text,numeric,timestamptz,numeric,integer,text,boolean,boolean) to authenticated;

create function public.save_food_product(p_household uuid,p_id uuid,p_name text,p_category text,p_portion numeric,p_daily numeric,p_opening numeric,p_reminder integer) returns uuid
language sql security invoker set search_path='' as $$ select private.save_food_product(p_household,p_id,p_name,p_category,p_portion,p_daily,p_opening,p_reminder); $$;
create function public.save_feeding_settings(p_household uuid,p_meals integer) returns void
language sql security invoker set search_path='' as $$ select private.save_feeding_settings(p_household,p_meals); $$;
create function public.save_feeding_entry(p_household uuid,p_id uuid,p_product uuid,p_kind text,p_quantity numeric,p_at timestamptz,p_package numeric default null,p_packages integer default null,p_source text default 'app',p_allow_duplicate boolean default false,p_delete boolean default false) returns uuid
language sql security invoker set search_path='' as $$ select private.save_feeding_entry(p_household,p_id,p_product,p_kind,p_quantity,p_at,p_package,p_packages,p_source,p_allow_duplicate,p_delete); $$;
revoke all on function public.save_food_product(uuid,uuid,text,text,numeric,numeric,numeric,integer),public.save_feeding_settings(uuid,integer),public.save_feeding_entry(uuid,uuid,uuid,text,numeric,timestamptz,numeric,integer,text,boolean,boolean) from public,anon;
grant execute on function public.save_food_product(uuid,uuid,text,text,numeric,numeric,numeric,integer),public.save_feeding_settings(uuid,integer),public.save_feeding_entry(uuid,uuid,uuid,text,numeric,timestamptz,numeric,integer,text,boolean,boolean) to authenticated;
commit;
