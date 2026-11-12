import { lazy, Suspense } from 'react'
import type { Point } from './gps'
import { OpenStreetRouteMap } from './OpenStreetRouteMap'
import { googleMapsConfigured } from './googleMaps'
const GoogleRouteMap = lazy(() => import('./GoogleRouteMap'))

/** One provider choice for history previews, completed walks and live recording. */
export function RouteMap(props: { points: Point[]; compact?: boolean }) {
 if (!googleMapsConfigured()) return <OpenStreetRouteMap {...props}/>
 return <Suspense fallback={<p role="status">Loading Google Maps…</p>}><GoogleRouteMap {...props}/></Suspense>
}
