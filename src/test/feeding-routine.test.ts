import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll,afterAll,expect,it } from 'vitest'
import { countMealEvents } from '../features/feeding/model'
import type { FeedingEntry } from '../features/feeding/types'
const db=new PGlite()
const user='10000000-0000-0000-0000-000000000001',member='10000000-0000-0000-0000-000000000002',outsider='10000000-0000-0000-0000-000000000003'
const dry='20000000-0000-0000-0000-000000000001',wet='20000000-0000-0000-0000-000000000002'
const breakfast='40000000-0000-0000-0000-000000000001', dinner='40000000-0000-0000-0000-000000000002'
let home:string
const plan=[{id:breakfast,name:'Breakfast',time:'08:00',notes:'Mix well',items:[{product_id:dry,quantity_grams:100},{product_id:wet,quantity_grams:50}]},{id:dinner,name:'Dinner',time:'20:00',notes:'',items:[{product_id:dry,quantity_grams:100}]}]
async function asUser(id:string){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)}
beforeAll(async()=>{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 for(const file of ['202611070001_initial_schema.sql','20261111113735_feeding_and_stock.sql','20261111123255_detailed_feeding_routine.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
 await db.exec(`insert into auth.users(id,email) values('${user}','u@example.test'),('${member}','m@example.test'),('${outsider}','x@example.test')`)
 await asUser(user);home=(await db.query<{id:string}>("select public.create_household('Routine','UTC') id")).rows[0].id
 await db.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${member}','member')`);await asUser(user)
 await db.query("select public.save_food_product($1,$2,'Kibble','dry',100,0,1000,7)",[home,dry]);await db.query("select public.save_food_product($1,$2,'Wet','wet',50,0,1000,7)",[home,wet])
},30000)
afterAll(async()=>db.close())
it('saves shared names, times, quantities and notes; derives count and gap',async()=>{
 await asUser(member);await db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify(plan)])
 const s=(await db.query<{meals_per_day:number;warning_hours:number;meal_plan:typeof plan}>('select * from public.feeding_settings')).rows[0]
 expect(s.meals_per_day).toBe(2);expect(Number(s.warning_hours)).toBe(12);expect(s.meal_plan).toEqual(plan)
})
it('validates times, household products, quantities and duplicate products',async()=>{
 await expect(db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify([{...plan[0],time:'25:00'}])])).rejects.toThrow('valid time')
 await expect(db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify([{...plan[0],items:[{product_id:user,quantity_grams:1}]}])])).rejects.toThrow('household')
 await expect(db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify([{...plan[0],items:[{product_id:dry,quantity_grams:0}]}])])).rejects.toThrow('positive')
 await expect(db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify([{...plan[0],items:[plan[0].items[0],plan[0].items[0]]}])])).rejects.toThrow('once per meal')
})
it('records mixed food as one event and retries without extra deductions',async()=>{
 const id='50000000-0000-0000-0000-000000000001'
 for(let i=0;i<2;i++)await db.query('select public.record_feeding_meal($1,$2,$3::jsonb,now(),$4,false,$5)',[home,id,JSON.stringify(plan[0].items),'nfc',breakfast])
 const rows=(await db.query<FeedingEntry>("select * from public.feeding_entries where kind='meal'")).rows
 expect(rows).toHaveLength(2);expect(countMealEvents(rows)).toBe(1)
 expect(rows.reduce((sum,e)=>sum+Number(e.quantity_grams),0)).toBe(150)
 expect(rows.every(e=>e.source==='nfc')).toBe(true)
})
it('warns for another event but permits explicit extra meals',async()=>{
 await expect(db.query('select public.record_feeding_meal($1,gen_random_uuid(),$2::jsonb,now())',[home,JSON.stringify(plan[1].items)])).rejects.toThrow('DUPLICATE_MEAL')
 await db.query('select public.record_feeding_meal($1,gen_random_uuid(),$2::jsonb,now(),$3,true)',[home,JSON.stringify(plan[1].items),'app'])
})
it('rolls back every product line if any line lacks stock',async()=>{
 const before=(await db.query('select id from public.feeding_entries')).rows.length
 await expect(db.query('select public.record_feeding_meal($1,gen_random_uuid(),$2::jsonb,now(),$3,true)',[home,JSON.stringify([{product_id:dry,quantity_grams:1},{product_id:wet,quantity_grams:99999}]),'app'])).rejects.toThrow('Not enough')
 expect((await db.query('select id from public.feeding_entries')).rows).toHaveLength(before)
})
it('keeps own-activity permissions when correcting a mixed meal',async()=>{
 const e=(await db.query<FeedingEntry>("select * from public.feeding_entries where kind='meal' limit 1")).rows[0]
 await asUser(user)
 await expect(db.query('select public.save_feeding_entry($1,$2,$3,$4,10,now())',[home,e.id,e.product_id,'meal'])).rejects.toThrow('own feeding')
})
it('blocks outsider plan/meal writes and plan/event reads',async()=>{
 await asUser(outsider)
 expect((await db.query('select * from public.feeding_settings')).rows).toHaveLength(0)
 expect((await db.query('select * from public.feeding_meal_events')).rows).toHaveLength(0)
 await expect(db.query('select public.save_feeding_plan($1,$2::jsonb)',[home,JSON.stringify(plan)])).rejects.toThrow('access denied')
 await expect(db.query('select public.record_feeding_meal($1,gen_random_uuid(),$2::jsonb,now())',[home,JSON.stringify(plan[0].items)])).rejects.toThrow('access denied')
})
