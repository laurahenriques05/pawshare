begin;
grant delete on public.vet_appointments to authenticated;
create policy vet_delete on public.vet_appointments for delete to authenticated
using(private.is_member(household_id));
commit;
