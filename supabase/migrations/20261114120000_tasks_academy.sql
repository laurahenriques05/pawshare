begin;

create table public.task_series (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 1 and 100),
 details text not null default '' check (char_length(details) <= 1200),
 assigned_to uuid references auth.users(id) on delete set null,
 first_due_at timestamptz not null check (isfinite(first_due_at)),
 recurrence text not null default 'none' check (recurrence in ('none','daily','weekly','monthly')),
 recurrence_every integer not null default 1 check (recurrence_every between 1 and 52),
 ends_on date,
 archived_at timestamptz,
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check ((recurrence = 'none' and recurrence_every = 1 and ends_on is null) or recurrence <> 'none')
);

create table public.task_occurrences (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 series_id uuid not null references public.task_series(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 1 and 100),
 details text not null default '' check (char_length(details) <= 1200),
 assigned_to uuid references auth.users(id) on delete set null,
 recurrence text not null check (recurrence in ('none','daily','weekly','monthly')),
 recurrence_every integer not null check (recurrence_every between 1 and 52),
 due_at timestamptz not null check (isfinite(due_at)),
 completed_at timestamptz,
 completed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 unique (series_id,due_at),
 check ((completed_at is null) = (completed_by is null))
);

create index task_series_household_due on public.task_series(household_id,first_due_at) where archived_at is null;
create index task_occurrences_household_due on public.task_occurrences(household_id,due_at);
create index task_occurrences_series_due on public.task_occurrences(series_id,due_at);

alter table public.task_series enable row level security;
alter table public.task_occurrences enable row level security;
revoke all on public.task_series,public.task_occurrences from anon,authenticated;
grant select on public.task_series,public.task_occurrences to authenticated;
create policy task_series_read on public.task_series for select to authenticated using (private.is_member(household_id));
create policy task_occurrences_read on public.task_occurrences for select to authenticated using (private.is_member(household_id));

