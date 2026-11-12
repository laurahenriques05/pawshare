# Walks implementation and rollout

Branch: `codex/walk-tracking`, merged into `main` via PR #2 (5433773).
The Walks migration was installed on 2026-11-11 in the existing shared project
`jqxeszipztucnqcywkab`. Verified both tables have RLS enabled, authenticated SELECT
only, no direct authenticated writes, and no anonymous SELECT. Do not rerun the
migration on this project. Production frontend deployment is pending access to
the Vercel account/team that owns `pawshare-laurahenriques05.vercel.app`.

## Install the database feature

An administrator of the existing PawShare Supabase project must run the complete
contents of `supabase/migrations/202611110001_walks.sql` in its SQL Editor once.
It creates only the walk tables, indexes, policies and RPCs. It does not reset the
database, modify existing household data, or require new browser keys.

1. Sign in at https://supabase.com/dashboard using the team's account.
2. Open the existing project matching the public `VITE_SUPABASE_URL` configuration.
3. Open SQL Editor, create a query, paste the new migration and run it once.
4. Reload `/walks` in the app. The setup message should be replaced by the diary.
5. Run the two-account integration checklist below before deploying this branch.

If the team already manages migration history through the Supabase CLI, apply
this migration through that existing workflow instead of independently running
SQL. Coordinate migration history with the administrator; do not reapply older
migrations or reset the shared database. Regenerate the database types when the
connected CLI workflow is available. The browser types have been updated by hand.

The migration was applied through the authenticated Supabase dashboard SQL
Editor. A preflight confirmed the exact project and that both new tables were
absent, then the complete checked-in migration ran successfully in a transaction.
No existing household, dog or authentication records were modified. The browser
key remains unchanged; no new credentials were requested or stored.

## Walk completion flow update (12 November 2026)

The Start Walk confirmation and location permission precede GPS recording.
The NFC tag on the leash opens this flow; position fixes come from the phone
carried by the walker. The tag itself does not supply location.

After a manual end confirmation on `/walks`, the page opens the completed walk's
detail once the server returns its saved completion. Pending offline completion
shows a saving notice and stays on the current page until synchronization succeeds.
Leaving the page or refreshing clears this navigation intent; the completed walk
can still be opened from history. Cancelling the confirmation keeps recording.
The existing map shows a GPS trace without streets. Physical NFC, outdoor GPS and
screen-lock behaviour still require real-device validation. No schema migration
or hosted configuration change is part of this update.

## Implemented

- `/walks`: explicit start/end confirmation, active status, elapsed time, GPS,
  daily/weekly/monthly summaries, paginated history and restored/deleted entries.
- `/walks/:walkId`: completed route, distance, duration, average speed and pace,
  recorder-only time/note corrections, reversible deletion and restore.
- Home: last completed walk, completed time/distance today, active status without
  coordinates, link to Walks, loading/error/retry/empty states.
- `/walks?action=start`: NFC-compatible link. Sign-in/onboarding are required;
  a 30-minute session-storage marker resumes the confirmation on the same browser.
  It uses the selected household, whose name is shown before confirmation.
  No account, email, household ID or secret is embedded in the tag. Opening or
  prefetching the link never creates a walk.
- `/walks/gps-test`: memory-only position-delivery diagnostic, separate from walks.
- `/walks/learn`: Carol's walking lesson. Shared Academy XP/progress is pending
  Maria's system; no artificial completion data is written.

## Database security

`walks` contains household-readable metadata; `walk_points` contains coordinates
under a separate RLS policy. During recording only the recorder can SELECT points.
After completion current household members may SELECT points. Only the recorder,
while still a household member, may call append/finish/correct/delete/restore.
Direct client INSERT/UPDATE/DELETE on either table is revoked. Anonymous callers
cannot read tables or execute these RPCs. Deleted metadata is visible only to its
recorder for restoring; deleted routes are hidden from everyone until restored.

`start_walk` takes a per-dog transaction advisory lock and a partial unique index
allows only one active walk per dog. Same-recorder retries return that existing
walk; another member receives a conflict. Append and finish lock the walk row.
Point batches have contiguous sequence numbers and exact retry matching; a
conflicting retry fails instead of silently overwriting a route. Finish is
idempotent and calculates distance on the server from recorded coordinates.
Corrections can change times and notes but cannot change recorder, family, dog,
or raw coordinates. Corrected times must enclose every recorded GPS point.

