# Classroom walk examples

Walks contains three deliberately fictional records for the classroom presentation:
Benfica (8 November 2026), Expo / Parque das Nações (9 November) and Alvalade
(10 November). They are stored locally in `src/features/walks/demoRoutes.json`,
with IDs prefixed `demo-`. Synthetic points are generated every approximately
12 metres along public street/path geometry, assigned ten-second timestamps
and 3-metre synthetic accuracy. These are illustrations, not observed walks,
live device fixes or recommendations for pedestrian access.

`demo.ts` derives time and distance from the fixture points using the same GPS
calculation as the real feature. No household/user IDs are assigned and no sample
is inserted into Supabase. The samples do not contribute to real statistics,
Home summaries or notifications. They have read-only detail pages via the existing
`/walks/:walkId` route. Hide examples collapses them for the mounted session.
Real start/finish actions continue to require authentication, household membership,
recorder ownership and normal GPS permission. Route maps never substitute a sample
when a real walk fails or has no coordinates.

## Geometry provenance and licence

Public OpenStreetMap API geometry was retrieved on 12 November 2026. The illustrative
paths were assembled offline from connected public street/path ways, then sampled
and simplified; no remote route-planning API is involved. Only coordinate arrays
are shipped, with no OSM contributor account metadata.

- Benfica source: https://www.openstreetmap.org/api/0.6/map?bbox=-9.211,38.744,-9.193,38.756
- Expo source: https://www.openstreetmap.org/api/0.6/map?bbox=-9.101,38.757,-9.089,38.772
- Alvalade source: https://www.openstreetmap.org/api/0.6/map?bbox=-9.149,38.750,-9.135,38.761

Derived geographic data © OpenStreetMap contributors, available under the Open
Database Licence (ODbL): https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/.
Attribution is also visible on every map. The street background comes from the
current online tile service; it is not embedded or available offline. Its styling
can differ from the earlier conversation mockup and is not Google Maps imagery.

## Try it

Sign in, open Walks and scroll to Classroom examples. Open each record, drag and
zoom the map, choose World, then Fit route. Follow the other-example links to
switch between the three areas, or return to All walks. Hide/show the examples
in the history page. The real household summary must remain unchanged.
