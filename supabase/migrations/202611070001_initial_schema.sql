begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (char_length(display_name) <= 80),
 created_at timestamptz not null default now()
);
create table public.households (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 80),
 timezone text not null default 'UTC',
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.household_members (
 household_id uuid not null references public.households(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','member')),
 created_at timestamptz not null default now(),
 primary key (household_id,user_id)
);
create index household_members_user_idx on public.household_members(user_id,household_id);
create table public.dogs (
 id uuid primary key default gen_random_uuid(),
 household_id uuid not null unique references public.households(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 80),
 breed text check (char_length(breed) <= 100),
 date_of_birth date check (date_of_birth <= current_date),
 weight_kg numeric(5,2) check (weight_kg > 0 and weight_kg <= 200),
 sex text not null default 'unknown' check (sex in ('male','female','unknown')),
 neutered boolean,
 activity_level text not null default 'moderate' check (activity_level in ('low','moderate','high')),
 created_at timestamptz not null default now()
);

-- Definer helpers avoid recursive RLS. No client-controlled identity argument.
create function private.is_member(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.household_members where household_id=p_household and user_id=(select auth.uid()));
$$;
create function private.is_owner(p_household uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.household_members where household_id=p_household and user_id=(select auth.uid()) and role='owner');
$$;
revoke all on function private.is_member(uuid), private.is_owner(uuid) from public;
grant execute on function private.is_member(uuid), private.is_owner(uuid) to authenticated;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),80));
 return new;
end;
$$;
revoke all on function private.handle_new_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
-- Backfill any accounts created before this migration.
insert into public.profiles(id,display_name)
 select id,left(coalesce(raw_user_meta_data->>'display_name',''),80) from auth.users on conflict (id) do nothing;

create function public.create_household(p_name text,p_timezone text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_household uuid;
begin
 if v_user is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if char_length(trim(p_name)) not between 1 and 80 or p_name is null then raise exception 'Household name must be 1–80 characters'; end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Choose a valid IANA time zone'; end if;
 -- Serialize onboarding retries per account. Existing membership resumes its household.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
 select household_id into v_household from public.household_members where user_id=v_user order by created_at limit 1;
 if v_household is not null then return v_household; end if;
 insert into public.households(name,timezone,created_by) values(trim(p_name),p_timezone,v_user) returning id into v_household;
 insert into public.household_members(household_id,user_id,role) values(v_household,v_user,'owner');
 return v_household;
end;
$$;
revoke all on function public.create_household(text,text) from public, anon;
grant execute on function public.create_household(text,text) to authenticated;

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.dogs enable row level security;
revoke all on public.profiles, public.households, public.household_members, public.dogs from anon, authenticated;
grant select on public.profiles,public.households,public.household_members,public.dogs to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name,timezone) on public.households to authenticated;
grant insert(household_id,name,breed,date_of_birth,weight_kg,sex,neutered,activity_level) on public.dogs to authenticated;
grant update(name,breed,date_of_birth,weight_kg,sex,neutered,activity_level) on public.dogs to authenticated;

create policy profile_read_self on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_update_self on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy household_read on public.households for select to authenticated using(private.is_member(id));
create policy household_update_owner on public.households for update to authenticated using(private.is_owner(id)) with check(private.is_owner(id));
create policy membership_read on public.household_members for select to authenticated using(private.is_member(household_id));
create policy dog_read on public.dogs for select to authenticated using(private.is_member(household_id));
create policy dog_create_owner on public.dogs for insert to authenticated with check(private.is_owner(household_id));
create policy dog_update_member on public.dogs for update to authenticated using(private.is_member(household_id)) with check(private.is_member(household_id));
-- No direct household/member insert, role edits, deletes, or dog reassignment grants.
commit;
