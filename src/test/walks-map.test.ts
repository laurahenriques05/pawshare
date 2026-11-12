import { describe, expect, it } from 'vitest'
import { mapCoordinates, mapSegments } from '../features/walks/mapGeometry'
import { acceptable, routeDistance, type Point } from '../features/walks/gps'
import { demoWalks, findDemoWalk } from '../features/walks/demo'
const start = Date.parse('2026-11-08T12:00:00Z')
const point = (latitude: number, longitude: number, seq = 0, seconds = seq * 10): Point => ({ latitude, longitude, accuracy: 3, seq, recorded_at: new Date(start + seconds * 1000).toISOString() })
describe('worldwide route geometry', () => {
 it('uses actual coordinates outside Lisbon, in both hemispheres', () => {
  for (const [lat, lng] of [[40.7128,-74.006],[-33.8688,151.2093],[35.6762,139.6503]]) {
   const points = [point(lat,lng),point(lat + .0001,lng,1)]
   expect(mapCoordinates(points)).toEqual([[lat,lng],[lat+.0001,lng]])
   expect(mapSegments(points)).toHaveLength(1)
  }
 })
 it('keeps eastbound and westbound antimeridian walks local', () => {
  const east = mapCoordinates([point(0,179.9999),point(0,-179.9999,1)])
  expect(east[1][1]-east[0][1]).toBeCloseTo(.0002)
  expect(mapSegments([point(0,179.9999),point(0,-179.9999,1)])).toHaveLength(1)
  const west = mapCoordinates([point(0,-179.9999),point(0,179.9999,1)])
  expect(west[1][1]-west[0][1]).toBeCloseTo(-.0002)
 })
 it('never connects GPS gaps, impossible jumps or invalid coordinates', () => {
  const points = [point(38,-9),point(38.0001,-9,1),point(38.001,-9,2,100),point(38.0011,-9,3,110),point(39,-9,4,120)]
  expect(mapSegments(points).map(segment=>segment.length)).toEqual([2,2])
  expect(mapSegments([point(38,-9),point(NaN,-9,1),point(38.0002,-9,2)])).toEqual([])
  expect(mapCoordinates([point(91,0),point(0,181),point(NaN,0)])).toEqual([])
 })
 it('handles empty/single-fix walks and clamps only the rendered polar latitude', () => {
  expect(mapCoordinates([])).toEqual([])
  expect(mapSegments([point(38,-9)])).toEqual([])
  const polar = point(89,30)
  expect(mapCoordinates([polar])[0][0]).toBeCloseTo(85.05112878)
  expect(polar.latitude).toBe(89)
 })
})
describe('classroom-only walk fixtures', () => {
 it('has exactly three explicit demo IDs and no real database identifiers', () => {
  expect(demoWalks.map(walk=>walk.id)).toEqual(['walk-benfica','walk-expo','walk-alvalade'])
  expect(findDemoWalk('not-a-demo')).toBeUndefined()
  expect(findDemoWalk('demo-benfica')?.id).toBe('walk-benfica')
  expect(findDemoWalk(undefined)).toBeUndefined()
  for (const walk of demoWalks) {
   expect(walk).not.toHaveProperty('household_id')
   expect(walk).not.toHaveProperty('walker_id')
   expect(findDemoWalk(walk.id)).toBe(walk)
  }
 })
 it('derives consistent statistics from plausible synthetic GPS fixes', () => {
  for (const walk of demoWalks) {
   expect(walk.points.length).toBeGreaterThan(100)
   expect(walk.seconds).toBe((walk.points.length-1)*10)
   expect(walk.meters).toBe(routeDistance(walk.points))
   expect(walk.meters).toBeGreaterThan(1000)
   expect(walk.meters/walk.seconds*3.6).toBeLessThan(6)
   walk.points.forEach((fix,i)=>expect(acceptable(fix,walk.points[i-1],Date.parse(fix.recorded_at))).toBe(true))
   expect(mapSegments(walk.points)).toHaveLength(1)
  }
 })
})
