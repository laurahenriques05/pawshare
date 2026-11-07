begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','a@example.test'),
 ('10000000-0000-0000-0000-000000000002','b@example.test');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.create_household('A home','UTC')$$,'owner creates household atomically');
select is((select count(*)::int from public.household_members),1,'owner membership exists');
select lives_ok($$select public.create_household('Retry','UTC')$$,'onboarding retry succeeds');
select is((select count(*)::int from public.households),1,'retry does not duplicate household');
select lives_ok($$insert into public.dogs(household_id,name) select id,'Dog A' from public.households$$,'owner registers dog');
select throws_ok($$insert into public.dogs(household_id,name) select id,'Second dog' from public.households$$,'23505',null,'one dog enforced');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.households),0,'other household hidden');
select is((select count(*)::int from public.dogs),0,'other dog hidden');
select is((select count(*)::int from public.household_members),0,'other memberships hidden');
select is((select count(*)::int from public.profiles),1,'only own profile visible');
select throws_ok($$insert into public.household_members(household_id,user_id,role) values(gen_random_uuid(),auth.uid(),'owner')$$,'42501',null,'cannot inject membership');
select lives_ok($$select public.create_household('B home','UTC')$$,'second user gets own household');
reset role;
set local role anon;
select throws_ok($$select * from public.dogs$$,'42501',null,'anonymous dog access denied');
select * from finish();
rollback;
