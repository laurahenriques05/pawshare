# Hosted status update — 19 November 2026

The journal/daily-plan migration was applied as hosted ledger version
`20261119172420`, followed by routine preferences as `20261119172455`, after
explicit user confirmation of team approvals. Do not reapply either migration.
See [rollout evidence and remaining device/account checks](walks-routine-map-details.md#hosted-rollout-evidence--19-november-2026).
The original implementation diagnosis below is historical; it does not describe
the current journal/daily-plan installation status. Earlier pause/segment
migrations were not included in this rollout.

# Walk journal, daily count and opening transitions

## Implemented source behaviour

Save Note appends a distinct timestamped entry, resets the editor to Add a note
and retains older notes. Existing walk.notes remains visible as legacy content;
it is not overwritten by new journal entries. Each append has a stable UUID and
retries cannot duplicate or replace an entry. Notes can be added by the walk's
author while they remain a member; other members read journal entries after the
walk ends. Device drafts and unsynchronised entries survive reopening on the same
device. The history shows Pending sync until the server acknowledges an append.
The requested draft/storage paragraphs are removed; real storage failures remain
visible and keep the editor open. Journal timestamps use the household time zone.

Finish confirmation includes legacy notes, journal entries and any current draft.
The pending end-intent retains a draft until it has been queued durably. A missing
notes RPC cannot strand an otherwise valid completed route: notes remain in the
separate queue and the existing finish RPC can proceed. Network failure still
keeps the finish pending. The history does not claim queued notes are cloud-saved.
Open editors retry on reconnection and periodically while visible.

Today's walks has a user-configured number only, without times. No daily goal is
invented if there is no saved plan. Completed, nondeleted real walks count on the
day they finish in the household time zone. GPS and time-only walks both count.
Demo walks, active walks and deleted walks do not count. Manual Mark as done
records an attestation in the daily checklist, not a fabricated GPS walk, distance
or duration; users can undo only their own checks. Checks occupy distinct slots;
real completed walks fill remaining slots. Recording the same physical outing
both manually and with GPS cannot be inferred automatically; Undo corrects that
manual duplicate. Daily count is shared routine configuration editable by members.
Completed counts refresh from walk state; shared manual checks refresh when the
page gains focus, reconnects and every 30 seconds while visible. Daily boundaries
and server validation use the household time zone. This adds no separate calendar,
notification or general-purpose Tasks system.

Setup titles have a smaller gap. Active metrics use compact cream cards with line
icons. Maps keep their layout dimensions but hide the initial world frame until
the intended camera is ready. Setup approaches only from the nearby map area,
preventing the globe-to-device transition; history uses immediate framing.

## Read-only diagnosis and rollout

The connected project's read-only REST checks returned 42703 for both
walks.pause_intervals and walk_points.segment_start. The journal table returned
PGRST205 before implementation, as expected for a new feature. This is evidence
of missing earlier Walks schema support, not a GPS permission failure. No account
data or secrets were read/printed. These checks did not apply migrations.

20261119001000_walk_journal_and_daily_plan.sql is an UNAPPLIED proposal. Coordinate
its ordering/contracts with Laura, and review before hosted application. It adds
an append-only note journal, daily plan and manual-check tables, private/member
read policies and author/member-checked RPCs. It depends on the core Walks schema;
it does not reapply or edit earlier migrations. Previous segment/pause migrations
remain necessary for their existing features. Generated shared types are untouched.
The client reports unavailable daily planning rather than fabricating a saved goal
when the integration is missing. Migration, merge and production release status
must be checked independently; presence of SQL files does not prove application.

## Verification

Isolated PGlite tests cover author-only journal append, private active notes,
completed-member visibility, stale/repeated IDs, shared routine edits, count bounds,
household-local days, invalid dates/slots, duplicate manual checks, outsider denial
and author-only undo. Queue tests cover missing schema, network loss, retained
entries and removal only after acknowledgement. Pure slot tests exclude demos,
active/deleted/previous-day records and handle worldwide household days.

A temporary, removed browser fixture intercepted account responses. It verified
Save Note resetting the editor, multiple history entries, a pending-service entry,
saved history after reloading, notes in the finish summary, manual daily progress
and a configurable count, tighter setup titles and local map framing. Example
responses and mocked GPS were used; no real account write or physical GPS test
was performed. Public map tiles were real; physical movement and locked-screen behaviour remain
unverified. All 225 isolated tests (50 files), typecheck, build and diff checks passed.
