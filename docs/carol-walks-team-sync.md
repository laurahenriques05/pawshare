# Current follow-up — 19 November 2026

The explicit routine/map requests are implemented in source on
`codex/walk-routine-map-details`; see [the request-by-request handoff](walks-routine-map-details.md).
PR #50 is merged. Following explicit user confirmation of team approvals, the
journal/daily-plan and routine-preferences migrations were applied to shared
Supabase on 19 November. See the hosted ledger mapping and verification in the
handoff above; do not reapply them. No additional frontend deployment was made.
The older snapshots below do not describe these new behaviours or establish
that the requested public app has been updated.

# Carol Walks / team synchronization — 19 November 2026

## Repository evidence

A successful `git fetch origin` confirmed local HEAD and `origin/main` at
`890c904e9ff74e68d3d900c7cb481447db326833` (merge of PR #48). The checkout was
clean on `codex/docs-current-state` before this documentation update. Remote
branches were not merged indiscriminately. This Git evidence does not identify
the production deployment or prove hosted migrations were installed.

## Implemented in source

- GPS/location confirmation and time-only walks, dog-waste recording, private
  active routes, completed history, corrections and author-only delete/restore.
- Explicit Demo walks history, including production builds, isolated from real
  household statistics and records. The earlier development-only statement below
  is superseded; see [demo behaviour](walks-demo.md).
- Map controls, optional nearby places, timeline, durable point/finish recovery,
  segmented pause and paused-time calculations. Pause requires schema support.
- Timestamped note journal and daily shared count/manual checks, followed by the
  collar overview and period labels (PR #48). Missing backend support is reported;
  the presence of UI does not prove persistence works on the shared project.
- Scoped public NFC URL `/walks?action=start&household=<UUID>`, retained sign-in
  intent and household checks. Setup/location confirmation is still required;
  this is not an immediate-start NFC implementation or physical tag validation.

See [map controls](walks-map-controls.md), [journal/daily plan](walks-journal-daily.md)
and [collar overview](walks-collar-overview.md) for behaviour and local evidence.

## Pending work and ownership

The following files exist in source; this check did **not** apply them or verify
shared Supabase installation. Earlier handoffs identify them as unapplied by the
implementing agent. Laura must reconcile the actual schema/ledger and coordinate
review/dependencies before any application; never blindly rerun these files.

| Migration | Capability requiring it |
| --- | --- |
| `20261116170000_walk_dog_waste.sql` | Waste preferences, start/save contracts |
| `20261116190000_walk_tracking_choice.sql` | Persisted GPS/time-only choice |
| `20261117130000_deleted_walk_owner_preview.sql` | Author's deleted-route preview |
| `20261118200000_walk_pause_and_notes.sql` | Segment boundaries and legacy note RPC |
| `20261118223000_walk_paused_duration.sql` | Saved pause intervals and duration |
| `20261119001000_walk_journal_and_daily_plan.sql` | Note journal, daily plan/manual checks |

Remaining validation requires two authorised test accounts and real phones/tags:
GPS consent/denial, start retry/duplicate protection, motion and stationary warning
(10 minutes, then 2 minutes unanswered), Keep walking, pause/resume, offline sync,
reload, locked-screen behaviour and NFC/sign-in on Android/iPhone. Local fixtures
and isolated PostgreSQL tests do not establish these results. Background GPS is
not guaranteed. Follow [device checklist](walks-gps-testing.md).

Immediate NFC start after required consent remains a requested behaviour; the
current setup/confirmation flow must not be described as fulfilling it. Agree the
route/consent experience with Laura before changing the shared NFC contract or
writing tags. Walks calendar events/server push are not implemented and are not
new work authorised by an available shared RPC; future integration needs Maria's
explicit contract. Academy remains dog-trick training, not walking lessons.

Release verification remains separate: confirm teammate review/CI, Vercel Git
linkage, main production branch, READY deployment, exact commit and alias. This
update neither merges nor deploys code, changes hosted data, sends team messages,
nor supplies another member's approval.

## Local checks for this update

`npm test`: 245 tests passed across 56 files. `npm run typecheck`,
`npm run build` and `git diff --check` passed. Existing dependencies were reused;
this was not a fresh `npm ci`. Local runtime was Node 26.13.0, while project/CI
uses Node 22; no new Node 22 execution is claimed. Build retained Zod annotation
and bundle-size warnings. No browser flow changed, so no new screenshots/device
checks were performed. No live connectivity/schema check was run in this update.

## Historical snapshot — 17 November 2026 (superseded)


The current Walks source integrates team main at
`a3ec4f2` (Health/account settings PR #31), including the reviewed Feeding,
Academy, dashboard, navigation and Health improvements. All remote branches
were fetched; branches not merged into main were not combined indiscriminately.

Merge resolution preserves Carol's location confirmation, optional GPS/time-only
walks, dog waste preferences/summary, history delete/restore dialogs, deleted
filters and the current approved styling/copy. Team LoadingPlaceholder/EmptyState
components are retained in history, and the shared Academy routing from main is
preserved. No teammate feature directory was replaced by an older local version.

Verification on the integrated tree: 194 isolated tests passed; typecheck and
production build passed. Local and live GPS evidence remain distinct. No hosted
schema/data changes or production deployment were performed.

Carol's migrations remain proposed and unapplied by this agent:
- 20261116170000_walk_dog_waste.sql
- 20261116190000_walk_tracking_choice.sql
- 20261117130000_deleted_walk_owner_preview.sql

Coordinate ordering/shared generated types with Laura and affected owners before
application. The app's new start RPCs require the first two migrations; deleted
route previews require the last policy migration. Background/locked-screen GPS
is not guaranteed by this web implementation. The demo history is development-only.

Publication uses the connected GitHub service because command-line HTTPS push
has no credentials. The feature is for another member's review, without merging
into main or deploying unreviewed changes. Prior local commits are preserved
in the local integration branch when a consolidated publication commit is used.