## Recording, interruptions and offline behaviour

Start needs a connection to create the real database record. GPS uses the browser
Geolocation API only after explicit confirmation. It accepts fresh fixes (within
30 seconds), accuracy ≤50 m, at least five seconds apart. Speeds above 5 m/s are
ignored unless the delivery gap exceeds 60 seconds. Distance excludes those gaps,
impossible jumps, and movement below max(3 m, average endpoint accuracy), to reduce
stationary jitter. Conservative filtering can undercount slow/poor-signal walks.
Maps show gaps rather than inventing missing routes. Average speed/pace use full
elapsed time, including pauses. No GPS means a time-only walk, with distance zero.

Accepted unsaved points and a pending finish request are buffered in localStorage
under account + household + walk identity. They are retried in batches of at most
500 every five seconds and on reconnection. Exact sequence retries prevent
network retries from duplicating points. End stops GPS immediately; publication
of the completed route waits for successful upload and finalization. Its end time
is the original End action, even if synchronization happens later.

The tracker stays mounted across Home/Walks navigation. Leaving the authenticated
app, changing household, signing out, closing or reloading stops the GPS watcher.
A refresh recovers an active walk and its local unsaved points after reconnecting;
press Resume GPS explicitly. Startup and household/auth recovery still require a
network connection; there is no offline service-worker app shell. Positions missed
while the app was stopped or suspended cannot be recovered. Local storage full or
unavailable is reported; keep the page open to save pending points. Buffers remain
on the recording device until successfully finalized. They are not shared with
another signed-in account, but anyone with access to browser storage on that device
can inspect them; use a trusted device and clear site data when retiring it.

Web Locks prevent two tabs of this browser recording the same walk at once.
Use one recording device per walk: conflicting sequences from another device
are rejected. A remote finish stops the local tracker on the next metadata poll.
Household status is refreshed every 30 seconds while visible and on entering the
feature, without requiring Supabase Realtime publication configuration.

## Automatic ending and notifications

Optional and off by default for each mounted session. Provisional policy:

- Fixes with accuracy ≤25 m remain within 30 m of an anchor for ten minutes.
- Show an in-app warning offering Keep walking. With continued fresh GPS,
  finish after another two minutes, at the actual finish time.
- Moving outside the radius, Keep walking, hiding the app, location errors,
  poor accuracy or >15 seconds without a good fix cancels the warning and resets
  the stationary window. Missing GPS never means stationary.
- No automatic ending while hidden, screen-locked or suspended. The timer does
  not make up for missed background execution when the app returns.

`notifications.ts` exports `registerWalkNotifications(adapter)` with `show(id,
onOpen)` and `cancel(id)` for Maria's shared system. The default optionally uses
browser Notification where supported, after a separate permission button. Its
click opens the app; Keep walking is confirmed in-app. Mobile platforms that need
service-worker notifications retain the in-app fallback. There is no push server,
background GPS or guaranteed screen-locked notification delivery in this change.

## Maps, NFC and Academy coordination

Route maps now use Leaflet 1.9.4 and OpenStreetMap street tiles worldwide.
The viewport is derived from each walk's coordinates, with no Lisbon boundary.
Users can drag, pinch/zoom, fit the route or choose World. Longitude unwrapping
keeps antimeridian crossings local. Like standard Web Mercator maps, the basemap
ends near ±85.05° latitude; stored GPS coordinates are not truncated. Detail and
history cards show distance in metres, duration and average speed, including stops.
GPS gaps remain disconnected. Existing recorder-only active-route RLS is unchanged.

