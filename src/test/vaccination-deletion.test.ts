import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
it('allows current members to delete and denies outsiders, former members and anonymous users',async()=>{
 const sql=new PGlite()
 const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002', c='10000000-0000-0000-0000-000000000003'
 const asUser=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
 await sql.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 for(const file of ['202611070001_initial_schema.sql','202611110004_vaccinations.sql','20261111220004_vaccination_deletion.sql'])await sql.exec(readFileSync('supabase/migrations/'+file,'utf8'))
 await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`)
 await asUser(a)
 const home=(await sql.query<{id:string}>("select public.create_household('A','Europe/Lisbon') id")).rows[0].id
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`)
 await asUser(c)
 const other=(await sql.query<{id:string}>("select public.create_household('B','UTC') id")).rows[0].id
 await asUser(a)
 const visit=(await sql.query<{id:string}>("insert into public.vaccinations(household_id,name,given_on) values($1,'Checkup','2020-01-01') returning id",[home])).rows[0].id
 await expect(sql.query("insert into public.vaccinations(household_id,name,given_on) values($1,'Bad','2020-01-01')",[other])).rejects.toThrow()
 await asUser(b)
 expect((await sql.query('select * from public.vaccinations')).rows).toHaveLength(1)
 const updated=await sql.query<{updated_by:string;created_by:string}>("update public.vaccinations set name='Edited' where id=$1 returning updated_by,created_by",[visit])
 expect(updated.rows[0]).toEqual({updated_by:b,created_by:a})
 await sql.query("insert into public.vaccinations(household_id,name,given_on) values($1,'Member visit','2020-01-01')",[home])
 for(const change of ['household_id','created_by','updated_by'])await expect(sql.query(`update public.vaccinations set ${change}=$1 where id=$2`,[c,visit])).rejects.toThrow()
 await asUser(c)
 expect((await sql.query('delete from public.vaccinations where id=$1 returning id',[visit])).rows).toHaveLength(0)
 expect((await sql.query('select * from public.vaccinations')).rows).toHaveLength(0)
 expect((await sql.query("update public.vaccinations set name='Intrusion' where id=$1 returning id",[visit])).rows).toHaveLength(0)
 await asUser(b)
 expect((await sql.query('delete from public.vaccinations where id=$1 returning id',[visit])).rows).toHaveLength(1)
 const remaining=(await sql.query<{id:string}>('select id from public.vaccinations')).rows[0].id
 await sql.exec(`reset role;delete from public.household_members where user_id='${b}'`)
 await asUser(b)
 expect((await sql.query('delete from public.vaccinations where id=$1 returning id',[remaining])).rows).toHaveLength(0)
 await sql.exec('reset role;set role anon')
 await expect(sql.query('delete from public.vaccinations')).rejects.toThrow()
 await asUser(a)
 expect((await sql.query('delete from public.vaccinations where id=$1 returning id',[remaining])).rows).toHaveLength(1)
 }finally{await sql.close()}
},30000)
