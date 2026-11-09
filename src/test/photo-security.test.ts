import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
const sql = new PGlite()
const a='10000000-0000-0000-0000-000000000001', b='10000000-0000-0000-0000-000000000002'
let path: string
async function asUser(id: string) { await sql.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`) }
beforeAll(async () => {
 await sql.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
 create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated,anon;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant select on storage.objects to anon;`)
 await sql.exec(readFileSync('supabase/migrations/202611070001_initial_schema.sql','utf8'))
 await sql.exec(readFileSync('supabase/migrations/202611090001_dog_photos.sql','utf8'))
 await sql.exec(`insert into auth.users(id,email) values('${a}','a@example.test'),('${b}','b@example.test')`)
 await asUser(a)
 const household=(await sql.query<{id:string}>("select public.create_household('Photo home','UTC') id")).rows[0].id
 const dog=(await sql.query<{id:string}>('insert into public.dogs(household_id,name) values($1,$2) returning id',[household,'Pippin'])).rows[0].id
 path=`${household}/${dog}.jpg`
},30000)
afterAll(async()=>{await sql.close()})
describe('private dog-photo storage policies',()=>{
 it('permits household upload, read and replacement at the exact dog path', async()=>{
  await sql.query("insert into storage.objects(bucket_id,name) values('dog-photos',$1)",[path])
  expect((await sql.query('select * from storage.objects')).rows).toHaveLength(1)
  expect((await sql.query('update storage.objects set name=$1 returning id',[path])).rows).toHaveLength(1)
 })
 it('rejects arbitrary and nonexistent dog paths',async()=>{
  await expect(sql.query("insert into storage.objects(bucket_id,name) values('dog-photos',$1)",[path.replace('.jpg','/extra.jpg')])).rejects.toThrow('row-level security')
  await expect(sql.query("insert into storage.objects(bucket_id,name) values('dog-photos',$1)",[path.replace(/[^/]+$/, 'unknown.jpg')])).rejects.toThrow('row-level security')
 })
 it('isolates another account from private images',async()=>{
  await asUser(b)
  expect((await sql.query('select * from storage.objects')).rows).toHaveLength(0)
  await expect(sql.query("insert into storage.objects(bucket_id,name) values('dog-photos',$1)",[path])).rejects.toThrow('row-level security')
  expect((await sql.query('update storage.objects set name=$1 returning id',[path])).rows).toHaveLength(0)
 })
 it('denies anonymous image reads',async()=>{
  await sql.exec('reset role;set role anon')
  expect((await sql.query('select * from storage.objects')).rows).toHaveLength(0)
 })
 it('creates a private bucket limited to JPEG output and 5 MB',async()=>{
  await sql.exec('reset role')
  const bucket=(await sql.query<{public:boolean;allowed_mime_types:string[];file_size_limit:number}>('select * from storage.buckets')).rows[0]
  expect(bucket.public).toBe(false);expect(bucket.allowed_mime_types).toEqual(['image/jpeg']);expect(Number(bucket.file_size_limit)).toBe(5242880)
 })
})
