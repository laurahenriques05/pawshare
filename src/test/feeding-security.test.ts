import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
const sql = new PGlite()
const owner='10000000-0000-0000-0000-000000000001', member='10000000-0000-0000-0000-000000000002', outsider='10000000-0000-0000-0000-000000000003'
const product='20000000-0000-0000-0000-000000000001', treat='20000000-0000-0000-0000-000000000002', purchase='30000000-0000-0000-0000-000000000001', meal='30000000-0000-0000-0000-000000000002'
let home:string, other:string
const time=new Date(Date.now()-3600000).toISOString()
async function asUser(id:string) { await sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`) }
async function save(id:string,p=product,kind='meal',quantity=100,allow=false,remove=false,house=home) {
 return sql.query('select public.save_feeding_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[house,id,p,kind,quantity,time,kind==='purchase'?quantity/2:null,kind==='purchase'?2:null,'app',allow,remove])
}
async function balance() { return Number((await sql.query<{value:number}>(`select opening_grams+coalesce((select sum(case when kind='purchase' then quantity_grams else -quantity_grams end) from public.feeding_entries where product_id=$1 and deleted_at is null),0) value from public.food_products where id=$1`,[product])).rows[0].value) }
beforeAll(async()=>{
 await sql.exec(`create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/20261111113735_feeding_and_stock.sql','utf8'))
 await sql.exec(`insert into auth.users(id,email) values('${owner}','o@example.test'),('${member}','m@example.test'),('${outsider}','x@example.test')`)
 await asUser(owner);home=(await sql.query<{id:string}>("select public.create_household('Food home','UTC') id")).rows[0].id
 await sql.exec(`reset role;insert into public.household_members(household_id,user_id,role) values('${home}','${member}','member')`)
 await asUser(outsider);other=(await sql.query<{id:string}>("select public.create_household('Other home','UTC') id")).rows[0].id
 await asUser(owner)
},30000)
afterAll(async()=>sql.close())
describe('Feeding permissions and atomic stock ledger',()=>{
 it('creates products and routine as a household member',async()=>{
  await asUser(member)
  await sql.query("select public.save_food_product($1,$2,'Kibble','dry',100,200,100,7)",[home,product])
  await sql.query("select public.save_food_product($1,$2,'Treats','treat',5,0,100,7)",[home,treat])
  await sql.query('select public.save_feeding_settings($1,2)',[home])
  expect(await balance()).toBe(100)
 })
 it('records multiple packages exactly once on retry',async()=>{
  await save(purchase,product,'purchase',2000);await save(purchase,product,'purchase',2000)
  expect(await balance()).toBe(2100)
  expect((await sql.query('select id from public.feeding_entries')).rows).toHaveLength(1)
 })
 it('deducts meals once and restores/recalculates quantities on edits',async()=>{
  await save(meal);await save(meal)
  expect(await balance()).toBe(2000)
  await save(meal,product,'meal',150)
  expect(await balance()).toBe(1950)
 })
 it('warns about recent regular meals but permits explicit override',async()=>{
  await expect(save('30000000-0000-0000-0000-000000000003')).rejects.toThrow('DUPLICATE_MEAL')
  await save('30000000-0000-0000-0000-000000000003',product,'meal',100,true)
  expect(await balance()).toBe(1850)
 })
 it('keeps treats separate from regular meal warnings',async()=>{
  await save('30000000-0000-0000-0000-000000000004',treat,'meal',5)
  await save('30000000-0000-0000-0000-000000000005',treat,'meal',5)
  expect(await balance()).toBe(1850)
 })
 it('denies edits to another person’s meal, including deletion and ID reuse',async()=>{
  await asUser(owner)
  await expect(save(meal,product,'meal',50,true)).rejects.toThrow('own feeding activities')
  await expect(save(meal,product,'meal',50,true,true)).rejects.toThrow('own feeding activities')
  expect(await balance()).toBe(1850)
 })
 it('allows shared purchase corrections but blocks negative stock',async()=>{
  await save(purchase,product,'purchase',1800)
  expect(await balance()).toBe(1650)
  await expect(save(purchase,product,'purchase',1800,false,true)).rejects.toThrow('Not enough recorded stock')
  expect(await balance()).toBe(1650)
 })
 it('blocks feeding beyond stock and rolls back the record',async()=>{
  await expect(save('30000000-0000-0000-0000-000000000006',product,'meal',9999,true)).rejects.toThrow('Not enough recorded stock')
  expect(await balance()).toBe(1650)
 })
 it('restores stock when creator removes a meal; retries are harmless',async()=>{
  await asUser(member)
  await save(meal,product,'meal',150,false,true);await save(meal,product,'meal',150,false,true)
  expect(await balance()).toBe(1800)
  await expect(save(meal,product,'meal',150,true)).rejects.toThrow('removed')
 })
 it('keeps immutable audit history of corrections',async()=>{
  expect((await sql.query('select id from public.feeding_audit')).rows.length).toBeGreaterThan(5)
  await expect(sql.query('delete from public.feeding_audit')).rejects.toThrow('permission denied')
  await expect(sql.query('update public.feeding_entries set quantity_grams=1')).rejects.toThrow('permission denied')
 })
 it('isolates household data and denies outsider writes',async()=>{
  await asUser(outsider)
  expect((await sql.query('select id from public.food_products')).rows).toHaveLength(0)
  expect((await sql.query('select id from public.feeding_entries')).rows).toHaveLength(0)
  expect((await sql.query('select id from public.feeding_audit')).rows).toHaveLength(0)
  await expect(save('30000000-0000-0000-0000-000000000007',product,'meal',1,true)).rejects.toThrow('access denied')
  await expect(sql.query("select public.save_food_product($1,$2,'Forged','dry',100,200,100,7)",[other,product])).rejects.toThrow('access denied')
  await expect(save('30000000-0000-0000-0000-000000000007',product,'meal',1,true,false,other)).rejects.toThrow('Choose a product')
 })
 it('preserves product category once history exists and hides internal helpers',async()=>{
  await asUser(owner)
  await expect(sql.query("select public.save_food_product($1,$2,'Kibble','treat',100,200,100,7)",[home,product])).rejects.toThrow('food type consistent')
  await expect(sql.query('select private.food_balance($1)',[product])).rejects.toThrow('permission denied')
 })
 it('rejects malformed packages and future meals',async()=>{
  await asUser(owner)
  await expect(sql.query("select public.save_feeding_entry($1,gen_random_uuid(),$2,'purchase',10,now())",[home,product])).rejects.toThrow('check constraint')
  await expect(sql.query("select public.save_feeding_entry($1,gen_random_uuid(),$2,'meal',10,now()+interval '1 day')",[home,product])).rejects.toThrow('future')
 })
 it('rejects anonymous writes and reads',async()=>{
  await sql.exec('reset role;set role anon')
  await expect(save(meal)).rejects.toThrow('permission denied')
  await expect(sql.query('select * from public.food_products')).rejects.toThrow('permission denied')
 })
})
