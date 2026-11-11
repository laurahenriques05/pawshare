begin;
create table public.vet_appointments (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 120),
 starts_at timestamptz not null check(isfinite(starts_at)),
 location text not null default '' check(char_length(location)<=200),
 notes text not null default '' check(char_length(notes)<=2000),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index vet_appointments_household_time on public.vet_appointments(household_id,starts_at);
create function private.audit_vet_appointment() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.created_by:=auth.uid(); new.created_at:=now();
 end if;
 new.updated_by:=auth.uid(); new.updated_at:=clock_timestamp();
 return new;
end;
$$;
revoke all on function private.audit_vet_appointment() from public;
create trigger audit_vet_appointment before insert or update on public.vet_appointments
for each row execute function private.audit_vet_appointment();
alter table public.vet_appointments enable row level security;
revoke all on public.vet_appointments from anon,authenticated;
grant select on public.vet_appointments to authenticated;
grant insert(household_id,title,starts_at,location,notes) on public.vet_appointments to authenticated;
grant update(title,starts_at,location,notes) on public.vet_appointments to authenticated;
create policy vet_read on public.vet_appointments for select to authenticated using(private.is_member(household_id));
create policy vet_create on public.vet_appointments for insert to authenticated with check(private.is_member(household_id));
create policy vet_edit on public.vet_appointments for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
commit;
