import routes from './demoRoutes.json'
import { routeDistance, type Point } from './gps'

export type DemoWalk = { id: string; title: string; location: string; startedAt: string; points: Point[]; meters: number; seconds: number }
/** Presentation fixtures only: never sent to Supabase or included in summaries. */
export const demoWalks: DemoWalk[] = routes.map(route => {
 const points: Point[] = route.coordinates.map(([longitude, latitude], seq) => ({
  seq, longitude, latitude, accuracy: 3,
  recorded_at: new Date(Date.parse(route.startedAt) + seq * 10_000).toISOString(),
 }))
 return { ...route, points, meters: routeDistance(points), seconds: Math.max(1, points.length - 1) * 10 }
})
export const findDemoWalk = (id: string | undefined) => demoWalks.find(walk => walk.id === id)
