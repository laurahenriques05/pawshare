import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect,it } from 'vitest'
it('enforces shared health permissions and synchronizes profile weight with newest measurement',async()=>{
 const sql=new PGlite();const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',c='10000000-0000-0000-0000-000000000003';const user=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
 await sql.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;grant select on storage.objects to anon;`)
 for(const f of ['202611070001_initial_schema.sql','20261111220000_health_records.sql','20261111220001_health_documents.sql'])await sql.exec(readFileSync('supabase/migrations/'+f,'utf8'))
 await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`);await user(a)
 const home=(await sql.query<{id:string}>("select public.create_household('Home','Europe/Lisbon') id")).rows[0].id
 await sql.query("insert into public.dogs(household_id,name,weight_kg) values($1,'Dog',10)",[home]);expect((await sql.query('select * from public.weight_measurements')).rows).toHaveLength(1)
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`);await user(b)
 const weight=async()=>Number((await sql.query<{weight_kg:number}>('select weight_kg from public.dogs')).rows[0].weight_kg)
 await sql.query('insert into public.weight_measurements(household_id,weight_kg,measured_at) values($1,8,$2)',[home,'2020-01-01T10:00Z']);expect(await weight()).toBe(10)
 await sql.query('update public.dogs set weight_kg=11');expect(await weight()).toBe(11);expect((await sql.query('select * from public.weight_measurements')).rows).toHaveLength(3)
 await expect(sql.query('update public.dogs set weight_kg=null')).rejects.toThrow('history')
 await expect(sql.query("insert into public.weight_measurements(household_id,weight_kg,measured_at) values($1,20,clock_timestamp()+interval '1 day')",[home])).rejects.toThrow('future')
 const treatment=(await sql.query<{id:string}>("insert into public.treatments(household_id,title,occurred_on) values($1,'Treatment','2020-01-01') returning id",[home])).rows[0].id
 await sql.query("insert into public.vet_contacts(household_id,name) values($1,'Clinic')",[home]);await user(a);await sql.query("update public.treatments set notes='Shared edit' where id=$1",[treatment])
 const path=`${home}/${b}/00000000-0000-0000-0000-000000000001--sample.pdf`;await user(b);await sql.query("insert into storage.objects(bucket_id,name) values('health-documents',$1)",[path]);await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${c}','member')`);await user(c);expect((await sql.query('select * from storage.objects')).rows).toHaveLength(1);expect((await sql.query('delete from storage.objects where name=$1 returning id',[path])).rows).toHaveLength(0);await sql.exec(`reset role;delete from public.household_members where user_id='${c}'`);await user(a);expect((await sql.query('select * from storage.objects')).rows).toHaveLength(1)
 await expect(sql.query("insert into storage.objects(bucket_id,name) values('health-documents',$1)",[path+'other'])).rejects.toThrow()
 expect((await sql.query('delete from storage.objects where name=$1 returning id',[path])).rows).toHaveLength(1)
 await user(c);for(const table of ['treatments','vet_contacts','weight_measurements']){expect((await sql.query('select * from public.'+table)).rows).toHaveLength(0);await expect(sql.query('delete from public.'+table)).rejects.toThrow()}
 await expect(sql.query("insert into public.vet_contacts(household_id,name) values($1,'Foreign')",[home])).rejects.toThrow()
 await sql.exec(`reset role;delete from public.household_members where user_id='${b}'`);await user(b);expect((await sql.query('select * from public.weight_measurements')).rows).toHaveLength(0)
 await expect(sql.query("insert into storage.objects(bucket_id,name) values('health-documents',$1)",[path])).rejects.toThrow()
 await sql.exec('reset role;set role anon');await expect(sql.query('select * from public.treatments')).rejects.toThrow()
 }finally{await sql.close()}
},30000)