Street tiles load only when the map enters the viewport. Requests use HTTPS,
normal browser caching, visible attribution and an origin-only Referer (per-image
policy, without changing the application's no-referrer header for invitations).
Only the visible area is requested: no offline tile downloads or prefetching.
The external provider receives IP and viewed tile areas; this is disclosed beneath
each map. Exact GPS points stay in the browser/Supabase and are not submitted to a
routing service. Internet and provider availability are needed for street imagery;
a tile failure leaves the recorded trace visible with a retry action. OSM's public
service has no SLA; reassess a managed tile provider before large-scale rollout.
See https://operations.osmfoundation.org/policies/tiles/.

Three classroom examples (Benfica, Expo and Alvalade) are visible under Walks,
clearly marked as fictional. They use the same interactive map and statistics
components as real walks, with a hide/show control and individual detail URLs
`/walks/demo-benfica`, `/walks/demo-expo`, `/walks/demo-alvalade`. They never call
write RPCs, receive household identities or enter family summaries, Home cards,
reminders or real history. They can be displayed even when the walk database is
unavailable, after normal authentication and household onboarding. No migration
or hosted data mutation is needed. See [demo provenance](walks-demo.md).

Proposed NFC convention: `/<feature>?action=<action>`, currently
`/walks?action=start`. Laura should use/confirm the common convention for Feed.
Copy the link in Walks, verify it on the deployment, then write it as a URL record
to a reusable physical NFC tag. Localhost is only for development; use HTTPS for
phone/tag testing. NFC hardware writing and physical taps have not been tested.

Carol's Academy contribution is in `/walks/learn` and
`docs/academy/walking-basics.md`. Maria can adapt it to her shared content schema.
Do not build a second XP or notifications system just for Walks.

## Validation and release checklist

Automated PostgreSQL/PGlite tests use real authenticated/anonymous database roles
and run the migration: active-route privacy, completed sharing, other-household
isolation, all writer ownership rules, direct-write denial, idempotent start/append/
finish, sequence conflicts, coordinate/time/accuracy constraints, server distance,
corrections, deletion/restoration and membership revocation. GPS unit tests cover
known distances, noisy/impossible/stale fixes, gaps, stationarity resets, household
time zones and summary exclusion/correction semantics. `npm test`, `npm run build`
and `git diff --check` are the local checks. Build has the existing bundle-size and
Zod annotation warnings.

Visual verification uses isolated sample fixtures, not real Supabase records:
desktop and 390px mobile, active walk, completed details/map, edit fields, NFC
confirmation, keyboard Escape and focus return. The three explicitly labelled classroom fixtures are included in the app;
they are separate from production household data. This does not replace the following live checks:

1. Owner A starts, retries Start, records outdoors, refreshes and explicitly resumes.
2. Member B sees active status but no coordinates via UI and direct API. B cannot
   finish, edit or delete A's walk, even if B owns the family.
3. A loses connection while walking, returns online, then ends. All buffered points
   arrive once; the finished route becomes available to B.
4. End offline, reconnect and retry; recorded end time stays at the End action.
5. Deny GPS: time-only walk remains finishable and permission recovery is explained.
6. Correct A's times/notes; verify Home and summary recalculate. Delete and restore.
7. Account C in another family cannot read either metadata or coordinates.
8. Test duplicate tabs and switching devices; use the original recording device if
   a sequence conflict is reported. Do not clear unsaved data to hide a conflict.
9. Follow `walks-gps-testing.md` on iPhone/Safari and Android/Chrome; record observed
   screen-lock/background behaviour. Physical tests remain pending.
10. Enable the optional reminder, remain stationary outdoors with continuous GPS,
    respond Keep walking, then repeat without responding. Verify movement/lost GPS/
    app hiding cancels rather than ends; correct an incorrectly ended walk.
11. Sign out, open NFC link, sign in/onboard and verify explicit family confirmation.
    No mutation occurs before Confirm start. Repeat with a physical tag over HTTPS.
12. Coordinate the migration and deploy the reviewed branch. No production deploy,
    forced merge, new paid service or teammate message is part of local validation.

Browser API references used for implementation:
[Geolocation watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition)
and [Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API).

## Worldwide maps update validation (12 November 2026)

125 isolated tests pass, including synthetic routes in New York, Sydney and Tokyo,
antimeridian crossings in both directions, invalid/polar/empty coordinates, GPS
gaps and all three demo fixtures. Existing SQL security tests remain unchanged.
Typecheck/build checks use the available Node 26.13.0 runtime, not the requested
Node 22.x; CI/team verification under Node 22.x remains needed. Browser checks
cover the sample detail routes and map controls; they do not prove outdoor GPS,
physical NFC, screen-locked tracking or worldwide map detail quality.
