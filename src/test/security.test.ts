import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
const sql = new PGlite()
const a = '10000000-0000-0000-0000-000000000001'
const b = '10000000-0000-0000-0000-000000000002'
let household: string
async function count(table: string) { return Number((await sql.query<{ n: number }>(`select count(*)::int n from public.${table}`)).rows[0].n) }
async function asUser(id: string) { await sql.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`) }
beforeAll(async () => {
 await sql.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
 create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`)
 await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
 await sql.exec(`insert into auth.users(id,email) values('${a}','a@example.test'),('${b}','b@example.test')`)
 await asUser(a)
 household = (await sql.query<{ id: string }>("select public.create_household('A home','UTC') id")).rows[0].id
}, 30000)
afterAll(async () => { await sql.close() })
describe('initial migration on PostgreSQL with authenticated RLS roles', () => {
 it('creates owner membership and an idempotent household', async () => {
  expect(await count('household_members')).toBe(1)
  const retry = await sql.query<{ id: string }>("select public.create_household('Retry','UTC') id")
  expect(retry.rows[0].id).toBe(household); expect(await count('households')).toBe(1)
 })
 it('validates timezone and rolls back invalid onboarding', async () => {
  await expect(sql.query("select public.create_household('Bad','Not/AZone')")).rejects.toThrow('valid IANA')
 })
 it('allows one dog and rejects duplicates', async () => {
  await sql.query('insert into public.dogs(household_id,name) values($1,$2)',[household,'Pippin'])
  await expect(sql.query('insert into public.dogs(household_id,name) values($1,$2)',[household,'Second'])).rejects.toThrow('unique')
 })
 it('hides private records from another user and blocks writes', async () => {
  await asUser(b)
  for (const table of ['households','household_members','dogs']) expect(await count(table)).toBe(0)
  expect(await count('profiles')).toBe(1)
  await expect(sql.query('insert into public.dogs(household_id,name) values($1,$2)',[household,'Intruder'])).rejects.toThrow('row-level security')
  expect((await sql.query("update public.dogs set name='Intruder' returning id")).rows).toHaveLength(0)
  await expect(sql.query('insert into public.household_members(household_id,user_id,role) values($1,$2,$3)',[household,b,'owner'])).rejects.toThrow('permission denied')
 })
 it('prevents immutable reassignment and owner role edits', async () => {
  await asUser(a)
  await expect(sql.query('update public.dogs set household_id=$1',[household])).rejects.toThrow('permission denied')
  await expect(sql.query("update public.household_members set role='member'")).rejects.toThrow('permission denied')
 })
 it('allows a legitimate member to read and edit dog but not manage household', async () => {
  await sql.exec(`reset role; insert into public.household_members(household_id,user_id,role) values('${household}','${b}','member')`)
  await asUser(b)
  expect(await count('dogs')).toBe(1)
  expect((await sql.query("update public.dogs set name='Updated' returning id")).rows).toHaveLength(1)
  expect((await sql.query("update public.households set name='Hijacked' returning id")).rows).toHaveLength(0)
 })
 it('revokes access immediately after membership removal', async () => {
  await sql.exec(`reset role; delete from public.household_members where user_id='${b}'`)
  await asUser(b); expect(await count('dogs')).toBe(0)
 })
 it('denies anonymous access and household creation', async () => {
  await sql.exec('reset role; set role anon;')
  await expect(sql.query('select * from public.dogs')).rejects.toThrow('permission denied')
  await expect(sql.query("select public.create_household('Anon','UTC')")).rejects.toThrow('permission denied')
 })
})
