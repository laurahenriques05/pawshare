import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { doseStatus } from '../features/health/MedicationsPage'
import type { MedicationDose } from '../lib/supabase/database.types'
it('derives overdue only for unlogged doses',()=>{
 const dose={status:'scheduled',scheduled_at:'2026-01-01T10:00Z'} as MedicationDose
 expect(doseStatus(dose,Date.parse('2026-01-01T11:00Z'))).toBe('overdue')
 expect(doseStatus({...dose,status:'given'},Date.now())).toBe('given')
 expect(doseStatus(dose,0)).toBe('scheduled')
})
it('enforces medication privacy, shared scheduling, atomic dose ownership and validation',async()=>{
 const sql=new PGlite();const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',c='10000000-0000-0000-0000-000000000003'
 const user=async(id:string)=>sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
 try{
 await sql.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 for(const f of ['202611070001_initial_schema.sql','202611110003_medications.sql'])await sql.exec(readFileSync('supabase/migrations/'+f,'utf8'))
 await sql.exec(`insert into auth.users(id) values('${a}'),('${b}'),('${c}')`);await user(a)
 const home=(await sql.query<{id:string}>("select public.create_household('A','Europe/Lisbon') id")).rows[0].id
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${b}','member')`);await user(a)
 await expect(sql.query("select public.save_medication_schedule($1,null,'','Instructions',array[now()])",[home])).rejects.toThrow()
 await expect(sql.query("select public.save_medication_schedule($1,null,'Name','',array[now()])",[home])).rejects.toThrow()
 await expect(sql.query("select public.save_medication_schedule($1,null,'Name','Instructions',array[]::timestamptz[])",[home])).rejects.toThrow()
 const schedule=(await sql.query<{id:string}>("select public.save_medication_schedule($1,null,'Prescription','Vet instructions',array['2026-01-01T09:00Z'::timestamptz]) id",[home])).rows[0].id
 const dose=(await sql.query<{id:string}>('select id from public.medication_doses')).rows[0].id
 await user(b)
 await sql.query("select public.save_medication_schedule($1,$2,'Updated','Updated instructions',array['2026-01-01T09:00Z'::timestamptz])",[home,schedule])
 expect((await sql.query('select * from public.medication_doses')).rows).toHaveLength(1)
 await sql.query("select public.reschedule_medication_dose($1,'2026-01-01T10:00Z')",[dose])
 await expect(sql.query("select public.log_medication_dose($1,'given',clock_timestamp()+interval '1 day','')",[dose])).rejects.toThrow('future')
 await expect(sql.query("select public.log_medication_dose($1,'given',null,'')",[dose])).rejects.toThrow()
 await sql.query("select public.log_medication_dose($1,'given','2026-01-01T10:05Z','Done')",[dose])
 await user(a)
 await expect(sql.query("select public.log_medication_dose($1,'given',now(),'')",[dose])).rejects.toThrow('another member')
 await expect(sql.query("select public.reschedule_medication_dose($1,now())",[dose])).rejects.toThrow('Logged doses')
 await expect(sql.query("update public.medication_doses set status='given'")).rejects.toThrow('permission denied')
 await user(b)
 await sql.query("select public.log_medication_dose($1,'skipped',null,'Correction')",[dose])
 const corrected=(await sql.query<{status:string;administered_at:null;recorded_by:string}>('select status,administered_at,recorded_by from public.medication_doses')).rows[0]
 expect(corrected).toEqual({status:'skipped',administered_at:null,recorded_by:b})
 await user(c)
 expect((await sql.query('select * from public.medication_schedules')).rows).toHaveLength(0)
 expect((await sql.query('select * from public.medication_doses')).rows).toHaveLength(0)
 await expect(sql.query("select public.save_medication_schedule($1,null,'Bad','Bad',array[now()])",[home])).rejects.toThrow('denied')
 await expect(sql.query("select public.log_medication_dose($1,'given',now(),'')",[dose])).rejects.toThrow('denied')
 await sql.exec(`reset role;delete from public.household_members where user_id='${b}'`);await user(b)
 expect((await sql.query('select * from public.medication_doses')).rows).toHaveLength(0)
 await expect(sql.query("select public.log_medication_dose($1,'given',now(),'')",[dose])).rejects.toThrow('denied')
 await sql.exec('reset role;set role anon')
 await expect(sql.query('select * from public.medication_doses')).rejects.toThrow()
 await expect(sql.query("select public.log_medication_dose($1,'given',now(),'')",[dose])).rejects.toThrow()
 }finally{await sql.close()}
},30000)
