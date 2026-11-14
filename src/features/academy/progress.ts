import type { AcademyModuleProgress, AcademyPractice } from '../../lib/supabase/database.types'
import { ACADEMY_RULES, academyModules } from './catalog'

function localDate(instant:string,zone:string) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant))
 const value=(type:string)=>parts.find(part=>part.type===type)!.value
 return `${value('year')}-${value('month')}-${value('day')}`
}
function dayBefore(day:string) { const [y,m,d]=day.split('-').map(Number); return new Date(Date.UTC(y,m-1,d-1)).toISOString().slice(0,10) }
export function academyProgress(records:AcademyPractice[],zone:string,now=new Date(),milestones:AcademyModuleProgress[]=[]) {
 const live=records.filter(record=>!record.deleted_at)
 const completedIds=new Set(milestones.map(record=>record.module_id))
 const xp=completedIds.size*ACADEMY_RULES.xpPerModule
 const practiceDays=new Set(live.map(record=>localDate(record.practiced_at,zone)))
 const today=localDate(now.toISOString(),zone)
 let cursor=practiceDays.has(today)?today:dayBefore(today)
 let streak=0
 while(practiceDays.has(cursor)){streak++;cursor=dayBefore(cursor)}
 const completedCount=completedIds.size
 return {
  completedIds,xp,level:Math.floor(xp/ACADEMY_RULES.xpPerLevel)+1,streak,
  completedCount,
  badges:ACADEMY_RULES.badgeModuleCounts.filter(count=>completedCount>=count).map(count=>count===1?'First lesson':`${count} lessons`),
  nextModule:academyModules.find(module=>!completedIds.has(module.id)),
 }
}
