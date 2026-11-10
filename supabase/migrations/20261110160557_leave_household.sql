begin;
create function public.leave_household(p_household uuid, p_new_owner uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_role text;
begin
 if v_user is null then raise exception 'Sign in to leave a household' using errcode='42501'; end if;
 -- Serialize ownership changes and departures for this household.
 perform 1 from public.households where id=p_household for update;
 select role into v_role from public.household_members where household_id=p_household and user_id=v_user for update;
 if v_role is null then raise exception 'You are not a member of this household' using errcode='42501'; end if;
 if v_role='owner' then
  if p_new_owner is null or p_new_owner=v_user or not exists(select 1 from public.household_members where household_id=p_household and user_id=p_new_owner) then
   raise exception 'Choose another existing family member as the next owner before leaving';
  end if;
  update public.household_members set role='owner' where household_id=p_household and user_id=p_new_owner;
  update public.households set created_by=p_new_owner where id=p_household and created_by=v_user;
 elsif p_new_owner is not null then
  raise exception 'Only the owner can transfer ownership' using errcode='42501';
 end if;
 -- Old accepted codes cannot silently restore membership after leaving.
 -- Pending codes issued by the departing member are no longer valid.
 update public.invitations set revoked_at=coalesce(revoked_at,now()) where household_id=p_household
  and (accepted_by=v_user or (created_by=v_user and accepted_at is null));
 delete from public.household_members where household_id=p_household and user_id=v_user;
end;
$$;
revoke all on function public.leave_household(uuid,uuid) from public,anon;
grant execute on function public.leave_household(uuid,uuid) to authenticated;
commit;
