# Official Google Maps for Walks

The first conversation mockup was inspired by Google's light map appearance but
used OpenStreetMap geometry. It was not Google cartography. Exact Google imagery
comes from the official Maps JavaScript API, not copies of Google consumer-site
tiles or screenshots. Standard roadmap rendering can vary from the consumer app
because of Google's own rendering, labels, locale, version and personalization.

## Current state

The Google provider code is prepared for all Walks maps: historical previews,
completed details, demonstration walks and the recorder's active route. It uses
`@googlemaps/js-api-loader`, only loads visible maps, shares the library load,
keeps official attribution, draws GPS segments in dark green and keeps gaps open.
Mouse-wheel, pinch and drag interactions are enabled. Live location comes from
the phone after the existing start/resume consent, never from an NFC tag.

No Google Maps key was present during implementation. Without one, the app keeps
its working OpenStreetMap preview and visibly identifies it as OpenStreetMap;
Google Maps must not be claimed as activated or live-verified. Google loader
unit tests mock the API and make no real requests or billable calls.

## Team configuration

1. Use a team-owned Google Cloud project, enable Maps JavaScript API and arrange
   billing. No project, billing account, API activation or spending configuration
   was created/changed by this implementation.
2. Create a **browser** API key restricted to Maps JavaScript API and approved
   website referrers, such as `http://127.0.0.1:5173/*`, `http://localhost:5173/*`
   and the exact production/preview origins that the team intends to support.
   The loader sends origin-only auth referrers; the website restrictions must
   allow the origin, rather than only a particular route path.
3. Add `VITE_GOOGLE_MAPS_API_KEY=<browser key>` to the existing ignored `.env.local`.
   Do not overwrite the other local settings or send keys through chat/issues.
   Never use server or service-role credentials in this browser variable.
4. Restart Vite. For deployment, coordinate the public browser variable with the
   team's configuration owner and rebuild after member review. No deployment
   environment has been changed here.
5. Validate each example, worldwide panning, mouse wheel, physical two-finger
   pinch, Fit route, key/domain rejection, network failure and retry. Then
   verify a disposable real GPS walk with informed users. Google's SDK receives
   map/overlay coordinates and device/network information; the map caption links
   its privacy policy. Active route sharing with family is still forbidden by RLS.

Loading the SDK through a browser key can incur usage charges. Set appropriate
quotas/alerts through the team's normal reviewed Cloud workflow before broad use.
This document does not claim billing, keys, quotas or domain restrictions exist.

Official references:

- https://developers.google.com/maps/documentation/javascript/get-api-key
- https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- https://developers.google.com/maps/documentation/javascript/interaction
- https://developers.google.com/maps/api-security-best-practices

## Verification for this change

The full isolated suite passes 132 tests. New tests cover the missing-key/no-request
case, shared official library loading, failed-load retry, auth-error notification,
combined chronological history, all three totals, completed/active/deleted rules,
mode on/off and calendar periods. Google SDK calls are mocked in these tests.
TypeScript and production build pass on the available Node 26.13.0 runtime;
Node 22.x CI remains the team's required runtime check. Existing bundle-size/Zod
build warnings remain. Browser checks confirmed mode on/off (3 vs 0 fixture walks),
8,320 m / 1h 59m monthly demo totals, Past adventures placement and mouse-wheel zoom
on the explicitly labelled OSM preview. No live Google or physical-pinch validation
has been performed without the configuration/device prerequisites.

## Superseding presentation settings

The user has since chosen Apple Maps as the visual inspiration. No claim is made
that either provider is Apple cartography. Both implementations remove World and
the explanatory supplier banners. Google, if configured, now uses cooperative
gestures and disables double-click zoom; ordinary scrolling does not zoom. The
local classroom fixtures are unlabelled as requested and excluded from production.
Distances in cards and cumulative totals use km.
