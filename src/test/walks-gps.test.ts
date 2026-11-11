import { describe,it,expect } from 'vitest'
import { acceptable,distance,routeDistance,stationaryFix,stationaryTick,paceLabel,summarize,periodStart,type Point } from '../features/walks/gps'
import type { Walk } from '../lib/supabase/database.types'
const t=Date.parse('2026-11-11T12:00:00Z')
const p=(seq:number,seconds:number,latitude=38,accuracy=5):Point=>({seq,recorded_at:new Date(t+seconds*1000).toISOString(),latitude,longitude:-9,accuracy})
describe('GPS filtering and walking calculations',()=>{
 it('measures known segments and never bridges missing GPS or impossible jumps',()=>{
  expect(distance(p(0,0),p(1,10,38.0001))).toBeCloseTo(11.1195,2)
  expect(routeDistance([p(0,0),p(1,10,38.0001),p(2,130,38.01),p(3,140,39)])).toBeCloseTo(11.1195,2)
 })
 it('rejects noisy, stale, rapid, invalid and implausible fixes',()=>{
  expect(acceptable(p(0,0),undefined,t)).toBe(true)
  expect(acceptable(p(0,0,38,51),undefined,t)).toBe(false)
  expect(acceptable(p(0,0),undefined,t+31000)).toBe(false)
  expect(acceptable(p(1,1),p(0,0),t+1000)).toBe(false)
  expect(acceptable(p(1,10,39),p(0,0),t+10000)).toBe(false)
  expect(acceptable(p(1,100,39),p(0,0),t+100000)).toBe(true)
  expect(acceptable(p(0,0,NaN),undefined,t)).toBe(false)
 })
 it('resets stationarity on movement, delivery gaps, or poor accuracy',()=>{
  const first=stationaryFix(null,p(0,0))!
  const next=stationaryFix(first,p(1,10,38.00005))!
  expect(next.since).toBe(t)
  expect(stationaryFix(next,p(2,20,38.001))!.since).toBe(t+20000)
  expect(stationaryFix(next,p(2,100))!.since).toBe(t+100000)
  expect(stationaryFix(next,p(2,20,38,30))).toBe(null)
 })
 it('warns after ten minutes, ends after two more, and never catches up after GPS loss or backgrounding',()=>{
  const state={anchor:p(0,0),since:t,last:t+600000,warnedAt:null}
  const warning=stationaryTick(state,t+600000,true,true,true)
  expect(warning.action).toBe('warn')
  expect(stationaryTick({...warning.state!,last:t+719000},t+719000,true,true,true).action).toBe('none')
  expect(stationaryTick({...warning.state!,last:t+720000},t+720000,true,true,true).action).toBe('end')
  expect(stationaryTick(warning.state,t+720000,true,true,true)).toEqual({state:null,action:'none'})
  expect(stationaryTick(state,t+600000,true,false,true)).toEqual({state:null,action:'none'})
  expect(stationaryTick(state,t+600000,false,true,true).action).toBe('none')
  expect(stationaryTick(state,t+600000,true,true,false).action).toBe('none')
  expect(stationaryTick(null,t+720000,true,true,true).action).toBe('none')
 })
 it('does not count small jitter within reported GPS accuracy',()=>{expect(routeDistance([p(0,0,38,10),p(1,10,38.00002,10)])).toBe(0)})
 it('shows undefined pace without meaningful distance',()=>{expect(paceLabel(0,100)).toBe('—');expect(paceLabel(1000,600)).toBe('10:00 min/km')})
})
const walk=(start:string,end:string,deleted_at:string|null=null):Walk=>({id:'x',household_id:'h',dog_id:'d',walker_id:'u',started_at:start,ended_at:end,distance_m:1000,notes:'',end_reason:'manual',deleted_at})
describe('household calendar summaries',()=>{
 it('uses household midnight, Monday weeks and month boundaries',()=>{
  const now=new Date('2026-11-11T23:30:00Z')
  expect(periodStart('day','Europe/Helsinki',now)).toBe('2026-11-12')
  expect(periodStart('week','Europe/Lisbon',now)).toBe('2026-11-09')
  expect(periodStart('month','Europe/Lisbon',now)).toBe('2026-11-01')
 })
 it('excludes active and deleted walks and includes time corrections',()=>{
  const walks=[walk('2026-11-11T23:00:00Z','2026-11-11T23:20:00Z'),walk('2026-11-10T12:00:00Z','2026-11-10T12:10:00Z'),walk('2026-11-11T12:00:00Z','2026-11-11T12:10:00Z','deleted'),{...walk('2026-11-11T12:00:00Z','2026-11-11T12:10:00Z'),ended_at:null}]
  expect(summarize(walks,'day','Europe/Helsinki',new Date('2026-11-11T23:30:00Z'))).toEqual({count:1,meters:1000,seconds:1200})
  expect(summarize(walks,'week','Europe/Lisbon',new Date('2026-11-11T23:30:00Z')).count).toBe(2)
 })
})
