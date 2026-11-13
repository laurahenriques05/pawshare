begin;
alter table public.households add column deletion_requested_by uuid references auth.users(id);
create table private.account_deletions(user_id uuid primary key references auth.users(id) on delete cascade,requested_at timestamptz not null default now());
revoke all on private.account_deletions from public,anon,authenticated;
create or replace function private.is_member(p_household uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.household_members m join public.households h on h.id=m.household_id join auth.users u on u.id=m.user_id where m.household_id=p_household and m.user_id=auth.uid() and h.deletion_requested_by is null and not exists(select 1 from private.account_deletions where user_id=auth.uid()));
$$;
create or replace function private.is_owner(p_household uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.is_member(p_household) and exists(select 1 from public.household_members where household_id=p_household and user_id=auth.uid() and role='owner');
$$;
-- Serialize joining a household with account deletion; freeze writes during storage cleanup.
create function private.guard_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='households' then
  perform 1 from auth.users where id=new.created_by for update;
  if exists(select 1 from private.account_deletions where user_id=new.created_by) then raise exception 'Account deletion pending'; end if;
 else
  perform 1 from public.households where id=new.household_id for update;
  if exists(select 1 from public.households where id=new.household_id and deletion_requested_by is not null) then raise exception 'Family deletion pending'; end if;
  if TG_TABLE_NAME='household_members' then
   perform 1 from auth.users where id=new.user_id for update;
   if exists(select 1 from private.account_deletions where user_id=new.user_id) then raise exception 'Account deletion pending'; end if;
  end if;
 end if;
 return new;
end;$$;
revoke all on function private.guard_deletion() from public;
create trigger guard_new_household before insert on public.households for each row execute function private.guard_deletion();
do $$declare t record;begin
 for t in select table_name from information_schema.columns where table_schema='public' and column_name='household_id' loop
  execute format('create trigger guard_deletion before insert or update on public.%I for each row execute function private.guard_deletion()',t.table_name);
 end loop;
end;$$;
create function public.begin_household_deletion(p_household uuid,p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare h public.households;
begin
 select * into h from public.households where id=p_household for update;
 if h.id is null or auth.uid() is null or not exists(select 1 from public.household_members where household_id=p_household and user_id=auth.uid() and role='owner') then raise exception 'Owner access required'; end if;
 if (select count(*) from public.household_members where household_id=p_household)<>1 then raise exception 'Only a sole member may delete a family'; end if;
 if p_confirmation is distinct from h.name then raise exception 'Type the family name to confirm'; end if;
 update public.households set deletion_requested_by=auth.uid() where id=p_household;
end;$$;
create function public.begin_account_deletion(p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_confirmation is distinct from 'DELETE MY ACCOUNT' then raise exception 'Explicit confirmation required'; end if;
 perform 1 from auth.users where id=auth.uid() for update;
 if exists(select 1 from public.household_members where user_id=auth.uid()) then raise exception 'Leave all families first; transfer ownership or delete your sole-member family'; end if;
 insert into private.account_deletions(user_id) values(auth.uid()) on conflict do nothing;
end;$$;
revoke all on function public.begin_household_deletion(uuid,text),public.begin_account_deletion(text) from public,anon;
grant execute on function public.begin_household_deletion(uuid,text),public.begin_account_deletion(text) to authenticated;
-- Keep shared history but remove user references when Auth deletes the account.
alter table public.medication_doses drop constraint medication_doses_check;
alter table public.medication_doses add constraint medication_dose_log_shape check(
 (status='scheduled' and recorded_by is null and recorded_at is null and administered_at is null) or
 (status in ('given','skipped') and recorded_at is not null and ((status='given' and administered_at is not null) or(status='skipped' and administered_at is null))));
do $$declare fk record;begin
 for fk in select con.conname,cls.relname,att.attname from pg_constraint con join pg_class cls on cls.oid=con.conrelid join pg_namespace ns on ns.oid=cls.relnamespace join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1] where con.contype='f' and con.confrelid='auth.users'::regclass and ns.nspname='public' and cls.relname not in ('profiles','household_members') loop
  execute format('alter table public.%I drop constraint %I',fk.relname,fk.conname);
  execute format('alter table public.%I alter column %I drop not null',fk.relname,fk.attname);
  execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete set null',fk.relname,fk.conname,fk.attname);
 end loop;
end;$$;
-- RPC correction must never let another user claim an anonymized log.
create or replace function public.log_medication_dose(p_dose uuid,p_status text,p_actual timestamptz,p_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare v_dose public.medication_doses; v_home uuid;
begin
 select * into v_dose from public.medication_doses where id=p_dose for update;
 select household_id into v_home from public.medication_schedules where id=v_dose.schedule_id;
 if v_home is null or not private.is_member(v_home) then raise exception 'Family access denied' using errcode='42501'; end if;
 if v_dose.recorded_at is not null and v_dose.recorded_by is distinct from auth.uid() then raise exception 'This dose was already logged by another member'; end if;
 if p_status is null or p_status not in ('given','skipped') then raise exception 'Choose given or skipped'; end if;
 if p_status='given' and (p_actual is null or not isfinite(p_actual) or p_actual>clock_timestamp()) then raise exception 'Actual administration time must not be in the future'; end if;
 update public.medication_doses set status=p_status,administered_at=case when p_status='given' then p_actual else null end,
 recorded_by=auth.uid(),recorded_at=coalesce(recorded_at,clock_timestamp()),updated_at=clock_timestamp(),notes=coalesce(p_notes,'') where id=p_dose;
end;
$$;

-- Null-safe ownership checks preserve recorder-only editing after anonymization.
do $$declare fn record; definition text;begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('start_walk','append_walk_points','finish_walk','correct_walk','set_walk_deleted','save_feeding_entry','record_feeding_meal','save_meal_result') loop
  definition:=pg_get_functiondef(fn.oid);
  definition:=replace(definition,'walker_id<>auth.uid()','walker_id is distinct from auth.uid()');
  definition:=replace(definition,'created_by<>auth.uid()','created_by is distinct from auth.uid()');
  execute definition;
 end loop;
end;$$;
create function public.finalize_household_deletion(p_household uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=p_household and deletion_requested_by=p_user for update;
 if not found then raise exception 'No matching deletion request'; end if;
 if (select count(*) from public.household_members where household_id=p_household)<>1 then raise exception 'Family membership changed'; end if;
 delete from public.households where id=p_household;
end;$$;
create function public.prepare_auth_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.account_deletions where user_id=p_user) or exists(select 1 from public.household_members where user_id=p_user) then raise exception 'No eligible account deletion request'; end if;
 -- Preserve shared files, removing the personal Storage ownership reference.
 update storage.objects set owner=null,owner_id=null where owner_id=p_user::text or owner=p_user;
 update public.feeding_audit set before_value=before_value-'created_by'-'updated_by'-'actor_id',after_value=after_value-'created_by'-'updated_by'-'actor_id' where before_value->>'created_by'=p_user::text or after_value->>'created_by'=p_user::text or actor_id=p_user;
 delete from public.invitations where created_by=p_user or accepted_by=p_user or email=(select email from auth.users where id=p_user);
end;$$;
revoke all on function public.finalize_household_deletion(uuid,uuid),public.prepare_auth_deletion(uuid) from public,anon,authenticated;
grant execute on function public.finalize_household_deletion(uuid,uuid),public.prepare_auth_deletion(uuid) to service_role;
commit;
