# Local presentation history

The local Vite development app includes three presentation records in Past
adventures: Benfica (8 November 2026), Expo / Parque das Nações (9 November) and
Alvalade (10 November). Their IDs are `walk-benfica`, `walk-expo` and
`walk-alvalade`. Legacy demo-prefixed detail URLs redirect to the canonical URLs.

These are synthetic classroom fixtures, not observed walks or real device fixes.
At the user's explicit request their cards/detail pages have no fictional or demo
labels. To prevent unlabelled sample history reaching real households, both the
fixture entries and their detail-page lookup are gated by `import.meta.env.DEV`.
A production build shows only real saved household walks. No example is inserted
into Supabase, assigned a household/user ID or included in Home's real statistics.

In local development they contribute to the selected-period Walks totals and are
interleaved with saved walks by start date. This month contains 3 presentation
walks, 8.32 km and 1h 59m (7,150 seconds before time formatting). Internal distance
calculations remain in metres; displayed distances use km with two decimals. There
is no presentation-mode switch or session preference in the current UI.

## Geometry provenance and licence

Coordinate arrays live in `src/features/walks/demoRoutes.json`. Synthetic fixes
were generated approximately every 12 metres along public OpenStreetMap street
and path geometry, assigned ten-second timestamps and 3-metre synthetic accuracy.
`demo.ts` derives their distance/time using the same GPS calculation as the real
feature. These routes illustrate the UI, not recommendations for pedestrian access.

Public geometry was retrieved on 12 November 2026. Paths were assembled offline
from connected street/path ways, then sampled and simplified. No routing API is
involved and no OSM contributor account metadata is shipped.

- Benfica: https://www.openstreetmap.org/api/0.6/map?bbox=-9.211,38.744,-9.193,38.756
- Expo: https://www.openstreetmap.org/api/0.6/map?bbox=-9.101,38.757,-9.089,38.772
- Alvalade: https://www.openstreetmap.org/api/0.6/map?bbox=-9.149,38.750,-9.135,38.761

Derived geographic data © OpenStreetMap contributors, under ODbL:
https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/.
Mandatory source attribution remains visible on each map. Explanatory provider
banners have been removed. The muted palette is inspired by Apple Maps, not Apple
cartography; no Apple service/token was configured. The default light vector style is stored locally, while its worldwide tiles and
fonts are loaded online from OpenFreeMap; they are not embedded for offline use.
Style notices are retained in `public/licenses/walk-map-style.txt`.

## Try it locally

Sign in, open Walks and select This month. Last Adventures previews the latest
entry; Show more opens all records in Past Adventures. Open each
record or follow the other-walk links. Pinch to zoom or use explicit +/- controls;
ordinary mouse-wheel scrolling must move the page without changing the map scale.
Reproduce route animates the green trace with only the Start marker; Stop replay restores the full route and Finish marker. Fit route returns to the recorded trace. World and double-click zoom are removed.
Real GPS capture and SQL permissions are unchanged. The samples cannot be edited
or deleted as real household activities.