create function public.save_household_task(
 p_household uuid,p_id uuid,p_title text,p_details text,p_assigned_to uuid,
 p_first_due_at timestamptz,p_recurrence text,p_recurrence_every integer,p_ends_on date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_zone text; v_local timestamp;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_title is null or char_length(trim(p_title)) not between 1 and 100 or p_details is null or char_length(p_details)>1200 then raise exception 'Enter a task title (1–100 characters) and details up to 1200 characters'; end if;
 if p_first_due_at is null or not isfinite(p_first_due_at) or p_recurrence is null or p_recurrence not in ('none','daily','weekly','monthly') or p_recurrence_every is null or p_recurrence_every not between 1 and 52 then raise exception 'Invalid task schedule'; end if;
 if p_recurrence='none' and (p_recurrence_every<>1 or p_ends_on is not null) then raise exception 'One-time tasks do not have a repeat interval or end date'; end if;
 select timezone into v_zone from public.households where id=p_household;
 v_local:=p_first_due_at at time zone v_zone;
 if p_ends_on is not null and (p_recurrence='none' or p_ends_on<v_local::date) then raise exception 'Repeat end date must be on or after the first due date'; end if;
 if p_assigned_to is not null and not exists(select 1 from public.household_members where household_id=p_household and user_id=p_assigned_to) then raise exception 'Choose a current family member'; end if;
 if p_id is null then
  insert into public.task_series(household_id,title,details,assigned_to,first_due_at,recurrence,recurrence_every,ends_on,created_by,updated_by)
  values(p_household,trim(p_title),trim(p_details),p_assigned_to,p_first_due_at,p_recurrence,p_recurrence_every,p_ends_on,auth.uid(),auth.uid()) returning id into v_id;
 else
  select id into v_id from public.task_series where id=p_id and household_id=p_household for update;
  if v_id is null then raise exception 'Task not found'; end if;
  update public.task_series set title=trim(p_title),details=trim(p_details),assigned_to=p_assigned_to,first_due_at=p_first_due_at,recurrence=p_recurrence,recurrence_every=p_recurrence_every,ends_on=p_ends_on,updated_by=auth.uid(),updated_at=clock_timestamp() where id=v_id;
  -- Preserve history; reschedule only future, still-open occurrences.
  delete from public.task_occurrences where series_id=v_id and due_at>=clock_timestamp() and completed_at is null;
 end if;
 -- Materialize the current planning horizon immediately so server-side reminders
 -- exist even when no one has the task screen open.
 perform public.generate_task_occurrences(p_household,clock_timestamp()-interval '90 days',clock_timestamp()+interval '180 days');
 return v_id;
end; $$;

create function public.generate_task_occurrences(p_household uuid,p_from timestamptz,p_until timestamptz) returns integer
language plpgsql security definer set search_path='' as $$
declare s record; v_zone text; v_start timestamp; v_local_from timestamp; v_candidate timestamp; v_due timestamptz; v_i integer; v_first_i integer; v_count integer:=0;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<=p_from or p_until-p_from>interval '370 days' then raise exception 'Choose a calendar window of at most 370 days'; end if;
 select timezone into v_zone from public.households where id=p_household;
 for s in select * from public.task_series where household_id=p_household and archived_at is null loop
  v_start:=s.first_due_at at time zone v_zone;
  v_local_from:=p_from at time zone v_zone;
  v_first_i:=greatest(0,case s.recurrence
   when 'daily' then floor((v_local_from::date-v_start::date)::numeric/s.recurrence_every)::integer
   when 'weekly' then floor((v_local_from::date-v_start::date)::numeric/(s.recurrence_every*7))::integer
   when 'monthly' then floor(((extract(year from v_local_from)::integer-extract(year from v_start)::integer)*12+extract(month from v_local_from)::integer-extract(month from v_start)::integer)::numeric/s.recurrence_every)::integer
   else 0
  end);
  for v_i in v_first_i..v_first_i+520 loop
   if s.recurrence='none' and v_i>0 then exit; end if;
   v_candidate:=v_start + case s.recurrence
    when 'daily' then make_interval(days=>v_i*s.recurrence_every)
    when 'weekly' then make_interval(days=>v_i*s.recurrence_every*7)
    when 'monthly' then make_interval(months=>v_i*s.recurrence_every)
    else interval '0'
   end;
   if s.ends_on is not null and v_candidate::date>s.ends_on then exit; end if;
   v_due:=v_candidate at time zone v_zone;
   if v_due>p_until then exit; end if;
   if v_due>=p_from then
    insert into public.task_occurrences(household_id,series_id,title,details,assigned_to,recurrence,recurrence_every,due_at)
    values(p_household,s.id,s.title,s.details,s.assigned_to,s.recurrence,s.recurrence_every,v_due) on conflict(series_id,due_at) do nothing;
    if found then v_count:=v_count+1; end if;
   end if;
  end loop;
 end loop;
 return v_count;
end; $$;

create function public.complete_household_task(p_occurrence uuid,p_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare v_task public.task_occurrences;
begin
 select * into v_task from public.task_occurrences where id=p_occurrence for update;
 if v_task.id is null or not private.is_member(v_task.household_id) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_completed then
  if v_task.completed_by is not null and v_task.completed_by<>auth.uid() then raise exception 'Only the person who logged this completion can correct it' using errcode='42501'; end if;
  update public.task_occurrences set completed_at=coalesce(completed_at,clock_timestamp()),completed_by=auth.uid() where id=p_occurrence;
 else
  if v_task.completed_by is distinct from auth.uid() then raise exception 'Only the person who logged this completion can correct it' using errcode='42501'; end if;
  update public.task_occurrences set completed_at=null,completed_by=null where id=p_occurrence;
 end if;
end; $$;

create function public.archive_household_task(p_household uuid,p_task uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 update public.task_series set archived_at=clock_timestamp(),updated_by=auth.uid(),updated_at=clock_timestamp() where id=p_task and household_id=p_household and archived_at is null;
 if not found then raise exception 'Task not found'; end if;
end; $$;

revoke all on function public.save_household_task(uuid,uuid,text,text,uuid,timestamptz,text,integer,date),public.generate_task_occurrences(uuid,timestamptz,timestamptz),public.complete_household_task(uuid,boolean),public.archive_household_task(uuid,uuid) from public,anon;
grant execute on function public.save_household_task(uuid,uuid,text,text,uuid,timestamptz,text,integer,date),public.generate_task_occurrences(uuid,timestamptz,timestamptz),public.complete_household_task(uuid,boolean),public.archive_household_task(uuid,uuid) to authenticated;

create table public.academy_modules (
 id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id)<=80),
 course_id text not null check (course_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(course_id)<=80),
 position integer not null check (position between 1 and 100),
 unique(course_id,position)
);
insert into public.academy_modules(id,course_id,position) values
 ('daily-care-check-in','everyday-care',1),('walking-basics','everyday-care',2);
alter table public.academy_modules enable row level security;
revoke all on public.academy_modules from anon,authenticated;
grant select on public.academy_modules to authenticated;
create policy academy_modules_read on public.academy_modules for select to authenticated using(true);

create table public.academy_module_progress (
 household_id uuid not null references public.households(id) on delete cascade,
 dog_id uuid not null references public.dogs(id) on delete cascade,
 module_id text not null references public.academy_modules(id),
 completed_at timestamptz not null default clock_timestamp(),
 completed_by uuid references auth.users(id) on delete set null,
 primary key(household_id,module_id)
);
alter table public.academy_module_progress enable row level security;
revoke all on public.academy_module_progress from anon,authenticated;
grant select on public.academy_module_progress to authenticated;
create policy academy_progress_read on public.academy_module_progress for select to authenticated using(private.is_member(household_id));

create table public.academy_practice (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 dog_id uuid not null references public.dogs(id) on delete cascade,
 module_id text not null references public.academy_modules(id),
 user_id uuid references auth.users(id) on delete set null,
 practiced_at timestamptz not null default clock_timestamp(),
 checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist)='object'),
 performance text not null default '' check (char_length(performance)<=1200),
 completed boolean not null default false,
 deleted_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 check (isfinite(practiced_at))
);
create index academy_practice_household_date on public.academy_practice(household_id,practiced_at desc) where deleted_at is null;
create index academy_practice_module on public.academy_practice(household_id,module_id) where deleted_at is null;
alter table public.academy_practice enable row level security;
revoke all on public.academy_practice from anon,authenticated;
grant select on public.academy_practice to authenticated;
create policy academy_practice_read on public.academy_practice for select to authenticated using(private.is_member(household_id));

