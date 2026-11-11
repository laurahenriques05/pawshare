import { describe, expect, it } from 'vitest'
import { dayKey, stockForecast, stockGrams, regularMeals } from '../features/feeding/model'
import { foodRestockingEvents } from '../features/feeding/integrations'
import type { FeedingEntry, FoodProduct } from '../features/feeding/types'
const p:FoodProduct={id:'p',household_id:'h',name:'Kibble',category:'dry',opening_grams:100,portion_grams:100,daily_grams:200,reminder_days:7,created_at:''}
function entry(id:string,kind:'meal'|'purchase',quantity:number,deleted_at:string|null=null):FeedingEntry { return {id,household_id:'h',product_id:'p',kind,quantity_grams:quantity,occurred_at:'2026-11-11T08:00:00Z',created_by:'u',source:'app',deleted_at,package_grams:null,packages:null,created_at:'',updated_at:''} }
const entries=[entry('1','purchase',2000),entry('2','meal',100),entry('3','meal',100,'2026-11-11')]
describe('Feeding summaries and integration adapter',()=>{
 it('uses corrected ledger quantities and excludes removed records',()=>expect(stockGrams(p,entries)).toBe(2000))
 it('calculates run-out and seven-day advance restocking dates',()=>{
  const f=stockForecast(p,entries,new Date('2026-11-11T12:00:00Z'))
  expect(f.days).toBe(10);expect(f.low).toBe(false)
  expect(f.runsOut?.toISOString()).toBe('2026-11-21T12:00:00.000Z')
  expect(f.buyBy?.toISOString()).toBe('2026-11-14T12:00:00.000Z')
 })
 it('does not invent forecasts for irregular products',()=>expect(stockForecast({...p,daily_grams:0},entries).days).toBeNull())
 it('alerts immediately for low stock and supplies stable integration IDs',()=>{
  const result=foodRestockingEvents([p],[entry('1','meal',50)],new Date('2026-11-11T12:00:00Z'))
  expect(result[0].id).toBe('food-restock:p');expect(result[0].lowStock).toBe(true)
  expect(result[0].remindAt).toBe('2026-11-11T12:00:00.000Z')
 })
 it('uses household dates around midnight and DST changes',()=>{
  expect(dayKey('2026-11-11T00:30:00Z','America/New_York')).toBe(dayKey('2026-11-10T12:00:00Z','America/New_York'))
 })
 it('excludes treats and removed entries from regular meal totals',()=>{
  expect(regularMeals(entries,[p])).toHaveLength(1)
  expect(regularMeals(entries,[{...p,category:'treat'}])).toHaveLength(0)
 })
})
