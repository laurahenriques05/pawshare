import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll,afterAll,expect,it } from 'vitest'
import { todayChecklist } from '../features/feeding/checklist'
import type { MealEvent,PlannedMeal } from '../features/feeding/types'
const db=new PGlite()
const user='10000000-0000-0000-0000-000000000001',member='10000000-0000-0000-0000-000000000002',outsider='10000000-0000-0000-0000-000000000003'
const food='20000000-0000-0000-0000-000000000001',event='50000000-0000-0000-0000-000000000001',skip='50000000-0000-0000-0000-000000000002'
let home:string
async function asUser(id:string){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)}
async function save(id:string,outcome:string,quantity=100,eaten=100,remove=false){return db.query("select public.save_meal_result($1,$2,$3::jsonb,now(),'app',true,null,$4,'Appetite note',$5)",[home,id,JSON.stringify(outcome==='skipped'?[]:[{product_id:food,quantity_grams:quantity,eaten_grams:eaten}]),outcome,remove])}
async function balance(){return Number((await db.query<{n:number}>(`select p.opening_grams-coalesce((select sum(quantity_grams) from public.feeding_entries where product_id=p.id and deleted_at is null),0) n from public.food_products p where id=$1`,[food])).rows[0].n)}
beforeAll(async()=>{
 await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 for(const file of ['202611070001_initial_schema.sql','20261111113735_feeding_and_stock.sql','20261111123255_detailed_feeding_routine.sql','20261111130122_feeding_checklist_outcomes.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'))
 await db.exec(`insert into auth.users(id,email) values('${user}','u@example.test'),('${member}','m@example.test'),('${outsider}','x@example.test')`)
 await asUser(user);home=(await db.query<{id:string}>("select public.create_household('Outcomes','UTC') id")).rows[0].id
 await db.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${member}','member')`);await asUser(user)
 await db.query("select public.save_food_product($1,$2,'Kibble','dry',100,0,1000,7)",[home,food])
},30000)
afterAll(async()=>db.close())
it('tracks partial consumption while deducting the full amount served',async()=>{
 await save(event,'partial',100,40);expect(await balance()).toBe(900)
 const e=(await db.query<{eaten_grams:number}>("select eaten_grams from public.feeding_entries where deleted_at is null")).rows[0]
 expect(Number(e.eaten_grams)).toBe(40)
})
it('retries and corrections never deduct twice',async()=>{
 await save(event,'partial',100,40);expect(await balance()).toBe(900)
 await save(event,'refused',100,0);expect(await balance()).toBe(900)
 await save(event,'given',120,120);expect(await balance()).toBe(880)
})
it('records skipped meals without reducing stock and retains notes',async()=>{
 await save(skip,'skipped');expect(await balance()).toBe(880)
 const row=(await db.query<MealEvent>('select * from public.feeding_meal_events where id=$1',[skip])).rows[0]
 expect(row.outcome).toBe('skipped');expect(row.notes).toBe('Appetite note')
})
it('rejects invalid consumption/outcome pairs without changing stock',async()=>{
 await expect(save(event,'partial',100,120)).rejects.toThrow('between zero')
 await expect(save(event,'partial',100,100)).rejects.toThrow('partially eaten')
 await expect(save(event,'refused',100,10)).rejects.toThrow('outcome')
 expect(await balance()).toBe(880)
})
it('only the author can correct or remove results',async()=>{
 await asUser(member)
 await expect(save(event,'given')).rejects.toThrow('own feeding activities')
 await expect(save(event,'given',100,100,true)).rejects.toThrow('own feeding activities')
 expect((await db.query('select id from public.feeding_meal_events')).rows).toHaveLength(2)
 await asUser(user)
})
it('removes the entire result and restores stock exactly once',async()=>{
 await save(event,'given',100,100,true);await save(event,'given',100,100,true)
 expect(await balance()).toBe(1000)
 expect((await db.query<MealEvent>('select * from public.feeding_meal_events where id=$1',[event])).rows[0].deleted_at).not.toBeNull()
})
it('hides household results from outsiders',async()=>{
 await asUser(outsider)
 expect((await db.query('select * from public.feeding_meal_events')).rows).toHaveLength(0)
 await expect(save(event,'given')).rejects.toThrow('access denied')
})
it('builds due/upcoming/fed states using household-local dates and excludes removed results',()=>{
 const plan:PlannedMeal[]=[{id:'a',name:'Breakfast',time:'08:00',notes:'',items:[]},{id:'b',name:'Dinner',time:'20:00',notes:'',items:[]}]
 const e={id:'e',routine_meal_id:'a',occurred_at:'2026-11-11T08:05:00Z',outcome:'given',deleted_at:null} as MealEvent
 expect(todayChecklist(plan,[],'Europe/Lisbon',new Date('2026-11-11T12:00:00Z')).map(r=>r.status)).toEqual(['Due','Upcoming'])
 expect(todayChecklist(plan,[e],'Europe/Lisbon',new Date('2026-11-11T12:00:00Z')).map(r=>r.status)).toEqual(['Fed','Upcoming'])
 expect(todayChecklist(plan,[e],'America/Los_Angeles',new Date('2026-11-12T00:30:00Z'))[0].status).toBe('Fed')
 expect(todayChecklist(plan,[{...e,deleted_at:'2026-11-11'}],'Europe/Lisbon',new Date('2026-11-11T12:00:00Z'))[0].status).toBe('Due')
})
