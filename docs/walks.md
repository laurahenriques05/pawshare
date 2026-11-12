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

All route maps use one provider selection: official Google Maps when
`VITE_GOOGLE_MAPS_API_KEY` is configured; otherwise the existing Leaflet 1.9.4 /
OpenStreetMap preview is explicitly labelled as such. The Google branch is prepared
but not live-verified: this checkout has no configured Google browser key.
See [Google setup and validation](walks-google-maps.md). Both providers cover the
world and support mouse-wheel zoom, touch pinch/drag, keyboard zoom and controls.
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
components as real walks, with an include/exclude control and individual detail URLs
`/walks/walk-benfica`, `/walks/walk-expo`, `/walks/walk-alvalade`. They never call
write RPCs or receive household identities. They appear in Past adventures,
interleaved chronologically with saved walks. In explicit Demonstration mode they
also contribute to the displayed Walks totals for the selected calendar period.
The “Include sample history” checkbox removes them from both that history and
those totals. Home cards, real saved records, reminders and backend totals remain
unaffected. They can be displayed even when the walk database is
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

## Google provider and combined history update (12 November 2026)

Walks now defaults to This month so all three old examples are represented in the
classroom presentation. The displayed monthly demo totals are 3 walks, 8,320 m
(rounded combined distance), and 1h 59m (119 minutes 10 seconds before formatting).
Normal completed walks add one count plus their saved distance and elapsed time;
active/deleted walks are excluded. Demo selection persists in sessionStorage for
the browser tab. Today/week/month still filter by household-local start date.
Disabling demo history shows only real walks and real Walks totals.

Google integration uses the official @googlemaps/js-api-loader, a shared lazy
loader, roadmap tiles with no imitation styling, dark-green polylines, and
gestureHandling=greedy. No Google requests happen without the configured key.
Live Google visual/auth/billing checks and physical touch gestures remain pending.
No hosted database, account security, billing or deployment configuration changed.

## Apple Maps-inspired presentation update (12 November 2026)

This update supersedes the demo-mode controls and wheel/World behaviour described
above. The Mac Maps app was opened, but its tile canvas was blank during native
inspection; Apple Maps on the web supplied the visible cartographic reference.
No Apple Maps SDK, token or hosted service was configured. The working basemap
keeps its licensed provider, with subdued raster colours and quieter controls
inspired by Apple Maps. Required attribution stays visible; verbose supplier and
configuration messages were removed from map captions. The World button is gone
from both provider components; coverage still follows arbitrary GPS coordinates.

Accumulated and individual displayed distances now use kilometres to two decimal
places. Internal distances and SQL remain in metres. The three local presentation
walks appear in Past adventures, contributing to this month's total of 8.32 km,
3 walks and 1h 59m. At the user's explicit request the presentation has no fictional
or demo labels. Those unlabelled fixtures and their detail pages are now gated by
Vite's development flag: production shows only saved walks. They were not inserted
into the database and do not change Home's real household statistics. The former
Include sample history control/session preference is no longer used.

Canonical presentation URLs are `/walks/walk-benfica`, `/walks/walk-expo` and
`/walks/walk-alvalade`; earlier demo-prefixed URLs redirect locally. No shared
router/schema contract changed.

Normal mouse-wheel or two-finger scrolling passes to the page without changing the
map. Trackpad pinch is identified by the browser Ctrl+wheel signal and handled
inside the map. Touch pinch is enabled; one-finger map dragging is disabled for
coarse-pointer devices so normal page scrolling is available. Double-click zoom
is disabled; keyboard/+/- controls and Fit route remain as deliberate accessible
actions. Google, if configured later, uses cooperative gesture handling. Map
updates draw new points without repeatedly fitting the camera.

Browser evidence: ordinary wheel scrolling over the sample map moved page scroll
from 276 to 0 while its scale stayed at 300 m. Physical touch/trackpad pinch still
needs device testing. Gesture tests cover ordinary scrolling, Ctrl+wheel pinch in
both directions, small-event accumulation, reversal and line units; distance tests
cover km formatting. The fixture gate is tested with development on/off.

Local verification for this update: 138 isolated tests, TypeScript and production
build pass on Node 26.13.0 (Node 22.x CI remains required). Browser checks confirmed
km formatting, no World/demo labels, canonical URLs, the legacy local redirect and
normal-scroll camera stability. No production release, hosted migration or data
change was performed; commit/push status is reported in the handoff.

