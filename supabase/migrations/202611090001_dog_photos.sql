begin;
-- A fixed, validated object path avoids storing expiring URLs in the dog record.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('dog-photos','dog-photos',false,5242880,array['image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];

create function private.can_access_dog_photo(p_path text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists (
  select 1 from public.dogs d
  where p_path = d.household_id::text || '/' || d.id::text || '.jpg'
  and private.is_member(d.household_id)
 );
$$;
revoke all on function private.can_access_dog_photo(text) from public;
grant execute on function private.can_access_dog_photo(text) to authenticated;

create policy dog_photo_read on storage.objects for select to authenticated
 using (bucket_id='dog-photos' and private.can_access_dog_photo(name));
create policy dog_photo_insert on storage.objects for insert to authenticated
 with check (bucket_id='dog-photos' and private.can_access_dog_photo(name));
create policy dog_photo_replace on storage.objects for update to authenticated
 using (bucket_id='dog-photos' and private.can_access_dog_photo(name))
 with check (bucket_id='dog-photos' and private.can_access_dog_photo(name));
commit;
