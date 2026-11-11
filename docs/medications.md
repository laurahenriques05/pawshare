# Medication schedules and dose logs

Health → Medication schedules & dose logs (`/health/medications`). All current family members may create/edit shared schedules and reschedule unlogged doses, as agreed with Beni. All may read. Only the recorder may correct a given/skipped log. No deletion is implemented.

## Pending migration

Review and coordinate `supabase/migrations/202611110003_medications.sql` before applying it once to the shared project. This task does not apply it, deploy, send notifications, or change Auth. The existing appointments migration is unchanged. No environment changes or new dependencies.

Schedules contain the medication name and prescribed instructions entered by the family. No recommendations or dose calculations. Create one dose or up to 366 daily doses at one chosen local time. Edit a schedule to add another series (for example another prescribed daily time). There is no indefinite recurrence. Planned times are materialized as UTC instants; subsequent family timezone changes affect display, not the stored instants. DST gaps/overlaps fail the whole client submission rather than silently shifting times. The existing timezone helper is used.

Given/skipped are stored states; overdue is derived from scheduled_at for unlogged doses and refreshes in the interface every 30 seconds. Actual administration time is separate from planned time, required for given and cannot be future. Skipped has no administration timestamp. recorded_by and recorded_at are server-set, with updated_at for corrections. Initial recording time is retained on correction. Schedule audit records the latest editor; there is no full revision history. Editing prescribed instructions updates the shared schedule display; dose logs do not snapshot old prescription text.

RLS restricts reads to current members. Browser roles have no direct table writes. Scoped RPCs check membership, lock a dose row before logging, and reject another recorder even on a competing request. A unique schedule/time constraint prevents duplicate planned doses within a schedule; deliberate creation of separate schedules is not deduplicated. A recorder can correct their log between given/skipped but cannot erase it or transfer authorship. Shared schedule edits are last-write-wins.

## Tests and manual checks

`npm test` uses the actual migration in embedded PostgreSQL to verify member scheduling/editing, deduplication, logged dose protection, recorder corrections, outsider/anonymous/former-member denial and invalid actual times. Existing timezone tests exercise DST. Row locking and competing-recorder rejection are tested sequentially in embedded Postgres; simultaneous hosted requests still require integration testing.

After coordinated migration application, create a disposable schedule, add multiple daily times, reload, log a dose, correct your log, and test another member being blocked from changing it. Check family switching, offline save/load/retry, 375px layout, keyboard use and a device timezone different from the family. Hosted Supabase/browser interaction is not verified by the unit tests. Do not test with real medication decisions or send notifications.

## Maria integration

No notification delivery or shared calendar writes. Agree on source type, stable schedule/dose IDs, household, planned UTC timestamp, family timezone, schedule title, source deep link, recipients, responsible person if applicable and audit fields. Use dose ID for idempotent event upsert; rescheduling must replace reminders and given/skipped must cancel them. Agree on corrections and future cancellation before enabling integration. No second calendar or scheduler is introduced.
