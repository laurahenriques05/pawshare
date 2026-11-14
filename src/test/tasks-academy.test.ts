import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
import { academyModules } from '../features/academy/catalog'
import { academyProgress } from '../features/academy/progress'
import type { AcademyModuleProgress,AcademyPractice } from '../lib/supabase/database.types'
import { monthRange,recurrenceLabel,shiftMonth,taskStatus } from '../features/tasks/model'

it('formats task recurrence, task status and calendar months',()=>{
 expect(recurrenceLabel({recurrence:'none',recurrence_every:1})).toBe('One-time')
 expect(recurrenceLabel({recurrence:'weekly',recurrence_every:2})).toBe('Every 2 weeks')
 expect(taskStatus({due_at:'2026-01-01T09:00:00Z',completed_at:null},Date.parse('2026-01-01T10:00:00Z'))).toBe('overdue')
 expect(taskStatus({due_at:'2026-01-01T09:00:00Z',completed_at:'2026-01-01T09:30:00Z'},Date.parse('2026-01-01T10:00:00Z'))).toBe('completed')
 expect(shiftMonth('2026-12',1)).toBe('2027-01')
 expect(shiftMonth('2027-01',-1)).toBe('2026-12')
 const range=monthRange('2026-11');expect(Date.parse(range.until)-Date.parse(range.from)).toBeLessThan(32*86400000)
})

it('awards one shared milestone per module and computes household-local streaks',()=>{
 const records=[
  {module_id:'daily-care-check-in',completed:true,deleted_at:null,practiced_at:'2026-11-13T23:30:00Z'},
  {module_id:'daily-care-check-in',completed:true,deleted_at:null,practiced_at:'2026-11-14T09:00:00Z'},
  {module_id:'walking-basics',completed:false,deleted_at:null,practiced_at:'2026-11-14T10:00:00Z'},
 ] as AcademyPractice[]
 const progressRows=[{module_id:'daily-care-check-in'}] as AcademyModuleProgress[]
 const result=academyProgress(records,'Europe/Lisbon',new Date('2026-11-14T12:00:00Z'),progressRows)
 expect(result.xp).toBe(10);expect(result.level).toBe(1);expect(result.completedCount).toBe(1);expect(result.streak).toBe(2)
 expect(result.badges).toEqual(['First lesson']);expect(result.nextModule?.id).toBe('walking-basics')
 expect(academyModules[1].id).toBe('walking-basics')
})

