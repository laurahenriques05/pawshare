import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { categories, formatGrams } from './model'
import type { FoodProduct, PlannedMeal } from './types'
function newMeal(index: number, count: number, products: FoodProduct[]): PlannedMeal {
 const hour = (8+index*24/count)%24
 return { id: crypto.randomUUID(), name: count===2 ? ['Breakfast','Dinner'][index] : `Meal ${index+1}`, time: `${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.round((hour%1)*60)).padStart(2,'0')}`, notes: '', items: [{product_id:products[0]?.id || '',quantity_grams:Number(products[0]?.portion_grams || 100)}] }
}
export function FeedingRoutineForm({ householdId, products, plan, count, warningHours, timezone, onSaved }: { householdId:string; products:FoodProduct[]; plan:PlannedMeal[]; count:number; warningHours:number|null; timezone:string; onSaved:()=>void }) {
 const [meals,setMeals]=useState<PlannedMeal[]>(()=>plan.length ? structuredClone(plan) : Array.from({length:count},(_,i)=>newMeal(i,count,products)))
 const [editing,setEditing]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 function openEditor() { setMeals(plan.length ? structuredClone(plan) : Array.from({length:count},(_,i)=>newMeal(i,count,products)));setError('');setEditing(true) }
 function cancel() { setEditing(false);setError('') }
 function patch(index:number, change:Partial<PlannedMeal>) { setMeals(previous=>previous.map((meal,i)=>i===index?{...meal,...change}:meal)) }
 function resize(value:number) {
  if (!Number.isInteger(value) || value<1 || value>12) return
  setMeals(previous=>Array.from({length:value},(_,i)=>previous[i] || newMeal(i,value,products)))
 }
 const totals=new Map<string,number>()
 for(const meal of meals) for(const item of meal.items) totals.set(item.product_id,(totals.get(item.product_id)||0)+Number(item.quantity_grams||0))
 async function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();setBusy(true);setError('')
  const override=String(new FormData(event.currentTarget).get('warning')||'').trim()
  try {
   const {error}=await db().rpc('save_feeding_plan',{p_household:householdId,p_plan:meals,p_warning:override?Number(override):null})
   if(error) throw error
   setEditing(false);onSaved()
  } catch(error) {setError(errorMessage(error))} finally {setBusy(false)}
 }
 return <section className="card feeding-routine feeding-plan"><div className="feeding-routine-heading"><div><h2>Daily feeding routine</h2><p className="photo-hint">{plan.length ? `${plan.length} meals per day · ${timezone}` : 'A simple plan for every bowl.'}</p></div>{!editing&&plan.length>0&&<Button type="button" className="secondary" onClick={openEditor}>Edit routine</Button>}</div>
 {!products.length ? <Notice>Add your food products in the Food cupboard first, then build your routine.</Notice> : !editing ? plan.length ? <>
 <ol className="feeding-routine-summary">{[...plan].sort((a,b)=>a.time.localeCompare(b.time)).map(meal=><li key={meal.id}><time>{meal.time}</time><div><h3>{meal.name}</h3><ul>{meal.items.map(item=>{const product=products.find(p=>p.id===item.product_id);return <li key={item.product_id}><strong>{formatGrams(Number(item.quantity_grams))}</strong> {product?.name||'Food product'}{product&&<span className="feeding-food-type"> · {categories[product.category]}</span>}</li>})}</ul>{meal.notes&&<p className="feeding-meal-notes">{meal.notes}</p>}</div></li>)}</ol>
 <details className="feeding-routine-details"><summary>Daily totals & meal spacing</summary><ul>{products.map(product=>{const quantity=plan.flatMap(meal=>meal.items).filter(item=>item.product_id===product.id).reduce((sum,item)=>sum+Number(item.quantity_grams),0);return quantity>0?<li key={product.id}>{product.name}: <strong>{formatGrams(quantity)}/day</strong></li>:null})}</ul><p className="photo-hint">Duplicate-meal warning within {Number(warningHours||24/count).toFixed(1)} hours of another regular meal. Treats are separate.</p></details>
 </> : <><p className="muted">Choose meal times, foods and portions once. They’ll be ready when you record a feeding.</p><Button type="button" onClick={openEditor}>Set up routine</Button></> : <form className="form-stack" onSubmit={submit}><p className="muted">Choose what goes in each bowl. Changes only apply after saving.</p>
 <Field label="How many meals per day?" type="number" min="1" max="12" step="1" value={meals.length} onChange={event=>resize(Number(event.target.value))} required disabled={busy}/>
 {meals.map((meal,index)=><fieldset key={meal.id} className="feeding-plan-meal" disabled={busy}><legend>Meal {index+1}</legend>
  <div className="form-grid"><Field label="Meal name" value={meal.name} onChange={e=>patch(index,{name:e.target.value})} maxLength={80} required placeholder="Breakfast"/><Field label="Usual time" type="time" value={meal.time} onChange={e=>patch(index,{time:e.target.value})} required/></div>
  {meal.items.map((item,itemIndex)=><div className="feeding-plan-food" key={itemIndex}><label className="field">Food product / type<select value={item.product_id} required onChange={e=>patch(index,{items:meal.items.map((old,j)=>j===itemIndex?{product_id:e.target.value,quantity_grams:Number(products.find(p=>p.id===e.target.value)?.portion_grams||100)}:old)})}><option value="" disabled>Choose food</option>{products.map(p=><option key={p.id} value={p.id} disabled={meal.items.some((other,j)=>j!==itemIndex&&other.product_id===p.id)}>{p.name} · {categories[p.category]}</option>)}</select></label><Field label="Quantity (g)" type="number" min="0.01" max="1000000" step="0.01" required value={item.quantity_grams || ''} onChange={e=>patch(index,{items:meal.items.map((old,j)=>j===itemIndex?{...old,quantity_grams:Number(e.target.value)}:old)})}/>{meal.items.length>1&&<Button type="button" className="secondary" onClick={()=>patch(index,{items:meal.items.filter((_,j)=>j!==itemIndex)})}>Remove food</Button>}</div>)}
  <Button type="button" className="secondary" disabled={meal.items.length>=Math.min(12,products.length)} onClick={()=>{const next=products.find(p=>!meal.items.some(item=>item.product_id===p.id));if(next)patch(index,{items:[...meal.items,{product_id:next.id,quantity_grams:Number(next.portion_grams)}]})}}>Add another food to this meal</Button>
  <Field label="Preparation notes (optional)" value={meal.notes} maxLength={500} onChange={e=>patch(index,{notes:e.target.value})} placeholder="e.g. Mix with a little warm water"/>
 </fieldset>)}
 <div className="feeding-plan-totals"><h3>Planned daily quantities</h3>{products.filter(p=>totals.has(p.id)).map(p=><p key={p.id}>{p.name}: <strong>{formatGrams(totals.get(p.id)!)}/day</strong></p>)}<p className="photo-hint">These quantities automatically drive stock forecasts for the products in your plan.</p></div>
 <details className="feeding-routine-details"><summary>Advanced: duplicate-meal warning</summary><Field label="Duplicate-meal warning: minimum gap (hours, optional)" name="warning" type="number" min="0.01" max="24" step="0.01" defaultValue={warningHours ?? ''} placeholder="Automatic from meal times" hint="Leave blank to use the shortest gap between planned meals, including overnight. A warning never blocks an intentional extra meal."/></details>
 {error&&<Notice error>{error}</Notice>}<div className="family-name-actions"><Button disabled={busy}>{busy?'Saving routine…':'Save routine'}</Button><Button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel</Button></div>
 </form>}
 </section>
}