## Vector maps and route reproduction (12 November 2026)

The supplied light-map screenshots now guide a vector basemap instead of a colour
filter over raster street images. MapLibre GL JS 6.18.0 loads a locally stored,
customized OpenFreeMap Positron style and worldwide public vector tiles/fonts.
White roads, pale-green parks, subtle buildings, north and a metric scale match
the reference's visual hierarchy. Credits remain visible but are outside the
vector image, below its controls. A Leaflet raster fallback remains for vector
initialization failure; an optional configured Google provider remains supported.
Neither Apple nor Google imagery is copied. OpenFreeMap requires no account/key.
Provider availability and WebGL performance on real phones still need validation.
The lazy vector renderer/worker add sizeable separate chunks to the build.

Reproduce route appears next to Start/Finish on each map, with Stop replay while
playing. Playback takes approximately 12 seconds, draws by recorded distance and
shows a moving cursor. It never joins missing GPS segments. Starting playback fits
the route once; it does not repeatedly pan the camera. Stop, completion, point-set
changes and unmount clean up animation work. Reduced-motion users receive the full
route without animation. GeoJSON worker updates are coalesced so map rendering can
keep pace with animation. No database/RPC/statistics changes are part of playback.

The visible Pinch/scroll instructions, calendar-period prose, repeated location
footer/detail heading and GPS-calculation help paragraph were removed as requested.
Date and metrics remain. The shared icon tile's inherited bottom margin was the
header misalignment cause; feature-scoped CSS resets it and vertically centres the
complete date/title group against the footsteps tile.

Tests cover playback start/mid/end geometry, distance-based interpolation, gaps,
antimeridian, invalid progress, empty/single-point routes and fixture/statistics
immutability. Browser checks confirmed an intermediate green trail/cursor and the
Stop replay reset. Licensing notices and upstream credits are retained at
`public/licenses/walk-map-style.txt`. No hosted data or migrations were changed.

References: https://openfreemap.org/quick_start/ and
https://github.com/hyperknot/openfreemap-styles.

Final verification for vector maps/playback: 143 isolated tests, TypeScript and
production build pass on the available Node 26.13.0 runtime (Node 22.x CI remains
required). Browser evidence covers an intermediate moving cursor/partial green
trail, Stop replay restoration, automatic completion, unchanged 3-walk/8.32-km/
1h-59m presentation totals, credits outside the image and header centre offset of
0 px between the footsteps tile and date/title block. MapLibre 6.18.0 was chosen
after the earlier major version triggered an npm advisory; installation/audit for
the selected version reports zero vulnerabilities. Existing Zod and bundle-size
build warnings remain; the vector renderer/worker are lazy chunks. Physical phone
GPS/pinch, Google provider live verification and production deployment remain
outside this local evidence.

## Recent-walk preview and quieter playback (12 November 2026)

Walks now shows Last Adventures with only the latest completed entry. Show more
is a link at the section's upper right, opening the separate Past Adventures view
via the existing `/walks?view=history` route. That view shows the complete history
in descending start-time order, paginated in groups of 20. It preserves real
loading/error/empty states and offers a return link to Walks. Summary totals still
use all eligible walks in the selected period, not only the preview. The shared
router, auth, tracker and household providers are unchanged; NFC start intent
clears the history query so its confirmation remains visible.

During replay only the fixed Start marker is shown. The Finish marker, Finish
legend and moving cursor are absent; Finish returns after stopping or completing
playback. This applies to vector, Leaflet fallback and optional Google renderers.
Playback still draws only valid GPS segments and changes no saved data/statistics.

The footsteps tile is 60 px with a 28 px glyph, increased from 42/20 px. The date
and title group is vertically centred. Browser geometry measured an approximately
0.004 px centre difference, below a screen pixel. Browser navigation verified one
card on the main page and all three presentation cards in Past Adventures.

OpenFreeMap explicitly permits omitting its name from visible credits:
https://openfreemap.org/#attribution. The vector source attribution now overrides
only that optional branding, retaining linked OpenMapTiles and OpenStreetMap
credits. This corrects the earlier overly broad statement that every provider
name had to remain. Hosting URLs, data licences and the source/style notices are
preserved. Browser UI confirmed no visible OpenFreeMap credit and only Start
during playback.

143 isolated tests, TypeScript and build pass on Node 26.13.0; Node 22.x CI and
physical-device validation remain pending. No migration, hosted data write, merge
or deployment was performed for this change.
