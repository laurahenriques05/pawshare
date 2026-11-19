# Optional walking routine and map refinements — 19 November 2026

## Source behaviour

On Walks, Today's walks offers **Set your dog’s walking routine** when no plan
has been saved. Setup asks for 1–12 walks/day and an optional estimated local
HH:MM per slot; no times or routine are silently invented. Save, Cancel, Edit
routine and Remove routine are explicit. **No routine for now** saves an opt-out;
a later visit offers Set walking routine without asking for that decision again.
The routine is shared per dog/household, consistent with the existing daily plan.
Estimated times are routine hints, not appointments, calendar rows or reminders.
Existing chosen counts are retained when the migration adds the new fields.

The overview omits NEXT WALK without a configured routine. The counter counts
actual nondeleted walk starts on the household-local start day, including active
walks, deduplicated by saved walk ID. An empty diary shows 0 and no last-start
caption. Manual routine checks still attest completed outings in the circles;
they do not fabricate a start, GPS record or increase the real-start counter.
Completed slots/summaries retain their existing rules. Counts may exceed the goal.
The removed “Tap a circle…” sentence is absent. Chosen time hints appear in the
routine circles; unscheduled slots have no clock time.

The NFC illustration now includes a small dog wearing the tag beside the phone,
in the same line-art system. It is not proof of a written/scanned tag. Selection
chevrons are lighter; the separate Layers icon is removed from Map view.
Initial location framing starts at world zoom 1 and approaches the device at zoom
15.5 over three seconds. Reduced-motion users receive the final frame directly;
Recenter does not replay the initial approach.

Opt-in dog places remain visible on moderate zoom-out: already observed mapped
POIs are retained in bounded session memory (250 entries), with markers and names
from zoom 10. Detailed tiles take over at zoom 16; very distant views hide the
extra markers. No new location request is made for this retention. Map data and
coverage still depend on the provider; unseen/unmapped places cannot be invented.
Turning dog places off hides both tile and retained layers. Nearby Overpass
results remain optional and use the existing consent/query behaviour.

## Schema and rollout

`20261119165100_walk_routine_preferences.sql` was applied to shared Supabase on
19 November 2026, after `20261119001000_walk_journal_and_daily_plan.sql`.
The user explicitly confirmed team approvals before application. It adds explicit routine choice,
optional estimated times and a membership-checked `set_walk_routine` RPC. Existing
plan RLS and no-direct-write permissions remain. Invalid counts/times, anonymous
callers and outsiders are rejected. Legacy count saves still work and clear stale
time hints. No existing checks, walks or notes are deleted. Shared generated types
are untouched. The rollout below records the installed ledger versions. Do not reapply these
files. No household routine or activity record was created during rollout.

The client needs these new fields/RPC to read/save the routine. If missing it
shows an unavailable/retry state and does not claim success or fall back to a
browser-only “saved” plan. PR #50 is merged as `bfd2e6a`; the public site serves the matching frontend
bundle (`index-DKmUNcYE.js`). No additional frontend deployment was performed
for this database rollout; the production deployment metadata SHA was not inspected.

## Verification

Local tests cover first-run/opt-out rendering, zero/active/deleted/deduplicated
starts, household-local days, optional time display, member persistence, invalid
counts/times, anonymous/outsider denial and legacy RPC compatibility. Map tests
cover retaining observed POIs when lower-detail tiles omit them and ignoring
hidden-layer additions. They do not establish worldwide map-data completeness.

A temporary browser harness rendered the actual components with explicit sample
state and a public example Lisbon map area; no account or real GPS data was used.
It verified setup, optional 08:30/21:00 times, save feedback, opt-out, no NEXT WALK
without a plan, 0 without a last-start caption, no removed instruction/Layers icon,
lighter arrows, and narrow 390px/desktop 1280px layouts with no horizontal page
overflow. A mapped Pet ways label remained visible after two zoom-out steps.
Screenshots are fixture previews, not hosted integration evidence. The harness
was removed. Real phone consent, physical GPS motion/background behaviour and NFC
remain unverified. Full final test/typecheck/build results are recorded in the PR.

Final checks: **250 tests across 57 files passed** on Node **22.23.5**, followed
by TypeScript and the production build. Existing dependencies were reused; this
was not a new `npm ci`. `git diff --check` passed. Existing Zod annotation and
large-bundle warnings remain. Current main's documentation (PR #49 at `9d894b5`)
was integrated without changing feature ownership or applying any migration.

## CI follow-up

The first push/PR Verify runs exposed an environment-dependent presentation test:
with no VITE_APP_URL and no browser window, server rendering tried to construct
the NFC URL from an empty base. Local .env.local had masked this test dependency.
The presentation suite now supplies an explicit reserved example origin and a
Supabase stub that rejects any database access. Assertions and the real NFC URL
unit tests remain intact; no product configuration/security or CI rules changed.
The original failure was reproduced locally with all three VITE app/Supabase
variables blank before fixing it. The full isolated suite is rerun with those
variables blank, followed by typecheck/build and both GitHub Verify executions.

## Hosted rollout evidence — 19 November 2026

Applied only the two missing, versioned source migrations after checking the
hosted schema, prerequisites and migration ledger. Earlier installed Walks
migrations were not rerun. Ledger mapping:

| Repository source | Hosted version/name |
| --- | --- |
| `20261119001000_walk_journal_and_daily_plan.sql` | `20261119172420_walk_journal_and_daily_plan` |
| `20261119165100_walk_routine_preferences.sql` | `20261119172455_walk_routine_preferences` |

Both application calls succeeded and both ledger entries were independently read
back. All three new tables have RLS enabled, authenticated SELECT, no direct
authenticated INSERT and no anonymous SELECT. Journal append, daily checks and
routine RPCs permit authenticated execution and reject anonymous execution.
A zero-row anonymous REST schema probe recognised required_count, routine_enabled
and estimated_times; it returned the expected 401/42501 access denial, not a
missing-table/column error. No private household rows were retrieved.

The production /walks browser visit redirected to sign-in because the inspection
session had no authenticated account. First-run choice, save/reload and opt-out
were previously checked with local fixtures/isolated SQL; they were not repeated
on a real hosted account here. The user must choose their own count/times.
No fake goal, completed walk, manual check or note was inserted. No new production
frontend release, unrelated migration or Auth setting change was performed.
