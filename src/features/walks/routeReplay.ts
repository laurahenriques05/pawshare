import { distance, type Point } from './gps'
import { mapSegments } from './mapGeometry'
export type RouteCoordinate = [number, number]
export type ReplayFrame = { lines: RouteCoordinate[][]; cursor?: RouteCoordinate }
type Edge = { line: number; from: RouteCoordinate; to: RouteCoordinate; start: number; end: number }
export type ReplayTrack = { lines: RouteCoordinate[][]; edges: Edge[]; total: number }

export function buildReplayTrack(points: Point[]): ReplayTrack {
 const lines = mapSegments(points), edges: Edge[] = []
 let total = 0
 lines.forEach((line, index) => line.forEach((to, i) => {
  if (!i) return
  const from = line[i - 1]
  const length = distance({ latitude: from[0], longitude: from[1] }, { latitude: to[0], longitude: to[1] })
  if (!length) return
  edges.push({ line: index, from, to, start: total, end: total + length }); total += length
 }))
 return { lines, edges, total }
}
/** Draw only recorded segments; a missing GPS interval is never animated as a connecting line. */
export function replayFrame(track: ReplayTrack, progress: number): ReplayFrame {
 const ratio = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0
 if (ratio === 1) return { lines: track.lines, cursor: track.lines.at(-1)?.at(-1) }
 const target = track.total * ratio, lines: RouteCoordinate[][] = []
 let cursor = track.lines[0]?.[0]
 for (const edge of track.edges) {
  if (target < edge.start) break
  const line = lines[edge.line] ||= [edge.from]
  const fraction = Math.min(1, (target - edge.start) / (edge.end - edge.start))
  cursor = [edge.from[0] + (edge.to[0] - edge.from[0]) * fraction, edge.from[1] + (edge.to[1] - edge.from[1]) * fraction]
  if (fraction > 0) line.push(cursor)
  if (fraction < 1) break
 }
 return { lines: lines.filter(line => line.length > 1), cursor }
}
