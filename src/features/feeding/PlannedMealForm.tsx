import { useState,type FormEvent } from 'react'
import { Button,Field,Notice,errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { categories,localDateTime } from './model'
import type { FoodProduct,PlannedMeal } from './types'
export function PlannedMealForm({householdId,products,plan,source,onSaved,onCancel}:{householdId:string;products:FoodProduct[];plan:PlannedMeal[];source:'app'|'nfc';onSaved:()=>void;onCancel:()=>void}) {
 const [id]=useState(()=>crypto.randomUUID())
 const [selected,setSelected]=useState(plan[0]?.id||'')
 const [items,setItems]=useState(()=>structuredClone(plan[0]?.items||[]))
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[duplicate,setDuplicate]=useState(false)
 const meal=plan.find(p=>p.id===selected)
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();const form=new FormData(event.currentTarget);setBusy(true);setError('')
  try {
   const {error}=await db().rpc('record_feeding_meal',{p_household:householdId,p_id:id,p_items:items,p_at:new Date(String(form.get('at'))).toISOString(),p_source:source,p_allow_duplicate:form.get('extra')==='on',p_routine_meal:selected||null})
   if(error) {if(error.message.includes('DUPLICATE_MEAL'))setDuplicate(true);throw error}
   onSaved()
  } catch(error){setError(errorMessage(error).replace('DUPLICATE_MEAL: ',''))}finally{setBusy(false)}
 }
 return <form className="form-stack" onSubmit={submit}><h2>Record a planned meal</h2>{source==='nfc'&&<Notice>Opened from your feeding tag. Check the quantities and confirm once for the whole meal.</Notice>}
 <label className="field">Which meal?<select value={selected} onChange={e=>{setSelected(e.target.value);setItems(structuredClone(plan.find(p=>p.id===e.target.value)?.items||[{product_id:products[0]?.id||'',quantity_grams:Number(products[0]?.portion_grams||100)}]));setDuplicate(false)}}>{plan.map(p=><option key={p.id} value={p.id}>{p.name} · {p.time}</option>)}<option value="">Single food or treat</option></select></label>
 {!selected&&<label className="field">Food product<select value={items[0]?.product_id||''} onChange={e=>{const p=products.find(p=>p.id===e.target.value);if(p)setItems([{product_id:p.id,quantity_grams:Number(p.portion_grams)}])}}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {categories[p.category]}</option>)}</select></label>}
 {meal?.notes&&<Notice>{meal.notes}</Notice>}
 {items.map((item,index)=>{const product=products.find(p=>p.id===item.product_id);return <Field key={item.product_id} label={`${product?.name || 'Food'} · ${product?categories[product.category]:''} (g)`} type="number" min="0.01" max="1000000" step="0.01" required value={item.quantity_grams||''} onChange={e=>setItems(old=>old.map((line,i)=>i===index?{...line,quantity_grams:Number(e.target.value)}:line))}/>})}
 <Field label="Actual feeding time (your device’s local time)" name="at" type="datetime-local" defaultValue={localDateTime()} required/>
 {error&&<Notice error>{error}</Notice>}{duplicate&&<label className="feeding-check"><input name="extra" type="checkbox" required/>I checked the recent feeding history and want to record an intentional extra meal.</label>}
 <div className="family-name-actions"><Button disabled={busy||!items.length}>{busy?'Saving…':'Confirm whole meal'}</Button><Button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</Button></div>
 </form>
}
