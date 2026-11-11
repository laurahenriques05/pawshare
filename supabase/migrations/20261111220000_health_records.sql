begin;
create table public.treatments (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 1 and 120), occurred_on date not null check(isfinite(occurred_on)), veterinarian text not null default '' check(char_length(veterinarian)<=200), notes text not null default '' check(char_length(notes)<=2000), created_by uuid not null default auth.uid() references auth.users(id), updated_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
 create index treatments_household on public.treatments(household_id);
 alter table public.treatments enable row level security;
 revoke all on public.treatments from anon,authenticated;
 grant select on public.treatments to authenticated;
 grant insert(household_id,title,occurred_on,veterinarian,notes) on public.treatments to authenticated;
 grant update(title,occurred_on,veterinarian,notes) on public.treatments to authenticated;
 create policy treatments_read on public.treatments for select to authenticated using(private.is_member(household_id));
 create policy treatments_create on public.treatments for insert to authenticated with check(private.is_member(household_id));
 create policy treatments_edit on public.treatments for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
create table public.vet_contacts (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 120), phone text not null default '' check(char_length(phone)<=80), email text not null default '' check(char_length(email)<=200), address text not null default '' check(char_length(address)<=300), notes text not null default '' check(char_length(notes)<=2000), created_by uuid not null default auth.uid() references auth.users(id), updated_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
 create index vet_contacts_household on public.vet_contacts(household_id);
 alter table public.vet_contacts enable row level security;
 revoke all on public.vet_contacts from anon,authenticated;
 grant select on public.vet_contacts to authenticated;
 grant insert(household_id,name,phone,email,address,notes) on public.vet_contacts to authenticated;
 grant update(name,phone,email,address,notes) on public.vet_contacts to authenticated;
 create policy vet_contacts_read on public.vet_contacts for select to authenticated using(private.is_member(household_id));
 create policy vet_contacts_create on public.vet_contacts for insert to authenticated with check(private.is_member(household_id));
 create policy vet_contacts_edit on public.vet_contacts for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
create table public.weight_measurements (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
 weight_kg numeric(5,2) not null check(weight_kg>0 and weight_kg<=200), measured_at timestamptz not null check(isfinite(measured_at)), notes text not null default '' check(char_length(notes)<=2000), created_by uuid not null default auth.uid() references auth.users(id), updated_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
 create index weight_measurements_household on public.weight_measurements(household_id);
 alter table public.weight_measurements enable row level security;
 revoke all on public.weight_measurements from anon,authenticated;
 grant select on public.weight_measurements to authenticated;
 grant insert(household_id,weight_kg,measured_at,notes) on public.weight_measurements to authenticated;
 grant update(weight_kg,measured_at,notes) on public.weight_measurements to authenticated;
 create policy weight_measurements_read on public.weight_measurements for select to authenticated using(private.is_member(household_id));
 create policy weight_measurements_create on public.weight_measurements for insert to authenticated with check(private.is_member(household_id));
 create policy weight_measurements_edit on public.weight_measurements for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
create function private.audit_health_record() returns trigger language plpgsql set search_path='' as $$
declare zone text;
begin
 select timezone into zone from public.households where id=new.household_id;
 if zone is null then raise exception 'Family access denied'; end if;
 if TG_TABLE_NAME='treatments' then
  if new.occurred_on>(clock_timestamp() at time zone zone)::date then raise exception 'Treatment date cannot be future'; end if;
 elsif TG_TABLE_NAME='weight_measurements' then
  if new.measured_at>clock_timestamp() then raise exception 'Measurement cannot be future'; end if;
 end if;
 if TG_OP='INSERT' then new.created_by:=auth.uid();new.created_at:=now(); end if;
 new.updated_by:=auth.uid();new.updated_at:=clock_timestamp();return new;
end;$$;
revoke all on function private.audit_health_record() from public;
-- Preserve existing known weight as an explicitly labelled migration baseline.
insert into public.weight_measurements(household_id,weight_kg,measured_at,created_by,updated_by,notes)
select d.household_id,d.weight_kg,now(),h.created_by,h.created_by,'Baseline from dog profile at migration; original measurement date unknown' from public.dogs d join public.households h on h.id=d.household_id where d.weight_kg is not null;
create trigger audit_treatments before insert or update on public.treatments for each row execute function private.audit_health_record();
create trigger audit_vet_contacts before insert or update on public.vet_contacts for each row execute function private.audit_health_record();
create trigger audit_weight_measurements before insert or update on public.weight_measurements for each row execute function private.audit_health_record();
create function private.sync_weight_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare latest numeric;
begin
 perform 1 from public.dogs where household_id=new.household_id for update;
 select weight_kg into latest from public.weight_measurements where household_id=new.household_id order by measured_at desc,created_at desc,id desc limit 1;
 perform set_config('pawshare.weight_sync','yes',true);
 update public.dogs set weight_kg=latest where household_id=new.household_id;
 perform set_config('pawshare.weight_sync','no',true);
 return new;
end;$$;
revoke all on function private.sync_weight_profile() from public;
create trigger sync_weight_profile after insert or update on public.weight_measurements for each row execute function private.sync_weight_profile();
create function private.profile_weight_measurement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if current_setting('pawshare.weight_sync',true)='yes' then return new; end if;
 if TG_OP='UPDATE' and new.weight_kg is not distinct from old.weight_kg then return new; end if;
 if new.weight_kg is null and exists(select 1 from public.weight_measurements where household_id=new.household_id) then raise exception 'Weight history exists; add a measurement in Health instead of clearing weight'; end if;
 if new.weight_kg is not null then insert into public.weight_measurements(household_id,weight_kg,measured_at) values(new.household_id,new.weight_kg,clock_timestamp()); end if;
 return new;
end;$$;
revoke all on function private.profile_weight_measurement() from public;
create trigger profile_weight_measurement after insert or update of weight_kg on public.dogs for each row execute function private.profile_weight_measurement();
commit;