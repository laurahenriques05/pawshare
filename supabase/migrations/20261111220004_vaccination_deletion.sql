begin;
grant delete on public.vaccinations to authenticated;
create policy vaccination_delete on public.vaccinations for delete to authenticated
using(private.is_member(household_id));
commit;
