begin;

create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique check(endpoint like 'https://%' and char_length(endpoint)<=2048),
 p256dh text not null check(char_length(p256dh) between 20 and 256),
 auth text not null check(char_length(auth) between 10 and 256),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(user_id,endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon,authenticated;
grant select,delete on public.push_subscriptions to authenticated;
grant insert(user_id,endpoint,p256dh,auth),update(endpoint,p256dh,auth,updated_at) on public.push_subscriptions to authenticated;
create policy push_subscription_read on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy push_subscription_insert on public.push_subscriptions for insert to authenticated with check(user_id=auth.uid());
create policy push_subscription_update on public.push_subscriptions for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy push_subscription_delete on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());

create table public.notification_preferences (
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('task','feeding','health','walk','academy')),
 enabled boolean not null default true,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(user_id,category)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon,authenticated;
grant select,insert,update,delete on public.notification_preferences to authenticated;
create policy notification_preferences_self on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create function private.cancel_muted_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' and not new.enabled then
  update public.scheduled_notifications set status='cancelled' where recipient_id=new.user_id and category=new.category and status in ('pending','sending');
 elsif TG_OP='UPDATE' and old.enabled is distinct from new.enabled and not new.enabled then
  update public.scheduled_notifications set status='cancelled' where recipient_id=new.user_id and category=new.category and status in ('pending','sending');
 end if;
 return new;
end; $$;
create trigger cancel_muted_notifications after insert or update of enabled on public.notification_preferences for each row execute function private.cancel_muted_notifications();

create table public.scheduled_notifications (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 category text not null check(category in ('task','feeding','health','walk','academy')),
 source_id text not null check(char_length(source_id) between 1 and 180),
 delivery_kind text not null check(delivery_kind in ('reminder','overdue_escalation')),
 title text not null check(char_length(title) between 1 and 120),
 body text not null default '' check(char_length(body)<=300),
 route text not null check(route like '/%' and route not like '//%' and position(chr(92) in route)=0 and char_length(route)<=400),
 send_at timestamptz not null check(isfinite(send_at)),
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 claimed_at timestamptz,
 sent_at timestamptz,
 last_error text not null default '' check(char_length(last_error)<=500),
 created_at timestamptz not null default clock_timestamp(),
 unique(recipient_id,source_id,delivery_kind)
);
create index notification_due_idx on public.scheduled_notifications(send_at) where status='pending';
create index notification_household_source_idx on public.scheduled_notifications(household_id,source_id);
alter table public.scheduled_notifications enable row level security;
revoke all on public.scheduled_notifications from anon,authenticated;
grant select on public.scheduled_notifications to authenticated;
create policy notification_read_self on public.scheduled_notifications for select to authenticated using(recipient_id=auth.uid() and private.is_member(household_id));
-- Keep notification writes frozen while the household is being deleted. The
-- original deletion migration predates this table, so it could not add this.
create trigger guard_deletion before insert or update on public.scheduled_notifications
 for each row execute function private.guard_deletion();

-- Feature owners call this contract with their stable source record ID. Task
-- reminders stay internal so callers cannot bypass task recipient/escalation
-- policy. Passing a null recipient targets every current household member.
create function public.sync_household_notification(
 p_household uuid,p_recipient uuid,p_category text,p_source_id text,p_delivery_kind text,
 p_title text,p_body text,p_route text,p_send_at timestamptz
) returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer:=0; v_source text;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_category is null or p_category not in ('feeding','health','walk','academy') or p_delivery_kind is null or p_delivery_kind not in ('reminder','overdue_escalation') then raise exception 'Invalid feature notification'; end if;
 if p_source_id is null or char_length(p_source_id) not between 1 and 150 or p_title is null or char_length(trim(p_title)) not between 1 and 120 or p_body is null or char_length(p_body)>300 or p_route is null or p_route not like '/%' or p_route like '//%' or position(chr(92) in p_route)>0 or char_length(p_route)>400 or p_send_at is null or not isfinite(p_send_at) then raise exception 'Invalid notification details'; end if;
 if p_recipient is not null and not exists(select 1 from public.household_members where household_id=p_household and user_id=p_recipient) then raise exception 'Recipient must be a current family member'; end if;
 v_source:=p_category||':'||p_source_id;
 insert into public.scheduled_notifications(household_id,recipient_id,category,source_id,delivery_kind,title,body,route,send_at,status)
 select p_household,m.user_id,p_category,v_source,p_delivery_kind,trim(p_title),trim(p_body),p_route,p_send_at,
  case when coalesce(pref.enabled,true) then 'pending' else 'cancelled' end
 from public.household_members m left join public.notification_preferences pref on pref.user_id=m.user_id and pref.category=p_category
 where m.household_id=p_household and (p_recipient is null or m.user_id=p_recipient)
 on conflict(recipient_id,source_id,delivery_kind) do update set title=excluded.title,body=excluded.body,route=excluded.route,send_at=excluded.send_at,status=excluded.status,attempts=0,claimed_at=null,last_error=''
  where public.scheduled_notifications.status in ('pending','cancelled','failed');
 get diagnostics v_count=row_count;
 return v_count;
