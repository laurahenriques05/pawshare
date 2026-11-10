import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
const sql = new PGlite()
const owner='10000000-0000-0000-0000-000000000001'
const invitee='10000000-0000-0000-0000-000000000002'
const unverified='10000000-0000-0000-0000-000000000003'
const outsider='10000000-0000-0000-0000-000000000004'
let home:string, ownHome:string, token:string, inviteId:string
async function asUser(id:string) { await sql.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`) }
async function create(email:string) { await asUser(owner);return (await sql.query<{value:{id:string;token:string;expires_at:string}}>('select public.create_household_invitation($1,$2) value',[home,email])).rows[0].value }
beforeAll(async()=>{
 await sql.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/202611090002_family_invitations.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/20261110155615_member_invitation_codes.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/20261110160557_leave_household.sql','utf8'))
 await sql.exec(`insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('${owner}','owner@example.test',now(),'{"display_name":"Owner"}'),
 ('${invitee}','invitee@example.test',now(),'{"display_name":"Invitee"}'),
 ('${unverified}','unverified@example.test',null,'{}'),
 ('${outsider}','outsider@example.test',now(),'{}')`)
 await asUser(owner)
 home=(await sql.query<{id:string}>("select public.create_household('Shared family','UTC') id")).rows[0].id
 await sql.query('insert into public.dogs(household_id,name) values($1,$2)',[home,'Shared dog'])
 await asUser(invitee)
 ownHome=(await sql.query<{id:string}>("select public.create_household('Original family','UTC') id")).rows[0].id
 await sql.query('insert into public.dogs(household_id,name) values($1,$2)',[ownHome,'Original dog'])
},30000)
afterAll(async()=>{await sql.close()})
describe('email-bound household invitation security',()=>{
 it('creates a normalized email invitation with a high-entropy token',async()=>{
  const created=await create('  INVITEE@example.test  ');token=created.token;inviteId=created.id
  expect(token).toMatch(/^[a-f0-9]{32}$/)
  const rows=await sql.query<{email:string}>('select email from public.invitations')
  expect(rows.rows[0].email).toBe('invitee@example.test')
 })
 it('does not expose token hashes even to the household owner',async()=>{
  await expect(sql.query('select token_hash from public.invitations')).rejects.toThrow('permission denied')
  await sql.exec('reset role')
  const hash=(await sql.query<{token_hash:string}>('select token_hash from public.invitations')).rows[0].token_hash
  expect(hash).not.toBe(token);expect(hash).toMatch(/^[a-f0-9]{64}$/)
 })
 it('does not grant access before explicit acceptance',async()=>{
  await asUser(invitee)
  expect((await sql.query('select id from public.households where id=$1',[home])).rows).toHaveLength(0)
  const preview=(await sql.query<{value:{household_name:string;already_member:boolean}}> ('select public.preview_household_invitation($1) value',[token])).rows[0].value
  expect(preview.household_name).toBe('Shared family');expect(preview.already_member).toBe(false)
 })
 it('rejects the wrong verified account',async()=>{
  await asUser(outsider)
  await expect(sql.query('select public.preview_household_invitation($1)',[token])).rejects.toThrow('email address')
  await expect(sql.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('email address')
 })
 it('rejects unverified email accounts',async()=>{
  const created=await create('unverified@example.test');await asUser(unverified)
  await expect(sql.query('select public.accept_household_invitation($1)',[created.token])).rejects.toThrow('Confirm your email')
 })
 it('joins the invited household while preserving an existing household',async()=>{
  await asUser(invitee)
  const accepted=(await sql.query<{id:string}>('select public.accept_household_invitation($1) id',[token])).rows[0].id
  expect(accepted).toBe(home)
  expect((await sql.query('select id from public.households')).rows).toHaveLength(2)
  expect((await sql.query('select id from public.households where id=$1',[ownHome])).rows).toHaveLength(1)
  expect((await sql.query('select id from public.dogs')).rows).toHaveLength(2)
  expect((await sql.query<{role:string}>('select role from public.household_members where household_id=$1 and user_id=$2',[home,invitee])).rows[0].role).toBe('member')
 })
 it('handles repeated acceptance without duplicating membership or escalating roles',async()=>{
  await sql.query('select public.accept_household_invitation($1)',[token])
  expect((await sql.query('select user_id from public.household_members where household_id=$1 and user_id=$2',[home,invitee])).rows).toHaveLength(1)
  await expect(sql.query("update public.household_members set role='owner' where user_id=$1",[invitee])).rejects.toThrow('permission denied')
 })
 it('shows family display names but hides invitation email lists from members',async()=>{
  const members=(await sql.query<{display_name:string}>('select * from public.get_household_members($1)',[home])).rows
  expect(members.map(m=>m.display_name)).toEqual(['Owner','Invitee'])
  expect((await sql.query('select email from public.invitations')).rows).toHaveLength(0)
 })
 it('allows member-created codes but protects other members’ invitations',async()=>{
  const created=(await sql.query<{value:{id:string;token:string}}>('select public.create_household_invitation($1,$2) value',[home,'another@example.test'])).rows[0].value
  expect(created.token).toMatch(/^[a-f0-9]{32}$/)
  expect((await sql.query('select email from public.invitations')).rows).toHaveLength(1)
  await sql.query('select public.revoke_household_invitation($1)',[created.id])
  await expect(sql.query('select public.revoke_household_invitation($1)',[inviteId])).rejects.toThrow('Only the invitation creator or household owner')
  await expect(sql.query('insert into public.invitations(household_id,email,token_hash,created_by) values($1,$2,$3,$4)',[home,'bad@example.test','bad',invitee])).rejects.toThrow('permission denied')
 })
 it('denies outsider roster reads and owner-only mutations',async()=>{
  await asUser(outsider)
  await expect(sql.query('select * from public.get_household_members($1)',[home])).rejects.toThrow('access denied')
  await expect(sql.query('select public.create_household_invitation($1,$2)',[home,'bad@example.test'])).rejects.toThrow('Only family members')
 })
 it('revokes an unused invitation without granting access',async()=>{
  const created=await create('outsider@example.test')
  await sql.query('select public.revoke_household_invitation($1)',[created.id]);await asUser(outsider)
  await expect(sql.query('select public.accept_household_invitation($1)',[created.token])).rejects.toThrow('unavailable or has expired')
 })
 it('invalidates an older invitation when a replacement is created',async()=>{
  const first=await create('outsider@example.test'),second=await create('outsider@example.test');await asUser(outsider)
  await expect(sql.query('select public.accept_household_invitation($1)',[first.token])).rejects.toThrow('unavailable or has expired')
  expect((await sql.query('select public.preview_household_invitation($1)',[second.token])).rows).toHaveLength(1)
 })
 it('rejects expired invitations',async()=>{
  const created=await create('outsider@example.test');await sql.exec('reset role')
  await sql.query("update public.invitations set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[created.id]);await asUser(outsider)
  await expect(sql.query('select public.accept_household_invitation($1)',[created.token])).rejects.toThrow('unavailable or has expired')
 })
 it('lets a new user join without creating a second household or dog',async()=>{
  const created=await create('outsider@example.test');await asUser(outsider)
  await sql.query('select public.accept_household_invitation($1)',[created.token])
  expect((await sql.query('select id from public.households')).rows).toHaveLength(1)
  expect((await sql.query('select id from public.dogs')).rows).toHaveLength(1)
  const resumed=(await sql.query<{id:string}>("select public.create_household('Unnecessary duplicate','UTC') id")).rows[0].id
  expect(resumed).toBe(home)
 })
 it('rejects forged tokens, invalid emails and existing family members',async()=>{
  await expect(sql.query('select public.accept_household_invitation($1)',['0'.repeat(64)])).rejects.toThrow('unavailable or has expired')
  await expect(sql.query('select public.accept_household_invitation($1)',['../bad'])).rejects.toThrow('unavailable or has expired')
  await asUser(owner)
  await expect(sql.query('select public.create_household_invitation($1,$2)',[home,'invalid'])).rejects.toThrow('valid email')
  await expect(sql.query('select public.create_household_invitation($1,$2)',[home,'invitee@example.test'])).rejects.toThrow('already in your family')
 })
 it('denies unauthenticated invitation access',async()=>{
  await sql.exec('reset role;set role anon')
  await expect(sql.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('permission denied')
  await expect(sql.query('select public.preview_household_invitation($1)',[token])).rejects.toThrow('permission denied')
  await expect(sql.query('select email from public.invitations')).rejects.toThrow('permission denied')
 })
})

describe('leaving a household', () => {
 it('denies outsiders and unauthenticated users', async () => {
  await asUser(unverified)
  await expect(sql.query('select public.leave_household($1)',[home])).rejects.toThrow('not a member')
  await sql.exec('reset role;set role anon')
  await expect(sql.query('select public.leave_household($1)',[home])).rejects.toThrow('permission denied')
 })
 it('blocks owners leaving without an eligible successor', async () => {
  await asUser(owner)
  await expect(sql.query('select public.leave_household($1)',[home])).rejects.toThrow('next owner')
  await expect(sql.query('select public.leave_household($1,$2)',[home,unverified])).rejects.toThrow('next owner')
  await expect(sql.query('select public.leave_household($1,$2)',[home,owner])).rejects.toThrow('next owner')
 })
 it('removes member access and prevents old invitation reuse', async () => {
  await asUser(invitee)
  await expect(sql.query('select public.leave_household($1,$2)',[home,outsider])).rejects.toThrow('Only the owner')
  await sql.query('select public.leave_household($1)',[home])
  expect((await sql.query('select id from public.dogs where household_id=$1',[home])).rows).toHaveLength(0)
  expect((await sql.query('select id from public.households where id=$1',[ownHome])).rows).toHaveLength(1)
  await expect(sql.query('select public.accept_household_invitation($1)',[token])).rejects.toThrow('unavailable or has expired')
 })
 it('allows a departed member to join again with a fresh code', async () => {
  const fresh=await create('invitee@example.test')
  await asUser(invitee)
  await sql.query('select public.accept_household_invitation($1)',[fresh.token])
  expect((await sql.query('select id from public.dogs where household_id=$1',[home])).rows).toHaveLength(1)
 })
 it('transfers ownership atomically while preserving the family and dog', async () => {
  await asUser(owner)
  await sql.query('select public.leave_household($1,$2)',[home,invitee])
  expect((await sql.query('select id from public.households where id=$1',[home])).rows).toHaveLength(0)
  await asUser(invitee)
  expect((await sql.query<{role:string}>('select role from public.household_members where household_id=$1 and user_id=$2',[home,invitee])).rows[0].role).toBe('owner')
  expect((await sql.query<{created_by:string}>('select created_by from public.households where id=$1',[home])).rows[0].created_by).toBe(invitee)
  expect((await sql.query('select id from public.dogs where household_id=$1',[home])).rows).toHaveLength(1)
 })
})
