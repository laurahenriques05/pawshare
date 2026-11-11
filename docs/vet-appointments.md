# Veterinary appointments

Scope: create, list and edit shared appointments via Health. No deletion, reminders, calendar writes, medical advice or other Health modules.

Review and coordinate application of `supabase/migrations/202611110002_vet_appointments.sql` after the initial schema. It has NOT been applied by this change. No environment changes. An unapplied migration produces a visible error with retry, not demo records.

Each appointment belongs to a household (one dog per household). All current members can create/read/edit, including another member’s records. RLS checks live membership. Column grants prevent reassignment and audit spoofing. No browser deletion permission. Database triggers set creator/editor and timestamps. UTC timestamptz storage; input and 24-hour display use household.timezone, independent of the device. Missing or ambiguous DST times are rejected with an instruction to choose another time. Editing is last-write-wins; concurrent conflict resolution is not included.

## Maria integration pending agreement

No shared calendar schema, event API or reminder scheduler exists in this checkout. Walks has its own notification adapter and summaries; that is not a general calendar contract. No event or notification is emitted here. Agree on household ID, appointment ID as stable source ID, source feature, title, instant, family timezone, deep link `/health/appointments`, optional responsible member and author/editor timestamps. Agree on upsert uniqueness (source + source ID), edits/cancellation, recipient preferences, timezone changes and scheduling ownership before integration. Do not create duplicate calendar records or a second delivery system. No Home summary in this step.

## Verification

`npm test` runs embedded PostgreSQL tests against the actual migration, plus timezone tests. `npm run build` checks TypeScript and bundles. This does not verify hosted Supabase, actual migration application or browser interaction.

After coordinated migration application: run `npm run dev`, sign in and open Health. Create a visit, reload and edit it. Use another member to edit the same visit; a different family must see none. Switch families and confirm the list resets. Test empty state, offline load/save and retry. Remove a disposable member and verify reads/writes are denied. Test a device timezone different from the family, DST transitions, keyboard use and 375px width. Use disposable accounts/data; send no emails or notifications.

Repository discrepancies: README milestone sections still describe Walks/invitations as unavailable or owner-only; later migrations/code implement Walks, member invitations and leaving with ownership transfer. Account display names use profiles. No public deployment comparison or hosted authentication/email verification was performed; local Git cannot establish what Vercel currently runs. Existing Lost Dog preview is outside this task and has not been extended.

Health now opens a month calendar of veterinary records, using the same table. Choose a day, press +, and save; select a listed visit to edit. Today and month navigation are available. This is a Health presentation only, with no shared calendar writes or reminder delivery.
