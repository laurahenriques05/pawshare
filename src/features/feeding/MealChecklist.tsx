import { Check, Utensils } from 'lucide-react'
import { Button } from '../../components/ui'
import { todayChecklist } from './checklist'
import type { MealEvent, PlannedMeal } from './types'
export function MealChecklist({plan,events,timezone,names,userId,now,onFeed,onEdit,disabled}:{plan:PlannedMeal[];events:MealEvent[];timezone:string;names:Map<string,string>;userId:string;now:Date;onFeed:(mealId:string)=>void;onEdit:(event:MealEvent)=>void;disabled:boolean}) {
 if(!plan.length)return null
 const rows=todayChecklist(plan,events,timezone,now)
 return <section className="card feeding-checklist"><h2 className="feeding-section-heading"><Utensils size={20} aria-hidden="true"/>Today’s meals</h2><p className="photo-hint">{timezone} · Skipped and refused meals stay visible, so everyone knows what happened.</p><ul>{rows.map(({meal,event,status})=><li key={meal.id} className={`meal-checklist-row meal-checklist-${event?'recorded':status.toLowerCase()}`}><div><span className={`meal-status meal-status-${event?event.outcome:status.toLowerCase()}`}>{event?.outcome==='given'&&<Check size={12} aria-hidden="true"/>}{status}</span><h3>{meal.name} <time>{meal.time}</time></h3>{event&&<p className="photo-hint">{names.get(event.created_by||'')||'Former family member'} · {new Date(event.occurred_at).toLocaleTimeString(undefined,{timeZone:timezone,hour:'2-digit',minute:'2-digit',hour12:false})}{event.notes&&` · ${event.notes}`}</p>}</div>{event ? event.created_by===userId&&<Button className="secondary" onClick={()=>onEdit(event)}>View / correct</Button> : <Button className={status==='Due'?'':'secondary'} disabled={disabled} onClick={()=>onFeed(meal.id)}>Feed this meal</Button>}</li>)}</ul></section>
}
