begin;
create table public.walks (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 dog_id uuid not null references public.dogs(id) on delete cascade,
 walker_id uuid not null references auth.users(id),
 started_at timestamptz not null default clock_timestamp(),
 ended_at timestamptz,
 distance_m double precision not null default 0 check(distance_m >= 0 and distance_m < 'Infinity'::float8),
 notes text not null default '' check(char_length(notes)<=2000),
 end_reason text check(end_reason in ('manual','stationary')),
 deleted_at timestamptz,
 check(ended_at is null or ended_at >= started_at),
 check((ended_at is null) = (end_reason is null))
);
create unique index walks_one_active_dog on public.walks(dog_id) where ended_at is null and deleted_at is null;
create index walks_household_date on public.walks(household_id,started_at desc);
create table public.walk_points (
 walk_id uuid not null references public.walks(id) on delete cascade,
 seq integer not null check(seq >= 0),
 recorded_at timestamptz not null,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy double precision not null check(accuracy between 0 and 50),
 primary key(walk_id,seq)
);
alter table public.walks enable row level security;
alter table public.walk_points enable row level security;
revoke all on public.walks,public.walk_points from anon,authenticated;
grant select on public.walks,public.walk_points to authenticated;
create policy walk_read on public.walks for select to authenticated using (
 private.is_member(household_id) and (deleted_at is null or walker_id=auth.uid())
);
create policy walk_route_read on public.walk_points for select to authenticated using (
 exists(select 1 from public.walks w where w.id=walk_id and private.is_member(w.household_id)
 and w.deleted_at is null and (w.walker_id=auth.uid() or w.ended_at is not null))
);
create function public.start_walk(p_dog uuid) returns public.walks
language plpgsql security definer set search_path='' as $$
declare d public.dogs; w public.walks;
begin
 select * into d from public.dogs where id=p_dog;
 if d.id is null or not private.is_member(d.household_id) then raise exception 'Dog access denied' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_dog::text,1));
 select * into w from public.walks where dog_id=p_dog and ended_at is null and deleted_at is null;
 if w.id is not null then
  if w.walker_id<>auth.uid() then raise exception 'Another family member is already walking this dog'; end if;
  return w;
 end if;
 insert into public.walks(household_id,dog_id,walker_id) values(d.household_id,d.id,auth.uid()) returning * into w;
 return w;