create function public.save_academy_practice(p_household uuid,p_id uuid,p_dog uuid,p_module text,p_checklist jsonb,p_performance text,p_completed boolean,p_delete boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_row public.academy_practice;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_module is null or p_checklist is null or jsonb_typeof(p_checklist)<>'object' or p_performance is null or char_length(p_performance)>1200 or p_completed is null then raise exception 'Invalid practice record'; end if;
 if not exists(select 1 from public.dogs where id=p_dog and household_id=p_household) then raise exception 'Dog access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.academy_modules where id=p_module) then raise exception 'Lesson is unavailable'; end if;
 if p_completed and exists(
  select 1 from public.academy_modules current_module join public.academy_modules previous_module on previous_module.course_id=current_module.course_id and previous_module.position=current_module.position-1
  where current_module.id=p_module and not exists(select 1 from public.academy_module_progress progress where progress.household_id=p_household and progress.module_id=previous_module.id)
 ) then raise exception 'Complete the previous lesson first'; end if;
 if p_id is null then
  if p_delete then raise exception 'Practice record not found'; end if;
  insert into public.academy_practice(household_id,dog_id,module_id,user_id,checklist,performance,completed)
  values(p_household,p_dog,p_module,auth.uid(),p_checklist,p_performance,p_completed) returning id into v_id;
 else
  select * into v_row from public.academy_practice where id=p_id and household_id=p_household for update;
  if v_row.id is null then
   if p_delete then raise exception 'Practice record not found'; end if;
   insert into public.academy_practice(id,household_id,dog_id,module_id,user_id,checklist,performance,completed)
   values(p_id,p_household,p_dog,p_module,auth.uid(),p_checklist,trim(p_performance),p_completed) returning id into v_id;
  else
  if v_row.user_id is distinct from auth.uid() then raise exception 'Only your own practice records can be changed' using errcode='42501'; end if;
  if v_row.completed and not p_completed then raise exception 'A saved lesson completion is part of shared family progress and cannot be undone'; end if;
  if p_delete then update public.academy_practice set deleted_at=coalesce(deleted_at,clock_timestamp()),updated_at=clock_timestamp() where id=p_id returning id into v_id;
  else
   if v_row.deleted_at is not null then raise exception 'Deleted practice cannot be edited'; end if;
   if v_row.dog_id<>p_dog or v_row.module_id<>p_module then raise exception 'Practice identity cannot be changed'; end if;
   update public.academy_practice set checklist=p_checklist,performance=trim(p_performance),completed=p_completed,updated_at=clock_timestamp() where id=p_id returning id into v_id;
  end if;
  end if;
 end if;
 if p_completed then
  insert into public.academy_module_progress(household_id,dog_id,module_id,completed_by)
  values(p_household,p_dog,p_module,auth.uid()) on conflict(household_id,module_id) do nothing;
 end if;
 return v_id;
end; $$;
revoke all on function public.save_academy_practice(uuid,uuid,uuid,text,jsonb,text,boolean,boolean) from public,anon;
grant execute on function public.save_academy_practice(uuid,uuid,uuid,text,jsonb,text,boolean,boolean) to authenticated;

commit;