end; $$;

create function public.cancel_household_notifications(p_household uuid,p_category text,p_source_id text) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_source text;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Family access denied' using errcode='42501'; end if;
 if p_category is null or p_category not in ('feeding','health','walk','academy') or p_source_id is null or char_length(p_source_id) not between 1 and 150 then raise exception 'Invalid feature notification'; end if;
 v_source:=p_category||':'||p_source_id;
 update public.scheduled_notifications set status='cancelled' where household_id=p_household and category=p_category and source_id=v_source and status in ('pending','sending');
 get diagnostics v_count=row_count;
 return v_count;
end; $$;
revoke all on function public.sync_household_notification(uuid,uuid,text,text,text,text,text,text,timestamptz),public.cancel_household_notifications(uuid,text,text) from public,anon;
grant execute on function public.sync_household_notification(uuid,uuid,text,text,text,text,text,text,timestamptz),public.cancel_household_notifications(uuid,text,text) to authenticated;

create function private.queue_task_occurrence(p_occurrence uuid) returns void language plpgsql security definer set search_path='' as $$
declare o public.task_occurrences; s public.task_series; m record; v_source text;
begin
 select * into o from public.task_occurrences where id=p_occurrence;
 if o.id is null then return; end if;
 select * into s from public.task_series where id=o.series_id;
 if s.id is null or s.archived_at is not null or o.completed_at is not null or o.due_at<=clock_timestamp() then return; end if;
 v_source:='task:'||o.id::text;
 if s.assigned_to is not null then
  if coalesce((select enabled from public.notification_preferences where user_id=s.assigned_to and category='task'),true) then
   insert into public.scheduled_notifications(household_id,recipient_id,category,source_id,delivery_kind,title,body,route,send_at)
   values(o.household_id,s.assigned_to,'task',v_source,'reminder','Task due soon',s.title,'/tasks?occurrence='||o.id::text,greatest(o.due_at-interval '1 hour',clock_timestamp()))
   on conflict(recipient_id,source_id,delivery_kind) do update set title=excluded.title,body=excluded.body,route=excluded.route,send_at=excluded.send_at,status='pending',attempts=0,claimed_at=null,last_error='';
  end if;
  for m in select user_id from public.household_members where household_id=o.household_id and user_id<>s.assigned_to loop
   if coalesce((select enabled from public.notification_preferences where user_id=m.user_id and category='task'),true) then
    insert into public.scheduled_notifications(household_id,recipient_id,category,source_id,delivery_kind,title,body,route,send_at)
    values(o.household_id,m.user_id,'task',v_source,'overdue_escalation','Task is overdue',s.title,'/tasks?occurrence='||o.id::text,greatest(o.due_at+interval '1 hour',clock_timestamp()))
    on conflict(recipient_id,source_id,delivery_kind) do update set title=excluded.title,body=excluded.body,route=excluded.route,send_at=excluded.send_at,status='pending',attempts=0,claimed_at=null,last_error='';
   end if;
  end loop;
 else
  for m in select user_id from public.household_members where household_id=o.household_id loop
   if coalesce((select enabled from public.notification_preferences where user_id=m.user_id and category='task'),true) then
    insert into public.scheduled_notifications(household_id,recipient_id,category,source_id,delivery_kind,title,body,route,send_at)
    values(o.household_id,m.user_id,'task',v_source,'reminder','Task due soon',s.title,'/tasks?occurrence='||o.id::text,greatest(o.due_at-interval '1 hour',clock_timestamp()))
    on conflict(recipient_id,source_id,delivery_kind) do update set title=excluded.title,body=excluded.body,route=excluded.route,send_at=excluded.send_at,status='pending',attempts=0,claimed_at=null,last_error='';
   end if;
  end loop;
 end if;
