import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Walk } from '../lib/supabase/database.types'
import { demoWalks } from '../features/walks/demo'
import { filterHistory, summarizeHistory, walkHistory, presentationHistoryEnabled } from '../features/walks/history'
const now = new Date('2026-11-12T12:00:00Z')
const saved = (id: string, ended = true, deleted = false): Walk => ({ id, household_id: 'h', dog_id: 'd', walker_id: 'u', started_at: '2026-11-11T12:00:00Z', ended_at: ended ? '2026-11-11T12:10:00Z' : null, distance_m: 700, notes: '', end_reason: ended ? 'manual' : null, deleted_at: deleted ? '2026-11-11T13:00:00Z' : null })
afterEach(()=>vi.unstubAllEnvs())
describe('Past adventures and displayed totals', () => {
 it('filters calendar periods before pagination and preserves the source history', () => {
  const entries = ['2025-12-31', '2026-01-01', '2026-10-31', '2026-11-01', '2026-11-08', '2026-11-09', '2026-11-12', '2026-11-13'].map(day => ({id:day,title:'Walk',startedAt:`${day}T12:00:00Z`,meters:100,seconds:60,demo:false}))
  const ids = (period: 'day'|'week'|'month'|'year') => filterHistory(entries,period,'Europe/Lisbon',now).map(entry=>entry.id)
  expect(ids('day')).toEqual(['2026-11-12'])
  expect(ids('week')).toEqual(['2026-11-09','2026-11-12'])
  expect(ids('month')).toEqual(['2026-11-01','2026-11-08','2026-11-09','2026-11-12'])
  expect(ids('year')).toEqual(['2026-01-01','2026-10-31','2026-11-01','2026-11-08','2026-11-09','2026-11-12'])
  expect(entries).toHaveLength(8)
 })
 it('uses the household local year and day across UTC midnight', () => {
  const entries = ['2026-12-31T14:30:00Z','2026-12-31T15:30:00Z','2027-01-01T15:30:00Z'].map(startedAt => ({id:startedAt,title:'Walk',startedAt,meters:100,seconds:60,demo:false}))
  const localNewYear = new Date('2026-12-31T16:00:00Z')
  expect(filterHistory(entries,'year','Asia/Tokyo',localNewYear).map(entry=>entry.id)).toEqual(['2026-12-31T15:30:00Z'])
  expect(filterHistory(entries,'day','Asia/Tokyo',localNewYear).map(entry=>entry.id)).toEqual(['2026-12-31T15:30:00Z'])
 })
 it('shows unlabelled presentation history only during local development',()=>{
  vi.stubEnv('DEV',false)
  expect(presentationHistoryEnabled()).toBe(false)
  expect(walkHistory([saved('real')],presentationHistoryEnabled(),'u').map(w=>w.id)).toEqual(['real'])
  vi.stubEnv('DEV',true)
  expect(walkHistory([],presentationHistoryEnabled(),'u')).toHaveLength(3)
 })
 it('includes all three samples in monthly demo totals and keeps source data untouched', () => {
  const source = [saved('real'), saved('active', false), saved('deleted', true, true)]
  const before = structuredClone(source)
  const history = walkHistory(source, true, 'u')
  expect(history.map(entry=>entry.id)).toEqual(['real','walk-alvalade','walk-expo','walk-benfica'])
  expect(history.filter(entry=>entry.demo)).toHaveLength(3)
  const totals = summarizeHistory(history,'month','Europe/Lisbon',now)
  expect(totals.count).toBe(4)
  expect(totals.meters).toBeCloseTo(700 + demoWalks.reduce((sum,walk)=>sum+walk.meters,0),7)
  expect(totals.seconds).toBe(600 + demoWalks.reduce((sum,walk)=>sum+walk.seconds,0))
  expect(source).toEqual(before)
 })
 it('switches off demo history and totals together', () => {
  const history = walkHistory([saved('real')], false, 'u')
  expect(history.map(entry=>entry.id)).toEqual(['real'])
  expect(summarizeHistory(history,'month','Europe/Lisbon',now)).toEqual({count:1,meters:700,seconds:600})
  expect(walkHistory([],false,'u')).toEqual([])
 })
 it('increments count, distance and time exactly once when a real walk finishes', () => {
  const active = saved('recording',false)
  const before = summarizeHistory(walkHistory([active],true,'u'),'month','Europe/Lisbon',now)
  const completed = {...active,ended_at:'2026-11-11T12:10:00Z',end_reason:'manual' as const}
  const after = summarizeHistory(walkHistory([completed],true,'u'),'month','Europe/Lisbon',now)
  expect(after.count-before.count).toBe(1)
  expect(after.meters-before.meters).toBeCloseTo(700)
  expect(after.seconds-before.seconds).toBe(600)
 })
 it('respects selected periods: old examples do not count as today’s walks', () => {
  const history = walkHistory([],true,'u')
  expect(summarizeHistory(history,'day','Europe/Lisbon',now).count).toBe(0)
  expect(summarizeHistory(history,'week','Europe/Lisbon',now).count).toBe(2)
  expect(summarizeHistory(history,'month','Europe/Lisbon',now).count).toBe(3)
 })
})
