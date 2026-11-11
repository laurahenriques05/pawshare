begin;
create table public.medication_schedules (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 120),
 instructions text not null check(char_length(trim(instructions)) between 1 and 2000),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.medication_doses (
 id uuid primary key default gen_random_uuid(),
 schedule_id uuid not null references public.medication_schedules(id) on delete cascade,
 scheduled_at timestamptz not null check(isfinite(scheduled_at)),
 status text not null default 'scheduled' check(status in ('scheduled','given','skipped')),
 administered_at timestamptz check(isfinite(administered_at)),
 recorded_by uuid references auth.users(id),
 recorded_at timestamptz,
 updated_at timestamptz not null default now(),
 notes text not null default '' check(char_length(notes)<=2000),
 unique(schedule_id,scheduled_at),
 check ((status='scheduled' and recorded_by is null and recorded_at is null and administered_at is null) or
 (status in ('given','skipped') and recorded_by is not null and recorded_at is not null and ((status='given' and administered_at is not null) or (status='skipped' and administered_at is null))))
);
create index medication_schedule_household on public.medication_schedules(household_id);
create index medication_dose_schedule_time on public.medication_doses(schedule_id,scheduled_at);
alter table public.medication_schedules enable row level security;
alter table public.medication_doses enable row level security;
revoke all on public.medication_schedules,public.medication_doses from anon,authenticated;
grant select on public.medication_schedules,public.medication_doses to authenticated;
create policy medication_read on public.medication_schedules for select to authenticated using(private.is_member(household_id));
create policy dose_read on public.medication_doses for select to authenticated using(exists(select 1 from public.medication_schedules s where s.id=schedule_id and private.is_member(s.household_id)));
-- All writes pass through scoped RPCs; no client audit fields or household reassignment.
create function public.save_medication_schedule(p_household uuid,p_schedule uuid,p_name text,p_instructions text,p_times timestamptz[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_time timestamptz;
begin
 if not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_schedule is null then
  if coalesce(cardinality(p_times),0) not between 1 and 366 then raise exception 'Choose 1–366 planned doses'; end if;
  insert into public.medication_schedules(household_id,name,instructions) values(p_household,trim(p_name),trim(p_instructions)) returning id into v_id;
 else
  select id into v_id from public.medication_schedules where id=p_schedule and household_id=p_household for update;
  if v_id is null then raise exception 'Schedule access denied'; end if;
  update public.medication_schedules set name=trim(p_name),instructions=trim(p_instructions),updated_by=auth.uid(),updated_at=clock_timestamp() where id=v_id;
 end if;
 if coalesce(cardinality(p_times),0)>366 then raise exception 'Too many doses'; end if;
 foreach v_time in array coalesce(p_times,array[]::timestamptz[]) loop
  insert into public.medication_doses(schedule_id,scheduled_at) values(v_id,v_time) on conflict(schedule_id,scheduled_at) do nothing;
 end loop;
 return v_id;
end;
$$;
create function public.reschedule_medication_dose(p_dose uuid,p_time timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_dose public.medication_doses; v_home uuid;
begin
 select * into v_dose from public.medication_doses where id=p_dose for update;
 select household_id into v_home from public.medication_schedules where id=v_dose.schedule_id;
 if v_home is null or not private.is_member(v_home) then raise exception 'Family access denied'; end if;
 if v_dose.status<>'scheduled' then raise exception 'Logged doses cannot be rescheduled'; end if;
 update public.medication_doses set scheduled_at=p_time,updated_at=clock_timestamp() where id=p_dose;
end;
$$;
create function public.log_medication_dose(p_dose uuid,p_status text,p_actual timestamptz,p_notes text) returns void
language plpgsql security definer set search_path='' as $$
declare v_dose public.medication_doses; v_home uuid;
begin
 select * into v_dose from public.medication_doses where id=p_dose for update;
 select household_id into v_home from public.medication_schedules where id=v_dose.schedule_id;
 if v_home is null or not private.is_member(v_home) then raise exception 'Family access denied' using errcode='42501'; end if;
 if v_dose.recorded_by is not null and v_dose.recorded_by<>auth.uid() then raise exception 'This dose was already logged by another member'; end if;
 if p_status is null or p_status not in ('given','skipped') then raise exception 'Choose given or skipped'; end if;
 if p_status='given' and (p_actual is null or not isfinite(p_actual) or p_actual>clock_timestamp()) then raise exception 'Actual administration time must not be in the future'; end if;
 update public.medication_doses set status=p_status,administered_at=case when p_status='given' then p_actual else null end,
 recorded_by=auth.uid(),recorded_at=coalesce(recorded_at,clock_timestamp()),updated_at=clock_timestamp(),notes=coalesce(p_notes,'') where id=p_dose;
end;
$$;
revoke all on function public.save_medication_schedule(uuid,uuid,text,text,timestamptz[]),public.reschedule_medication_dose(uuid,timestamptz),public.log_medication_dose(uuid,text,timestamptz,text) from public,anon;
grant execute on function public.save_medication_schedule(uuid,uuid,text,text,timestamptz[]),public.reschedule_medication_dose(uuid,timestamptz),public.log_medication_dose(uuid,text,timestamptz,text) to authenticated;
commit;