it('enforces task household access, recurrence materialization and completion ownership, plus Academy milestone and practice ownership',async()=>{
 const sql=new PGlite();const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',c='10000000-0000-0000-0000-000000000003'
 const user=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
  await sql.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
  await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
  // Minimal copy of the already-applied deletion guard contract. The feature
  // migrations run after that migration and must add its trigger to new tables.
  await sql.exec(`alter table public.households add column deletion_requested_by uuid references auth.users(id);
   create table private.account_deletions(user_id uuid primary key references auth.users(id) on delete cascade);
   create or replace function private.is_member(p_household uuid) returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from public.household_members m join public.households h on h.id=m.household_id
     where m.household_id=p_household and m.user_id=auth.uid() and h.deletion_requested_by is null
     and not exists(select 1 from private.account_deletions where user_id=auth.uid()));
   $$;
   create function private.guard_deletion() returns trigger language plpgsql security definer set search_path='' as $$
   begin
    perform 1 from public.households where id=new.household_id for update;
    if exists(select 1 from public.households where id=new.household_id and deletion_requested_by is not null) then raise exception 'Family deletion pending'; end if;
    return new;
   end;$$;`)
  for(const file of ['20261114120000_tasks_academy.sql','20261114130000_push_notifications.sql'])await sql.exec(readFileSync('supabase/migrations/'+file,'utf8'))
  await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`);await user(a)
  const home=(await sql.query<{id:string}>("select public.create_household('A','Europe/Lisbon') id")).rows[0].id
  await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`);await user(a)
  const dog=(await sql.query<{id:string}>("insert into public.dogs(household_id,name,sex,activity_level) values($1,'Milo','unknown','moderate') returning id",[home])).rows[0].id
  const series=(await sql.query<{id:string}>("select public.save_household_task($1,null,'Water plants','',null,clock_timestamp()+interval '1 hour','daily',1,(clock_timestamp() at time zone 'Europe/Lisbon')::date+2) id",[home])).rows[0].id
  expect((await sql.query<{count:number}>("select count(*) count from public.task_occurrences where series_id=$1",[series])).rows[0].count).toBe(3)
  expect((await sql.query("select * from public.scheduled_notifications where category='task'")).rows).toHaveLength(3)
  const generated=await sql.query<{public:number}>("select public.generate_task_occurrences($1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '5 days') public",[home])
  expect(generated.rows[0].public).toBe(0)
  expect((await sql.query<{public:number}>("select public.generate_task_occurrences($1,clock_timestamp()-interval '1 day',clock_timestamp()+interval '5 days') public",[home])).rows[0].public).toBe(0)
  const first=(await sql.query<{id:string}>("select id from public.task_occurrences where series_id=$1 order by due_at limit 1",[series])).rows[0].id
  await user(b);await sql.query('select public.complete_household_task($1,true)',[first])
  await user(a);await expect(sql.query('select public.complete_household_task($1,false)',[first])).rejects.toThrow('Only the person')
  await sql.query("select public.save_academy_practice($1,$2,$3,'daily-care-check-in','{}','We noticed a calm moment',true)",[home,'20000000-0000-0000-0000-000000000001',dog])
  await user(b)
  expect((await sql.query('select * from public.academy_module_progress')).rows).toHaveLength(1)
  await sql.query("select public.save_academy_practice($1,$2,$3,'daily-care-check-in','{}','Practice again',true)",[home,'20000000-0000-0000-0000-000000000002',dog])
  expect((await sql.query('select * from public.academy_module_progress')).rows).toHaveLength(1)
  await expect(sql.query("select public.save_academy_practice($1,'20000000-0000-0000-0000-000000000001',$2,'daily-care-check-in','{}','Hijack',true,true)",[home,dog])).rejects.toThrow('Only your own')
  const ownSubscription=await sql.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/push/test','abcdefghijklmnopqrstuvwxyz1234567890','abcdefghijklmno123456')",[b])
  expect(ownSubscription.rowCount).toBe(1)
  await sql.query("insert into public.notification_preferences(user_id,category,enabled) values($1,'task',false)",[b])
  expect((await sql.query<{status:string}>("select status from public.scheduled_notifications where recipient_id=$1 and category='task'",[b])).rows.every(row=>row.status==='cancelled')).toBe(true)
  const queued=await sql.query<{public:number}>("select public.sync_household_notification($1,null,'health','appointment-123','reminder','Vet visit','Tomorrow','/health/appointments',clock_timestamp()+interval '1 day') public",[home])
  expect(queued.rows[0].public).toBe(2)
  const healthRows=await sql.query<{recipient_id:string;status:string}>("select recipient_id,status from public.scheduled_notifications where category='health' and source_id='health:appointment-123'")
  expect(healthRows.rows).toHaveLength(1)
  expect(healthRows.rows[0].recipient_id).toBe(b)
  expect(healthRows.rows[0].status).toBe('pending')
  await sql.exec('reset role')
  expect((await sql.query("select id from public.scheduled_notifications where category='health' and source_id='health:appointment-123' and status='pending'")).rows).toHaveLength(2)
  await user(b)
  const cancelled=await sql.query<{public:number}>("select public.cancel_household_notifications($1,'health','appointment-123') public",[home])
  expect(cancelled.rows[0].public).toBe(2)
  await expect(sql.query("select public.sync_household_notification($1,$2,'health','other','reminder','No','', '/health',now())",[home,c])).rejects.toThrow('current family member')
  await expect(sql.query("select public.sync_household_notification($1,null,'health','bad-route','reminder','No','', '/\\evil.example',now())",[home])).rejects.toThrow('Invalid notification details')
  await sql.exec(`reset role;update public.households set deletion_requested_by='${a}' where id='${home}'`)
  await expect(sql.query("insert into public.task_series(household_id,title,first_due_at) values($1,'Blocked during deletion',now())",[home])).rejects.toThrow('Family deletion pending')
  expect((await sql.query<{count:number}>("select count(*) count from pg_trigger where not tgisinternal and tgname='guard_deletion' and tgrelid in ('public.task_series'::regclass,'public.task_occurrences'::regclass,'public.academy_module_progress'::regclass,'public.academy_practice'::regclass,'public.scheduled_notifications'::regclass)")).rows[0].count).toBe(5)
  await sql.exec(`update public.households set deletion_requested_by=null where id='${home}'`);await user(b)
  const oldTask=(await sql.query<{id:string}>('select public.save_household_task($1,null,$2,\'\',null,clock_timestamp()+interval \'2 hours\',\'none\',1,null) id',[home,'Vet check'])).rows[0].id
  const oldOccurrence=(await sql.query<{id:string}>('select id from public.task_occurrences where series_id=$1',[oldTask])).rows[0].id
  await sql.exec('reset role')
  await sql.query("update public.task_occurrences set due_at=clock_timestamp()-interval '1 day' where id=$1",[oldOccurrence])
  await user(b)
  await sql.query("select public.save_household_task($1,$2,'Annual vet check','',null,clock_timestamp()+interval '3 hours','none',1,null)",[home,oldTask])
  expect((await sql.query<{title:string}>('select title from public.task_occurrences where id=$1',[oldOccurrence])).rows[0].title).toBe('Vet check')
  expect((await sql.query<{title:string}>("select title from public.task_occurrences where series_id=$1 and due_at>clock_timestamp()",[oldTask])).rows[0].title).toBe('Annual vet check')
  await expect(sql.query("insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://fcm.googleapis.com/push/other','abcdefghijklmnopqrstuvwxyz1234567890','abcdefghijklmno123456')",[a])).rejects.toThrow('new row violates row-level security')
  await expect(sql.query("insert into public.task_series(household_id,title,first_due_at) values($1,'Direct write',now())",[home])).rejects.toThrow()
  await user(c)
  const other=(await sql.query<{id:string}>("select public.create_household('Other','UTC') id")).rows[0].id
  const otherDog=(await sql.query<{id:string}>("insert into public.dogs(household_id,name,sex,activity_level) values($1,'Rex','unknown','moderate') returning id",[other])).rows[0].id
  await expect(sql.query("select public.save_academy_practice($1,$2,$3,'walking-basics','{}','Walk practice',true)",[other,'20000000-0000-0000-0000-000000000003',otherDog])).rejects.toThrow('previous lesson')
  expect((await sql.query('select * from public.task_series')).rows).toHaveLength(0)
  expect((await sql.query('select * from public.academy_practice')).rows).toHaveLength(0)
  await expect(sql.query("select public.generate_task_occurrences($1,'2026-11-14T00:00:00Z','2026-11-17T00:00:00Z')",[home])).rejects.toThrow('Family access denied')
  await sql.exec('reset role;set role anon')
  await expect(sql.query('select * from public.task_series')).rejects.toThrow()
 }finally{await sql.close()}
},30000)
