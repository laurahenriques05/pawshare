import { segment, type Point } from './gps'
type Coordinate = [number, number]
const valid = (point: Point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
/** Unwrap the antimeridian so a walk from 179.999° to -179.999° fits locally. */
export function mapCoordinates(points: Point[]): Coordinate[] {
 const result: Coordinate[] = []
 for (const point of points) {
  if (!valid(point)) continue
  let longitude = point.longitude
  const previous = result.at(-1)?.[1]
  if (previous !== undefined) longitude += Math.round((previous - longitude) / 360) * 360
  result.push([Math.max(-85.05112878, Math.min(85.05112878, point.latitude)), longitude])
 }
 return result
}
export function mapSegments(points: Point[]): Coordinate[][] {
 const result: Coordinate[][] = []
 let previous: Point | undefined
 let longitude: number | undefined
 for (const point of points) {
  if (!valid(point)) { previous = undefined; continue }
  const lng: number = point.longitude + (longitude === undefined ? 0 : Math.round((longitude - point.longitude) / 360) * 360)
  const coordinate: Coordinate = [Math.max(-85.05112878, Math.min(85.05112878, point.latitude)), lng]
  if (!previous || segment(previous, point) === 0) result.push([coordinate])
  else result.at(-1)!.push(coordinate)
  previous = point; longitude = lng
 }
 return result.filter(line => line.length > 1)
}
