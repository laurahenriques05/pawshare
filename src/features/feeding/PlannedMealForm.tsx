import { useState,type FormEvent } from 'react'
import { Button,Field,Notice,errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { categories,localDateTime } from './model'
import type { FeedingEntry,FoodProduct,PlannedMeal,MealEvent,MealOutcome } from './types'
type Line={product_id:string;quantity_grams:number;eaten_grams:number}
export function PlannedMealForm({householdId,products,plan,source,initialMealId,event,entries=[],onSaved,onCancel}:{householdId:string;products:FoodProduct[];plan:PlannedMeal[];source:'app'|'nfc';initialMealId?:string;event?:MealEvent;entries?:FeedingEntry[];onSaved:()=>void;onCancel:()=>void}) {
 const [id]=useState(()=>event?.id||crypto.randomUUID())
 const first=plan.find(p=>p.id===(event?.routine_meal_id||initialMealId))||plan[0]
 const [selected,setSelected]=useState(event?.routine_meal_id||first?.id||'')
 const [items,setItems]=useState<Line[]>(()=>event&&event.outcome!=='skipped'?entries.filter(e=>e.event_id===event.id&&!e.deleted_at).map(e=>({product_id:e.product_id,quantity_grams:Number(e.quantity_grams),eaten_grams:Number(e.eaten_grams??e.quantity_grams)})):(first?.items||[{product_id:products[0]?.id||'',quantity_grams:Number(products[0]?.portion_grams||100)}]).map(i=>({...i,eaten_grams:Number(i.quantity_grams)})))
 const [outcome,setOutcome]=useState<MealOutcome>(event?.outcome||'given')
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicate,setDuplicate]=useState(false),[removing,setRemoving]=useState(false)
 const meal=plan.find(p=>p.id===selected)
 function chooseFood(lines:{product_id:string;quantity_grams:number}[]) {setItems(lines.map(i=>({...i,eaten_grams:outcome==='refused'?0:Number(i.quantity_grams)})))}
 async function submit(formEvent:FormEvent<HTMLFormElement>) {
  formEvent.preventDefault();const form=new FormData(formEvent.currentTarget);setBusy(true);setError('')
  try {
   const {error}=await db().rpc('save_meal_result',{p_household:householdId,p_id:id,p_items:outcome==='skipped'?[]:items.map(i=>({...i,eaten_grams:outcome==='given'?i.quantity_grams:outcome==='refused'?0:i.eaten_grams})),p_at:new Date(String(form.get('at'))).toISOString(),p_source:event?.source||source,p_allow_duplicate:form.get('extra')==='on',p_routine_meal:selected||null,p_outcome:outcome,p_notes:String(form.get('notes')||'')})
   if(error){if(error.message.includes('DUPLICATE_MEAL'))setDuplicate(true);throw error}
   onSaved()
  }catch(error){setError(errorMessage(error).replace('DUPLICATE_MEAL: ',''))}finally{setBusy(false)}
 }
 async function remove() {
  if(!event)return
  setBusy(true);setError('')
  try{const{error}=await db().rpc('save_meal_result',{p_household:householdId,p_id:id,p_items:[],p_at:event.occurred_at,p_remove:true});if(error)throw error;onSaved()}catch(error){setError(errorMessage(error))}finally{setBusy(false)}
 }
 return <form className="form-stack" onSubmit={submit}><h2>{event?'Correct feeding record':'Record feeding'}</h2>{source==='nfc'&&!event&&<Notice>Opened from your feeding tag. Confirm once for the whole meal.</Notice>}
 <label className="field">Which meal?<select value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);chooseFood(plan.find(p=>p.id===e.target.value)?.items||[{product_id:products[0]?.id||'',quantity_grams:Number(products[0]?.portion_grams||100)}]);setDuplicate(false)}}>{event?.routine_meal_id&&!meal&&<option value={event.routine_meal_id}>{event.meal_name} (previous routine)</option>}{plan.map(p=><option key={p.id} value={p.id}>{p.name} · {p.time}</option>)}<option value="">Single food or treat</option></select></label>
 {meal?.notes&&<p className="photo-hint">Preparation: {meal.notes}</p>}
 <label className="field">What happened?<select value={outcome} disabled={busy} onChange={e=>{const next=e.target.value as MealOutcome;setOutcome(next);setItems(old=>old.map(i=>({...i,eaten_grams:next==='refused'?0:next==='given'?i.quantity_grams:i.eaten_grams})))}}><option value="given">Given — eaten in full</option><option value="partial">Partially eaten</option><option value="refused">Refused — served but not eaten</option><option value="skipped">Skipped — no food served</option></select></label>
 {outcome==='skipped'?<Notice>No food served, so this record will not reduce stock.</Notice>:<>
 {!selected&&<label className="field">Food product<select value={items[0]?.product_id||''} disabled={busy} onChange={e=>{const p=products.find(p=>p.id===e.target.value);if(p)chooseFood([{product_id:p.id,quantity_grams:Number(p.portion_grams)}])}}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {categories[p.category]}</option>)}</select></label>}
 {items.map((item,index)=>{const product=products.find(p=>p.id===item.product_id);return <div className="meal-quantity-row" key={item.product_id}><Field label={`${product?.name||'Food'} — served (g)`} type="number" min="0.01" max="1000000" step="0.01" required disabled={busy} value={item.quantity_grams||''} onChange={e=>setItems(old=>old.map((line,i)=>i===index?{...line,quantity_grams:Number(e.target.value),eaten_grams:outcome==='given'?Number(e.target.value):Math.min(line.eaten_grams,Number(e.target.value))}:line))}/>{outcome==='partial'&&<Field label="Actually eaten (g)" type="number" min="0" max={item.quantity_grams} step="0.01" required disabled={busy} value={item.eaten_grams} onChange={e=>setItems(old=>old.map((line,i)=>i===index?{...line,eaten_grams:Number(e.target.value)}:line))}/>}</div>})}
 <p className="photo-hint">Stock decreases by food served, including leftovers discarded. Eaten quantities are tracked separately.</p>
 </>}
 <Field label="Actual time (your device’s local time)" name="at" type="datetime-local" defaultValue={localDateTime(event?new Date(event.occurred_at):new Date())} required disabled={busy}/>
 <Field label="Note (optional)" name="notes" maxLength={500} defaultValue={event?.notes||''} placeholder="e.g. Left some wet food in the bowl" disabled={busy}/>
 {error&&<Notice error>{error}</Notice>}{duplicate&&<label className="feeding-check"><input name="extra" type="checkbox" required/>I checked the recent feeding history and want to record an intentional extra meal.</label>}
 <div className="family-name-actions"><Button disabled={busy||(!items.length&&outcome!=='skipped')}>{busy?'Saving…':event?'Save correction':'Confirm meal record'}</Button><Button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>{event&&<Button type="button" className="secondary" disabled={busy} onClick={()=>setRemoving(true)}>Remove record</Button>}</div>
 {removing&&<div><Notice>Remove the whole meal record? All its served food will be restored to tracked stock.</Notice><Button type="button" disabled={busy} onClick={()=>void remove()}>Confirm removal</Button><Button type="button" className="secondary" disabled={busy} onClick={()=>setRemoving(false)}>Keep record</Button></div>}
 </form>
}
