begin;
-- Members can see their own invitations; owners can manage the whole family.
drop policy invitations_read_owner on public.invitations;
create policy invitations_read_member on public.invitations for select to authenticated
 using(private.is_member(household_id) and (private.is_owner(household_id) or created_by=(select auth.uid())));
create or replace function public.create_household_invitation(p_household uuid,p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email)); v_token text; v_id uuid; v_expires timestamptz;
begin
 if auth.uid() is null or not private.is_member(p_household) then raise exception 'Only family members can invite people' using errcode='42501'; end if;
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
 if exists(select 1 from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=p_household and lower(u.email)=v_email) then raise exception 'This person is already in your family'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invitations:'||p_household::text,0));
 if (select count(*) from public.invitations where household_id=p_household and revoked_at is null and accepted_at is null and expires_at>now())>=25 then raise exception 'Revoke an unused invitation before creating another'; end if;
 update public.invitations set revoked_at=now() where household_id=p_household and email=v_email and revoked_at is null and accepted_at is null;
 -- A cryptographically random UUID provides 122 bits of code entropy.
 v_token:=replace(gen_random_uuid()::text,'-','');
 insert into public.invitations(household_id,email,token_hash,created_by)
 values(p_household,v_email,encode(sha256(convert_to(v_token,'UTF8')),'hex'),auth.uid())
 returning id,expires_at into v_id,v_expires;
 return jsonb_build_object('id',v_id,'token',v_token,'expires_at',v_expires);
end;
$$;

create or replace function private.checked_invitation(p_token text) returns public.invitations
language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in to accept this invitation' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirm your email before joining the family' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^([a-f0-9]{32}|[a-f0-9]{64})$' then raise exception 'This invitation is unavailable or has expired'; end if;
 select * into v_inv from public.invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or v_inv.revoked_at is not null or v_inv.expires_at<=now() then raise exception 'This invitation is unavailable or has expired'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in with the email address this invitation was created for' using errcode='42501'; end if;
 if v_inv.accepted_at is not null and (v_inv.accepted_by<>auth.uid() or not private.is_member(v_inv.household_id)) then raise exception 'This invitation has already been used'; end if;
 return v_inv;
end;
$$;
revoke all on function private.checked_invitation(text) from public,anon,authenticated;

create or replace function public.revoke_household_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations;
begin
 select * into v_inv from public.invitations where id=p_invitation;
 if auth.uid() is null or not private.is_member(v_inv.household_id) or not (private.is_owner(v_inv.household_id) or v_inv.created_by=auth.uid()) then
  raise exception 'Only the invitation creator or household owner can revoke invitations' using errcode='42501';
 end if;
 update public.invitations set revoked_at=now() where id=p_invitation and accepted_at is null and revoked_at is null;
end;
$$;
commit;
