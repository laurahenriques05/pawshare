import { PGlite } from '@electric-sql/pglite'
import { readFileSync,readdirSync } from 'node:fs'
import { expect,it } from 'vitest'
it('tests coordinated deletion using disposable data, preserves history and rejects unauthorized requests',async()=>{
 const sql=new PGlite();const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',c='10000000-0000-0000-0000-000000000003';const user=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
 await sql.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,update,delete on storage.objects to authenticated;`)
 for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await sql.exec(readFileSync('supabase/migrations/'+f,'utf8'))
 await sql.exec(`insert into auth.users(id,email,email_confirmed_at) values('${a}','a@example.test',now()),('${b}','b@example.test',now()),('${c}','c@example.test',now())`);await user(a)
 const home=(await sql.query<{id:string}>("select public.create_household('Keep','UTC') id")).rows[0].id
 await sql.query("insert into public.dogs(household_id,name) values($1,'Dog')",[home]);await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`);await user(b)
 await sql.query("insert into public.treatments(household_id,title,occurred_on) values($1,'Keep history','2020-01-01')",[home])
 const schedule=(await sql.query<{id:string}>("select public.save_medication_schedule($1,null,'Medication','Instructions',array[now()]) id",[home])).rows[0].id
 const dose=(await sql.query<{id:string}>('select id from public.medication_doses where schedule_id=$1',[schedule])).rows[0].id
 await sql.query("select public.log_medication_dose($1,'given',clock_timestamp(),'')",[dose])
 await expect(sql.query("select public.begin_account_deletion('DELETE MY ACCOUNT')")).rejects.toThrow('Leave all families')
 await expect(sql.query("select public.begin_household_deletion($1,'Keep')",[home])).rejects.toThrow('Owner')
 await user(a);await expect(sql.query("select public.begin_household_deletion($1,'Keep')",[home])).rejects.toThrow('sole')
 await user(b);await sql.query('select public.leave_household($1,null)',[home]);await sql.query("select public.begin_account_deletion('DELETE MY ACCOUNT')")
 await expect(sql.query("select public.create_household('Blocked','UTC')")).rejects.toThrow('pending')
 await expect(sql.query('select public.prepare_auth_deletion($1)',[b])).rejects.toThrow('permission')
 await sql.exec(`reset role;select set_config('request.jwt.claim.sub','',false);insert into storage.objects(bucket_id,name,owner,owner_id) values('health-documents','${home}/${b}/file.pdf','${b}','${b}');set role service_role`)
 await sql.query('select public.prepare_auth_deletion($1)',[b]);await sql.exec(`reset role;delete from auth.users where id='${b}'`)
 expect((await sql.query<{created_by:null}>('select created_by from public.treatments')).rows[0].created_by).toBeNull()
 expect((await sql.query<{owner_id:null}>('select owner_id from storage.objects')).rows[0].owner_id).toBeNull()
 await user(b);expect((await sql.query('select * from public.treatments')).rows).toHaveLength(0);await user(a);await expect(sql.query("select public.log_medication_dose($1,'given',now(),'')",[dose])).rejects.toThrow('another member')
 const removed=(await sql.query<{id:string}>("select public.create_household('Ignored','UTC') id")).rows[0].id;expect(removed).toBe(home)
 await sql.query("select public.begin_household_deletion($1,'Keep')",[home]);expect((await sql.query('select * from public.households')).rows).toHaveLength(0)
 await user(c);await expect(sql.query("select public.begin_household_deletion($1,'Keep')",[home])).rejects.toThrow('Owner')
 await expect(sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${c}','member')`)).rejects.toThrow('pending')
 await sql.exec('reset role;set role service_role');await sql.query('select public.finalize_household_deletion($1,$2)',[home,a])
 await sql.exec('reset role');expect((await sql.query('select * from public.treatments')).rows).toHaveLength(0);expect((await sql.query('select * from auth.users')).rows).toHaveLength(2)
 }finally{await sql.close()}
},30000)
