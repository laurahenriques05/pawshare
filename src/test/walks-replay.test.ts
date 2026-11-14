import { describe, expect, it } from 'vitest'
import { buildReplayTrack, replayFrame } from '../features/walks/routeReplay'
import type { Point } from '../features/walks/gps'
import { demoWalks } from '../features/walks/demo'
const start = Date.parse('2026-11-08T12:00:00Z')
const point = (seq: number, seconds: number, latitude: number, longitude = -9): Point => ({ seq, latitude, longitude, accuracy: 3, recorded_at: new Date(start + seconds * 1000).toISOString() })
describe('route playback geometry', () => {
 it('starts at the first fix, progresses by distance and ends with the exact original line', () => {
  const points = [point(0,0,38),point(1,10,38.0001),point(2,40,38.0004)]
  const before = structuredClone(points), track = buildReplayTrack(points)
  const first = replayFrame(track,0), half = replayFrame(track,.5), end = replayFrame(track,1)
  expect(first.lines).toEqual([])
  expect(first.cursor).toEqual([38,-9])
  expect(half.cursor![0]).toBeCloseTo(38.0002,7)
  expect(half.lines[0]).toHaveLength(3)
  expect(end.lines).toEqual([[[38,-9],[38.0001,-9],[38.0004,-9]]])
  expect(end.cursor).toEqual([38.0004,-9])
  expect(points).toEqual(before)
 })
 it('jumps across GPS gaps without drawing or interpolating the missing segment', () => {
  const track = buildReplayTrack([point(0,0,38),point(1,10,38.0001),point(2,100,38.01),point(3,110,38.0101)])
  expect(track.lines).toHaveLength(2)
  expect(track.total).toBeCloseTo(22.239,2)
  const frame = replayFrame(track,.75)
  expect(frame.lines).toHaveLength(2)
  expect(frame.lines[0]).toEqual([[38,-9],[38.0001,-9]])
  expect(frame.cursor![0]).toBeCloseTo(38.01005,7)
  expect(frame.lines.every(line=>line.length===2)).toBe(true)
 })
 it('crosses the antimeridian locally instead of sweeping around the world', () => {
  const track = buildReplayTrack([point(0,0,0,179.9999),point(1,10,0,-179.9999)])
  expect(replayFrame(track,.5).cursor![1]).toBeCloseTo(180)
  expect(track.total).toBeLessThan(25)
 })
 it('handles empty/single-fix routes and invalid or out-of-range progress', () => {
  expect(replayFrame(buildReplayTrack([]),.5)).toEqual({lines:[],cursor:undefined})
  expect(buildReplayTrack([point(0,0,38)]).total).toBe(0)
  const track = buildReplayTrack([point(0,0,38),point(1,10,38.0001)])
  expect(replayFrame(track,-1)).toEqual(replayFrame(track,0))
  expect(replayFrame(track,NaN)).toEqual(replayFrame(track,0))
  expect(replayFrame(track,2)).toEqual(replayFrame(track,1))
 })
 it('keeps all classroom route coordinates and statistics unchanged after reproduction', () => {
  for (const walk of demoWalks) {
   const snapshot = structuredClone(walk)
   const track = buildReplayTrack(walk.points)
   for (const progress of [0,.1,.25,.5,.75,1]) replayFrame(track,progress)
   expect(walk).toEqual(snapshot)
   expect(track.total).toBeCloseTo(walk.meters,6)
  }
 })
})
