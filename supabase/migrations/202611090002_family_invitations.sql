begin;
create table public.invitations (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null references public.households(id) on delete cascade,
 email text not null check (email=lower(trim(email)) and char_length(email) between 3 and 254),
 token_hash text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id),
 revoked_at timestamptz,
 check(expires_at > created_at),
 check ((accepted_at is null) = (accepted_by is null))
);
create index invitations_household_idx on public.invitations(household_id,created_at desc);
create unique index invitations_pending_email_idx on public.invitations(household_id,email)
 where accepted_at is null and revoked_at is null;
alter table public.invitations enable row level security;
revoke all on public.invitations from anon,authenticated;
-- Even owners cannot retrieve token hashes from the Data API.
grant select(id,household_id,email,created_by,created_at,expires_at,accepted_at,accepted_by,revoked_at)
 on public.invitations to authenticated;
create policy invitations_read_owner on public.invitations for select to authenticated
 using(private.is_owner(household_id));

create function public.create_household_invitation(p_household uuid,p_email text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(trim(p_email)); v_token text; v_id uuid; v_expires timestamptz;
begin
 if auth.uid() is null or not private.is_owner(p_household) then raise exception 'Only the household owner can invite members' using errcode='42501'; end if;
 if v_email is null or char_length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
 if exists(select 1 from public.household_members m join auth.users u on u.id=m.user_id where m.household_id=p_household and lower(u.email)=v_email) then raise exception 'This person is already in your family'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('invitations:'||p_household::text,0));
 if (select count(*) from public.invitations where household_id=p_household and revoked_at is null and accepted_at is null and expires_at>now())>=25 then raise exception 'Revoke an unused invitation before creating another'; end if;
 update public.invitations set revoked_at=now() where household_id=p_household and email=v_email and revoked_at is null and accepted_at is null;
 -- Two cryptographically random UUIDs provide over 240 bits of token entropy.
 v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.invitations(household_id,email,token_hash,created_by)
 values(p_household,v_email,encode(sha256(convert_to(v_token,'UTF8')),'hex'),auth.uid())
 returning id,expires_at into v_id,v_expires;
 return jsonb_build_object('id',v_id,'token',v_token,'expires_at',v_expires);
end;
$$;

-- Internal validator. Never exposed to anon/authenticated callers directly.
create function private.checked_invitation(p_token text) returns public.invitations
language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations; v_email text;
begin
 if auth.uid() is null then raise exception 'Sign in to accept this invitation' using errcode='42501'; end if;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if v_email is null then raise exception 'Confirm your email before joining the family' using errcode='42501'; end if;
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'This invitation is unavailable or has expired'; end if;
 select * into v_inv from public.invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or v_inv.revoked_at is not null or v_inv.expires_at<=now() then raise exception 'This invitation is unavailable or has expired'; end if;
 if v_inv.email<>v_email then raise exception 'Sign in with the email address this invitation was created for' using errcode='42501'; end if;
 if v_inv.accepted_at is not null and (v_inv.accepted_by<>auth.uid() or not private.is_member(v_inv.household_id)) then raise exception 'This invitation has already been used'; end if;
 return v_inv;
end;
$$;
revoke all on function private.checked_invitation(text) from public,anon,authenticated;

create function public.preview_household_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations;
begin
 v_inv:=private.checked_invitation(p_token);
 return (select jsonb_build_object('household_id',h.id,'household_name',h.name,'dog_name',d.name,'expires_at',v_inv.expires_at,'already_member',private.is_member(h.id))
 from public.households h left join public.dogs d on d.household_id=h.id where h.id=v_inv.household_id);
end;
$$;
create function public.accept_household_invitation(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_inv public.invitations;
begin
 v_inv:=private.checked_invitation(p_token);
 insert into public.household_members(household_id,user_id,role) values(v_inv.household_id,auth.uid(),'member') on conflict(household_id,user_id) do nothing;
 update public.invitations set accepted_at=coalesce(accepted_at,now()),accepted_by=auth.uid() where id=v_inv.id;
 return v_inv.household_id;
end;
$$;
create function public.revoke_household_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_household uuid;
begin
 select household_id into v_household from public.invitations where id=p_invitation;
 if v_household is null or not private.is_owner(v_household) then raise exception 'Only the household owner can revoke invitations' using errcode='42501'; end if;
 update public.invitations set revoked_at=now() where id=p_invitation and accepted_at is null and revoked_at is null;
end;
$$;
create function public.get_household_members(p_household uuid)
returns table(user_id uuid,display_name text,role text,joined_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not private.is_member(p_household) then raise exception 'Household access denied' using errcode='42501'; end if;
 return query select m.user_id,coalesce(nullif(p.display_name,''),'Family member'),m.role,m.created_at
 from public.household_members m left join public.profiles p on p.id=m.user_id
 where m.household_id=p_household order by m.created_at;
end;
$$;
revoke all on function public.create_household_invitation(uuid,text),public.preview_household_invitation(text),public.accept_household_invitation(text),public.revoke_household_invitation(uuid),public.get_household_members(uuid) from public,anon;
grant execute on function public.create_household_invitation(uuid,text),public.preview_household_invitation(text),public.accept_household_invitation(text),public.revoke_household_invitation(uuid),public.get_household_members(uuid) to authenticated;
commit;
