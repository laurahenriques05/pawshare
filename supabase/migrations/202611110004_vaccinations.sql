begin;
create table public.vaccinations (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 120),
 given_on date not null check(isfinite(given_on)),
 next_due_on date check(isfinite(next_due_on) and next_due_on>given_on),
 veterinarian text not null default '' check(char_length(veterinarian)<=200),
 batch_number text not null default '' check(char_length(batch_number)<=120),
 notes text not null default '' check(char_length(notes)<=2000),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vaccinations_household_date on public.vaccinations(household_id,given_on);
create function private.audit_vaccination() returns trigger
language plpgsql set search_path='' as $$
declare v_timezone text;
begin
 select timezone into v_timezone from public.households where id=new.household_id;
 if v_timezone is null then raise exception 'Family access denied'; end if;
 if new.given_on>(clock_timestamp() at time zone v_timezone)::date then raise exception 'Vaccination date cannot be in the future'; end if;
 if TG_OP='INSERT' then new.created_by:=auth.uid(); new.created_at:=now(); end if;
 new.updated_by:=auth.uid(); new.updated_at:=clock_timestamp();
 return new;
end;
$$;
revoke all on function private.audit_vaccination() from public;
create trigger audit_vaccination before insert or update on public.vaccinations for each row execute function private.audit_vaccination();
alter table public.vaccinations enable row level security;
revoke all on public.vaccinations from anon,authenticated;
grant select on public.vaccinations to authenticated;
grant insert(household_id,name,given_on,next_due_on,veterinarian,batch_number,notes) on public.vaccinations to authenticated;
grant update(name,given_on,next_due_on,veterinarian,batch_number,notes) on public.vaccinations to authenticated;
create policy vaccination_read on public.vaccinations for select to authenticated using(private.is_member(household_id));
create policy vaccination_create on public.vaccinations for insert to authenticated with check(private.is_member(household_id));
create policy vaccination_edit on public.vaccinations for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
commit;
