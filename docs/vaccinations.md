# Vaccination records

Health → Vaccination records (`/health/vaccinations`). Current family members may create/read/edit all records, as agreed. Confirmed deletion is available after the separate vaccination-deletion migration. Preserves medication and appointment work.

Fields: vaccine name, date given, optional veterinarian-supplied next due date, veterinarian/clinic, batch number, notes. These are date-only records, stored as Postgres dates. The family timezone determines today, future-date validation and due/overdue labels. No vaccination recommendations or automatic intervals. Server and client reject future given dates and next dates on/before given dates. Creator/editor and audit timestamps are set by a database trigger. Household reassignment and audit spoofing are blocked by column grants. Edits use last-write-wins; no full revision history.

## Pending migration

Review and coordinate application of `supabase/migrations/202611110004_vaccinations.sql` once. It depends only on the initial household schema/helpers and has not been applied by this task. Do not rerun earlier migrations. No environment changes. Existing medication changes remain local and uncommitted from the previous step.

## Verification

Run `npm test` and `npm run build`. Embedded Postgres tests execute the migration and exercise family isolation, shared editing/creation, anonymous and former-member rejection, audit protection, forbidden deletion and invalid dates. Client tests check date validation and due states.

After migration application, open Health → Vaccination records, create a disposable record, refresh and edit from another member account. Check missing next date, overdue/today/future next dates, offline save/load/retry, denied access, family switching, 375px layout and keyboard use. Hosted Supabase and browser interaction still need manual verification.

## Maria integration

No notifications or shared-calendar writes. Before integration agree on source type/record ID, household ID, vaccine title, date-only next_due_on semantics, family timezone, deep link, recipients and audit metadata. Agree on reminder time for a date-only record and idempotent upsert/cancellation on edits. No new scheduler/calendar system is introduced. Documents and other Health features remain out of scope.

Next due dates now appear as date-only entries on the Health calendar, derived directly from vaccination records. No duplicate appointments/events are persisted. Changing/clearing next_due_on updates/removes the entry on the next calendar load. Each entry links to its source vaccination for editing. No notifications or shared calendar infrastructure are created.

## Remove a mistaken record

All current members may delete vaccinations after explicit confirmation. Apply `20261111220004_vaccination_deletion.sql` once after coordinated review (not applied by this task). Delete is available beside each history record and within its edit form; cancellation leaves it untouched, errors allow retry. Successful deletion reloads the history; next-due calendar entries disappear on the next Health load because they are derived from the source record. No separate calendar rows require cleanup.