end; $$;

create function private.sync_task_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='DELETE' then
  update public.scheduled_notifications set status='cancelled' where source_id='task:'||old.id::text and status in ('pending','sending');
  return old;
 end if;
 if TG_OP='UPDATE' and new.completed_at is not null then
  update public.scheduled_notifications set status='cancelled' where source_id='task:'||new.id::text and status in ('pending','sending');
 elsif TG_OP='UPDATE' and old.completed_at is not null and new.completed_at is null then
  perform private.queue_task_occurrence(new.id);
 elsif TG_OP='INSERT' then
  perform private.queue_task_occurrence(new.id);
 end if;
 return new;
end; $$;
create trigger task_notification_insert after insert on public.task_occurrences for each row execute function private.sync_task_notifications();
create trigger task_notification_update after update of completed_at on public.task_occurrences for each row execute function private.sync_task_notifications();
create trigger task_notification_delete after delete on public.task_occurrences for each row execute function private.sync_task_notifications();
create function private.stop_archived_task_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.archived_at is null and new.archived_at is not null then
  update public.scheduled_notifications set status='cancelled' where status in ('pending','sending') and source_id in (select 'task:'||id::text from public.task_occurrences where series_id=new.id);
 end if;
 return new;
end; $$;
create trigger task_series_archive_notifications after update of archived_at on public.task_series for each row execute function private.stop_archived_task_notifications();
revoke all on function private.queue_task_occurrence(uuid),private.sync_task_notifications(),private.stop_archived_task_notifications(),private.cancel_muted_notifications() from public,anon,authenticated;

create function public.claim_due_notifications(p_limit integer default 50) returns setof public.scheduled_notifications
language plpgsql security definer set search_path='' as $$
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid notification batch size'; end if;
 return query with due as (
  select n.id from public.scheduled_notifications n
  where n.attempts<5 and ((n.status='pending' and n.send_at<=clock_timestamp()) or (n.status='sending' and n.claimed_at<clock_timestamp()-interval '5 minutes'))
  and exists(select 1 from public.household_members m where m.household_id=n.household_id and m.user_id=n.recipient_id)
  and coalesce((select p.enabled from public.notification_preferences p where p.user_id=n.recipient_id and p.category=n.category),true)
  order by n.send_at limit p_limit for update skip locked
 ) update public.scheduled_notifications n set status='sending',attempts=n.attempts+1,claimed_at=clock_timestamp()
 from due where n.id=due.id returning n.*;
end; $$;
create function public.finish_notification_delivery(p_id uuid,p_outcome text,p_error text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_outcome not in ('sent','retry','failed') or p_error is null or char_length(p_error)>500 then raise exception 'Invalid delivery result'; end if;
 update public.scheduled_notifications set status=case p_outcome when 'sent' then 'sent' when 'retry' then 'pending' else 'failed' end,
 sent_at=case when p_outcome='sent' then clock_timestamp() else null end,
 send_at=case when p_outcome='retry' then clock_timestamp()+make_interval(secs=>greatest(30,attempts*60)) else send_at end,
 last_error=trim(p_error),claimed_at=null where id=p_id and status='sending';
 if not found then raise exception 'Notification claim expired'; end if;
end; $$;
revoke all on function public.claim_due_notifications(integer),public.finish_notification_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_due_notifications(integer),public.finish_notification_delivery(uuid,text,text) to service_role;

commit;