end; $$;
create function public.append_walk_points(p_walk uuid,p_points jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare w public.walks; p record; previous public.walk_points; existing public.walk_points; n integer:=0;
begin
 select * into w from public.walks where id=p_walk for update;
 if w.id is null or w.walker_id<>auth.uid() or not private.is_member(w.household_id) then raise exception 'Walker access required' using errcode='42501'; end if;
 if w.ended_at is not null or w.deleted_at is not null then raise exception 'Walk is no longer active'; end if;
 if p_points is null or jsonb_typeof(p_points)<>'array' then raise exception 'Expected an array of GPS points'; end if;
 if jsonb_array_length(p_points)>500 then raise exception 'Batch limit is 500 points'; end if;
 select * into previous from public.walk_points where walk_id=w.id order by seq desc limit 1;
 for p in select * from jsonb_to_recordset(p_points) as x(seq integer,recorded_at timestamptz,latitude double precision,longitude double precision,accuracy double precision) order by seq loop
  select * into existing from public.walk_points where walk_id=w.id and seq=p.seq;
  if existing.walk_id is not null then
   if existing.recorded_at is distinct from p.recorded_at or existing.latitude is distinct from p.latitude or existing.longitude is distinct from p.longitude or existing.accuracy is distinct from p.accuracy then raise exception 'GPS sequence conflict; resume on the original device'; end if;
   continue;
  end if;
  if p.seq is null or p.seq<>coalesce(previous.seq+1,0) or p.recorded_at is null or p.recorded_at<w.started_at or p.recorded_at>clock_timestamp()+interval '30 seconds' or (previous.recorded_at is not null and p.recorded_at<=previous.recorded_at) then raise exception 'Invalid GPS sequence or timestamp'; end if;
  insert into public.walk_points values(w.id,p.seq,p.recorded_at,p.latitude,p.longitude,p.accuracy) returning * into previous;
  n:=n+1;
 end loop;
 return n;
end; $$;
create function public.finish_walk(p_walk uuid,p_ended_at timestamptz,p_reason text default 'manual') returns public.walks
language plpgsql security definer set search_path='' as $$
declare w public.walks; v_meters double precision; latest timestamptz;
begin
 select * into w from public.walks where id=p_walk for update;
 if w.id is null or w.walker_id<>auth.uid() or not private.is_member(w.household_id) then raise exception 'Walker access required' using errcode='42501'; end if;
 if w.deleted_at is not null then raise exception 'Walk has been deleted'; end if;
 if w.ended_at is not null then return w; end if;
 select max(recorded_at) into latest from public.walk_points where walk_id=w.id;
 if p_ended_at is null or p_ended_at<w.started_at or p_ended_at>clock_timestamp()+interval '30 seconds' or p_ended_at<latest or p_reason not in ('manual','stationary') or p_reason is null then raise exception 'Invalid end time or reason'; end if;
 -- Never bridge GPS interruptions (>60s) or impossible walking jumps (>5 m/s).
 with route as (
 select *,lag(latitude) over(order by seq) lat0,lag(longitude) over(order by seq) lon0,lag(recorded_at) over(order by seq) time0,lag(accuracy) over(order by seq) accuracy0 from public.walk_points where walk_id=w.id
 ), segments as (
 select extract(epoch from recorded_at-time0) seconds,greatest(3,(accuracy+accuracy0)/2) noise_m,
  12742000 * asin(sqrt(least(1.0,power(sin(radians(latitude-lat0)/2),2)+cos(radians(lat0))*cos(radians(latitude))*power(sin(radians(longitude-lon0)/2),2)))) meters from route
 ) select coalesce(sum(case when seconds>0 and seconds<=60 and meters>noise_m and meters/seconds<=5 then meters else 0 end),0) into v_meters from segments;
 update public.walks set ended_at=p_ended_at,distance_m=v_meters,end_reason=p_reason where id=w.id returning * into w;
 return w;
end; $$;
create function public.correct_walk(p_walk uuid,p_started_at timestamptz,p_ended_at timestamptz,p_notes text) returns public.walks
language plpgsql security definer set search_path='' as $$
declare w public.walks; first_fix timestamptz; last_fix timestamptz;
begin
 select * into w from public.walks where id=p_walk for update;
 if w.id is null or w.walker_id<>auth.uid() or not private.is_member(w.household_id) then raise exception 'Walker access required' using errcode='42501'; end if;
 if w.ended_at is null or w.deleted_at is not null then raise exception 'Only completed walks can be corrected'; end if;
 select min(recorded_at),max(recorded_at) into first_fix,last_fix from public.walk_points where walk_id=w.id;
 if p_started_at is null or p_ended_at is null or p_started_at>p_ended_at or p_ended_at>clock_timestamp()+interval '30 seconds' or p_started_at>first_fix or p_ended_at<last_fix or p_notes is null or char_length(p_notes)>2000 then raise exception 'Times must include the recorded route and notes must be at most 2000 characters'; end if;
 update public.walks set started_at=p_started_at,ended_at=p_ended_at,notes=trim(p_notes) where id=w.id returning * into w;
 return w;
end; $$;
create function public.set_walk_deleted(p_walk uuid,p_deleted boolean) returns void
language plpgsql security definer set search_path='' as $$
declare w public.walks;
begin
 select * into w from public.walks where id=p_walk for update;
 if w.id is null or w.walker_id<>auth.uid() or not private.is_member(w.household_id) then raise exception 'Walker access required' using errcode='42501'; end if;
 if w.ended_at is null then raise exception 'Finish the walk before deleting it'; end if;
 update public.walks set deleted_at=case when p_deleted then clock_timestamp() else null end where id=w.id;
end; $$;
revoke all on function public.start_walk(uuid),public.append_walk_points(uuid,jsonb),public.finish_walk(uuid,timestamptz,text),public.correct_walk(uuid,timestamptz,timestamptz,text),public.set_walk_deleted(uuid,boolean) from public,anon;
grant execute on function public.start_walk(uuid),public.append_walk_points(uuid,jsonb),public.finish_walk(uuid,timestamptz,text),public.correct_walk(uuid,timestamptz,timestamptz,text),public.set_walk_deleted(uuid,boolean) to authenticated;
commit;
