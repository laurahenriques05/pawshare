import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
const sql=new PGlite()
const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',c='10000000-0000-0000-0000-000000000003'
let home:string,dog:string,walk:string,start:string
async function asUser(id:string){await sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)}
async function points(){return (await sql.query('select * from public.walk_points')).rows}
beforeAll(async()=>{
 await sql.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/202611110001_walks.sql','utf8'))
 await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`)
 await asUser(a)
 home=(await sql.query<{id:string}>("select public.create_household('Walk home','Europe/Lisbon') id")).rows[0].id
 dog=(await sql.query<{id:string}>("insert into public.dogs(household_id,name) values($1,'Pippin') returning id",[home])).rows[0].id
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`)
 await asUser(a)
},30000)
afterAll(()=>sql.close())
describe('walk RPCs and database privacy',()=>{
 it('starts idempotently and prevents competing family walks',async()=>{
  const first=(await sql.query<{id:string;started_at:string}>('select id,started_at::text from public.start_walk($1)',[dog])).rows[0];walk=first.id;start=first.started_at
  expect((await sql.query<{id:string}>('select id from public.start_walk($1)',[dog])).rows[0].id).toBe(walk)
  await asUser(b);await expect(sql.query('select public.start_walk($1)',[dog])).rejects.toThrow('already walking')
  await asUser(c);await expect(sql.query('select public.start_walk($1)',[dog])).rejects.toThrow('access denied')
 })
 it('accepts ordered GPS batches, retries safely, rejects conflicts, invalid and future points',async()=>{
  await asUser(a)
  // Place GPS samples in the past to test real server-side distance calculations.
  await sql.exec(`reset role;update public.walks set started_at=clock_timestamp()-interval '10 minutes' where id='${walk}'`)
  await asUser(a)
  start=(await sql.query<{t:string}>('select started_at::text t from public.walks where id=$1',[walk])).rows[0].t
  const t=Date.parse(start)
  const route=[{seq:0,recorded_at:new Date(t+1000).toISOString(),latitude:38,longitude:-9,accuracy:5},{seq:1,recorded_at:new Date(t+11000).toISOString(),latitude:38.0001,longitude:-9,accuracy:5},{seq:2,recorded_at:new Date(t+131000).toISOString(),latitude:38.002,longitude:-9,accuracy:5},{seq:3,recorded_at:new Date(t+141000).toISOString(),latitude:39,longitude:-9,accuracy:5}]
  expect((await sql.query<{n:number}>('select public.append_walk_points($1,$2::jsonb) n',[walk,JSON.stringify(route)])).rows[0].n).toBe(4)
  expect((await sql.query<{n:number}>('select public.append_walk_points($1,$2::jsonb) n',[walk,JSON.stringify(route)])).rows[0].n).toBe(0)
  await expect(sql.query('select public.append_walk_points($1,$2::jsonb)',[walk,JSON.stringify([{...route[0],latitude:40}])])).rejects.toThrow('sequence conflict')
  for(const bad of [{seq:5,recorded_at:new Date(t+151000).toISOString(),latitude:38,longitude:-9,accuracy:5},{seq:4,recorded_at:new Date(t+151000).toISOString(),latitude:91,longitude:-9,accuracy:5},{seq:4,recorded_at:new Date(t+151000).toISOString(),latitude:38,longitude:-9,accuracy:100},{seq:4,recorded_at:new Date(Date.now()+60000).toISOString(),latitude:38,longitude:-9,accuracy:5}]) {
   await expect(sql.query('select public.append_walk_points($1,$2::jsonb)',[walk,JSON.stringify([bad])])).rejects.toThrow()
  }
  expect(await points()).toHaveLength(4)
 })
 it('hides ongoing coordinates from another member and blocks every unauthorized mutation',async()=>{
  await asUser(b);expect((await sql.query('select * from public.walks')).rows).toHaveLength(1);expect(await points()).toHaveLength(0)
  await expect(sql.query("select public.append_walk_points($1,'[]')",[walk])).rejects.toThrow('Walker access')
  await expect(sql.query('select public.finish_walk($1,clock_timestamp())',[walk])).rejects.toThrow('Walker access')
  await expect(sql.query("select public.correct_walk($1,clock_timestamp(),clock_timestamp(),'x')",[walk])).rejects.toThrow('Walker access')
  await expect(sql.query('select public.set_walk_deleted($1,true)',[walk])).rejects.toThrow('Walker access')
  await expect(sql.query('update public.walks set walker_id=$1 where id=$2',[b,walk])).rejects.toThrow('permission denied')
  await expect(sql.query('insert into public.walk_points(walk_id,seq,recorded_at,latitude,longitude,accuracy) values($1,100,clock_timestamp(),0,0,1)',[walk])).rejects.toThrow('permission denied')
 })
 it('isolates other households and anonymous users',async()=>{
  await asUser(c);expect((await sql.query('select * from public.walks')).rows).toHaveLength(0);expect(await points()).toHaveLength(0)
  await expect(sql.query('select public.finish_walk($1,clock_timestamp())',[walk])).rejects.toThrow('Walker access')
  await sql.exec('reset role;set role anon')
  await expect(sql.query('select * from public.walks')).rejects.toThrow('permission denied')
  await expect(sql.query('select * from public.walk_points')).rejects.toThrow('permission denied')
  await expect(sql.query('select public.start_walk($1)',[dog])).rejects.toThrow('permission denied')
 })
 it('finishes idempotently, computes distance without bridging gaps or jumps, and shares the finished route',async()=>{
  await asUser(a)
  await expect(sql.query("select public.finish_walk($1,clock_timestamp(),'invalid')",[walk])).rejects.toThrow('Invalid end')
  await expect(sql.query('select public.finish_walk($1,$2)',[walk,start])).rejects.toThrow('Invalid end')
  const result=(await sql.query<{distance_m:number;ended_at:string}>('select distance_m,ended_at::text from public.finish_walk($1,clock_timestamp())',[walk])).rows[0]
  expect(result.distance_m).toBeCloseTo(11.1195,2)
  expect((await sql.query<{t:string}>('select ended_at::text t from public.finish_walk($1,clock_timestamp())',[walk])).rows[0].t).toBe(result.ended_at)
  await expect(sql.query("select public.append_walk_points($1,'[]')",[walk])).rejects.toThrow('no longer active')
  await asUser(b);expect(await points()).toHaveLength(4)
 })
 it('only allows recorder corrections and keeps time bounds around recorded points',async()=>{
  await asUser(a)
  await expect(sql.query("select public.correct_walk($1,clock_timestamp(),clock_timestamp(),'bad')",[walk])).rejects.toThrow('Times must include')
  const corrected=(await sql.query<{notes:string}>("select notes from public.correct_walk($1,$2,clock_timestamp(),'  A good sniff  ')",[walk,start])).rows[0]
  expect(corrected.notes).toBe('A good sniff')
  await asUser(b);await expect(sql.query("select public.correct_walk($1,$2,clock_timestamp(),'bad')",[walk,start])).rejects.toThrow('Walker access')
 })
 it('supports reversible deletion, hides deleted routes and allows a new walk',async()=>{
  await asUser(a);await sql.query('select public.set_walk_deleted($1,true)',[walk]);expect(await points()).toHaveLength(0)
  expect((await sql.query('select * from public.walks')).rows).toHaveLength(1)
  await asUser(b);expect((await sql.query('select * from public.walks')).rows).toHaveLength(0)
  await asUser(a);await sql.query('select public.set_walk_deleted($1,false)',[walk]);expect(await points()).toHaveLength(4)
  const next=(await sql.query<{id:string}>('select id from public.start_walk($1)',[dog])).rows[0].id
  expect(next).not.toBe(walk)
  await expect(sql.query('select public.set_walk_deleted($1,true)',[next])).rejects.toThrow('Finish the walk')
 })
 it('revokes former members access to routes and RPCs',async()=>{
  await sql.exec(`reset role;delete from public.household_members where user_id='${a}'`)
  await asUser(a);expect(await points()).toHaveLength(0);expect((await sql.query('select * from public.walks')).rows).toHaveLength(0)
  await expect(sql.query('select public.set_walk_deleted($1,true)',[walk])).rejects.toThrow('Walker access')
 })
})
