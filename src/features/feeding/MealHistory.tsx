import { Button } from '../../components/ui'
import { formatGrams } from './model'
import { outcomeLabels } from './checklist'
import type { FeedingEntry,FoodProduct,MealEvent } from './types'
export function MealHistory({events,entries,products,names,timezone,userId,onEdit}:{events:MealEvent[];entries:FeedingEntry[];products:FoodProduct[];names:Map<string,string>;timezone:string;userId:string;onEdit:(event:MealEvent)=>void}) {
 return <ul className="invitation-list meal-history">{events.map(event=>{const lines=entries.filter(e=>e.event_id===event.id&&!e.deleted_at);return <li key={event.id}><div><strong>{event.meal_name} · {outcomeLabels[event.outcome]}</strong><small>{names.get(event.created_by)||'Former family member'} · {new Date(event.occurred_at).toLocaleString(undefined,{timeZone:timezone,hour12:false})}{event.source==='nfc'?' · NFC':''}</small>{lines.map(line=><p className="photo-hint" key={line.id}>{products.find(p=>p.id===line.product_id)?.name||'Food'}: {formatGrams(Number(line.quantity_grams))} served{line.eaten_grams!=null?` · ${formatGrams(Number(line.eaten_grams))} eaten`:''}</p>)}{event.outcome==='skipped'&&<p className="photo-hint">No food served · no stock deducted</p>}{event.notes&&<p className="photo-hint">{event.notes}</p>}</div>{event.created_by===userId&&<Button className="secondary" onClick={()=>onEdit(event)}>View / correct</Button>}</li>})}</ul>
}
