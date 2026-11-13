begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('health-documents','health-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];
create function private.health_document_access(path text, writing boolean default false, deleting boolean default false) returns boolean
language sql stable set search_path='' as $$
 select exists(select 1 from public.households h where split_part(path,'/',1)=h.id::text and private.is_member(h.id)
 and (not writing or (split_part(path,'/',2)=auth.uid()::text and path ~ '^[^/]+/[^/]+/[0-9a-f-]{36}--[^/]+$'))
 and (not deleting or split_part(path,'/',2)=auth.uid()::text or private.is_owner(h.id)));
$$;
revoke all on function private.health_document_access(text,boolean,boolean) from public;
grant execute on function private.health_document_access(text,boolean,boolean) to authenticated;
create policy health_document_read on storage.objects for select to authenticated using(bucket_id='health-documents' and private.health_document_access(name));
create policy health_document_upload on storage.objects for insert to authenticated with check(bucket_id='health-documents' and private.health_document_access(name,true,false));
create policy health_document_delete on storage.objects for delete to authenticated using(bucket_id='health-documents' and private.health_document_access(name,false,true));
-- No overwrite/update grant: immutable objects, unique upload names.
commit;
