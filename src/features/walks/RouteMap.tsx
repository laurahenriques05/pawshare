import { lazy, Suspense } from 'react'
import type { Point } from './gps'
import { googleMapsConfigured } from './googleMaps'
const VectorRouteMap = lazy(() => import('./VectorRouteMap'))
const GoogleRouteMap = lazy(() => import('./GoogleRouteMap'))

/** One provider choice for history previews, completed walks and live recording. */
export function RouteMap(props: { points: Point[]; compact?: boolean }) {
 if (!googleMapsConfigured()) return <Suspense fallback={<p role="status">Loading map…</p>}><VectorRouteMap {...props}/></Suspense>
 return <Suspense fallback={<p role="status">Loading Google Maps…</p>}><GoogleRouteMap {...props}/></Suspense>
}
