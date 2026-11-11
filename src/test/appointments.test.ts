import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { localTime, toInstant } from '../features/health/time'
it('converts family time independently of the browser and rejects DST gaps and overlaps',()=>{
 expect(toInstant('2026-07-10T10:00','Europe/Lisbon')).toBe('2026-07-10T09:00:00.000Z')
 expect(localTime('2026-01-10T10:00:00Z','Europe/Lisbon')).toBe('2026-01-10T10:00')
 expect(()=>toInstant('2026-03-29T01:30','Europe/Lisbon')).toThrow()
 expect(()=>toInstant('2026-10-25T01:30','Europe/Lisbon')).toThrow()
 expect(()=>toInstant('2026-02-30T10:00','Europe/Lisbon')).toThrow()
})
it('enforces real RLS, shared editing, audit integrity and former-member isolation',async()=>{
 const sql=new PGlite()
 const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002', c='10000000-0000-0000-0000-000000000003'
 const asUser=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
 await sql.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 for(const file of ['202611070001_initial_schema.sql','202611110002_vet_appointments.sql'])await sql.exec(readFileSync('supabase/migrations/'+file,'utf8'))
 await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`)
 await asUser(a)
 const home=(await sql.query<{id:string}>("select public.create_household('A','Europe/Lisbon') id")).rows[0].id
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`)
 await asUser(c)
 const other=(await sql.query<{id:string}>("select public.create_household('B','UTC') id")).rows[0].id
 await asUser(a)
 const visit=(await sql.query<{id:string}>("insert into public.vet_appointments(household_id,title,starts_at) values($1,'Checkup','2026-12-01T10:00Z') returning id",[home])).rows[0].id
 await expect(sql.query("insert into public.vet_appointments(household_id,title,starts_at) values($1,'Bad',now())",[other])).rejects.toThrow()
 await asUser(b)
 expect((await sql.query('select * from public.vet_appointments')).rows).toHaveLength(1)
 const updated=await sql.query<{updated_by:string;created_by:string}>("update public.vet_appointments set title='Edited' where id=$1 returning updated_by,created_by",[visit])
 expect(updated.rows[0]).toEqual({updated_by:b,created_by:a})
 await sql.query("insert into public.vet_appointments(household_id,title,starts_at) values($1,'Member visit',now())",[home])
 for(const change of ['household_id','created_by','updated_by'])await expect(sql.query(`update public.vet_appointments set ${change}=$1 where id=$2`,[c,visit])).rejects.toThrow()
 await expect(sql.query('delete from public.vet_appointments')).rejects.toThrow()
 await expect(sql.query("update public.vet_appointments set title='' where id=$1",[visit])).rejects.toThrow()
 await asUser(c)
 expect((await sql.query('select * from public.vet_appointments')).rows).toHaveLength(0)
 expect((await sql.query("update public.vet_appointments set title='Intrusion' where id=$1 returning id",[visit])).rows).toHaveLength(0)
 await sql.exec(`reset role;delete from public.household_members where user_id='${b}'`)
 await asUser(b)
 expect((await sql.query('select * from public.vet_appointments')).rows).toHaveLength(0)
 await expect(sql.query("insert into public.vet_appointments(household_id,title,starts_at) values($1,'Former',now())",[home])).rejects.toThrow()
 await sql.exec('reset role;set role anon')
 await expect(sql.query('select * from public.vet_appointments')).rejects.toThrow()
 }finally{await sql.close()}
},30000)
