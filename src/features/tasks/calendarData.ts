import { db } from '../../lib/supabase/client'
import type { FeedingEntry, FoodProduct } from '../feeding/types'
import { foodRestockingEvents } from '../feeding/integrations'
import { localTime, toInstant } from '../health/time'
import type { CalendarEvent } from './model'
import { monthRange } from './model'

async function feedingLedger(householdId:string):Promise<FeedingEntry[]> {
 const rows:FeedingEntry[]=[]
 for(let offset=0;offset<20000;offset+=500){
  const result=await db().from('feeding_entries').select('*').eq('household_id',householdId).range(offset,offset+499)
  if(result.error)throw result.error
  rows.push(...(result.data||[]))
  if((result.data||[]).length<500)break
 }
 return rows
}

export async function loadCalendarEvents(householdId:string,zone:string,month:string):Promise<CalendarEvent[]> {
 const range=monthRange(month);const from=range.from;const until=range.until
 const generated=await db().rpc('generate_task_occurrences',{p_household:householdId,p_from:from,p_until:until})
 if(generated.error)throw generated.error
 const [occurrenceResult,appointmentsResult,vaccinationsResult,schedulesResult,productsResult,entries]=await Promise.all([
  db().from('task_occurrences').select('*').eq('household_id',householdId).gte('due_at',from).lt('due_at',until),
  db().from('vet_appointments').select('id,title,starts_at').eq('household_id',householdId).gte('starts_at',from).lt('starts_at',until),
  db().from('vaccinations').select('id,name,next_due_on').eq('household_id',householdId).not('next_due_on','is',null).gte('next_due_on',`${month}-01`).lt('next_due_on',nextMonth(month)+'-01'),
  db().from('medication_schedules').select('id,name').eq('household_id',householdId),
  db().from('food_products').select('*').eq('household_id',householdId),
  feedingLedger(householdId),
 ])
 for(const result of [occurrenceResult,appointmentsResult,vaccinationsResult,schedulesResult,productsResult])if(result.error)throw result.error
 const events:CalendarEvent[]=(occurrenceResult.data||[]).map(row=>({id:`task:${row.id}`,source:'task',sourceRecordId:row.id,title:row.title,occursAt:row.due_at,remindAt:new Date(Date.parse(row.due_at)-3600000).toISOString(),assignedTo:row.assigned_to,href:`/tasks?occurrence=${encodeURIComponent(row.id)}`,completed:!!row.completed_at}))
 for(const visit of appointmentsResult.data||[])events.push({id:`health:appointment:${visit.id}`,source:'health',sourceRecordId:visit.id,title:visit.title,occursAt:visit.starts_at,remindAt:new Date(Date.parse(visit.starts_at)-86400000).toISOString(),assignedTo:null,href:'/health/appointments'})
 for(const vaccine of vaccinationsResult.data||[])if(vaccine.next_due_on){const at=toInstant(`${vaccine.next_due_on}T12:00`,zone);events.push({id:`health:vaccination:${vaccine.id}`,source:'health',sourceRecordId:vaccine.id,title:`Vaccination · ${vaccine.name}`,occursAt:at,remindAt:null,assignedTo:null,href:`/health/vaccinations?record=${encodeURIComponent(vaccine.id)}`,allDay:true})}
 const schedules=schedulesResult.data||[]
 if(schedules.length){
  const doses=await db().from('medication_doses').select('id,schedule_id,scheduled_at,status').in('schedule_id',schedules.map(schedule=>schedule.id)).eq('status','scheduled').gte('scheduled_at',from).lt('scheduled_at',until)
  if(doses.error)throw doses.error
  const names=new Map(schedules.map(schedule=>[schedule.id,schedule.name]))
  for(const dose of doses.data||[])events.push({id:`health:medication:${dose.id}`,source:'health',sourceRecordId:dose.id,title:`Medication · ${names.get(dose.schedule_id)||'Dose due'}`,occursAt:dose.scheduled_at,remindAt:dose.scheduled_at,assignedTo:null,href:`/health/medications?dose=${encodeURIComponent(dose.id)}`})
 }
 const products=(productsResult.data||[]) as FoodProduct[]
 for(const restock of foodRestockingEvents(products,entries).filter(event=>localTime(event.occursAt,zone).slice(0,7)===month))events.push({id:restock.id,source:'feeding',sourceRecordId:restock.sourceRecordId,title:restock.title,occursAt:restock.occursAt,remindAt:restock.remindAt,assignedTo:null,href:restock.href})
 return events.sort((a,b)=>a.occursAt.localeCompare(b.occursAt))
}
function nextMonth(month:string){const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number,1)).toISOString().slice(0,7)}
