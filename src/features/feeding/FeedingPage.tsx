import { Clock3, PackageOpen, Utensils } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { useFeeding } from './useFeeding'
import { countMealEvents, dayKey, formatGrams, regularMeals } from './model'
import { MealChecklist } from './MealChecklist'
import { MealHistory } from './MealHistory'
import { todayChecklist, outcomeLabels } from './checklist'
import { FeedingRoutineForm } from './FeedingRoutineForm'
import { PlannedMealForm } from './PlannedMealForm'
import { FeedingTagSetup } from './FeedingTagSetup'
import { FoodProductCard } from './FoodProductCard'
import { ProductForm } from './ProductForm'
import { EntryForm } from './EntryForm'
import type { FeedingEntry, FoodProduct, MealEvent } from './types'

type Editor = { type: 'product'; product?: FoodProduct } | { type: 'meal' | 'purchase'; entry?: FeedingEntry; mealId?:string; event?:MealEvent } | null
export function FeedingPage() {
 const { household, dog } = useHousehold()
 return <FeedingHousehold key={household!.id} householdId={household!.id} dogName={dog!.name} timezone={household!.timezone}/>
}
function FeedingHousehold({ householdId, dogName, timezone }: { householdId: string; dogName: string; timezone: string }) {
 const data = useFeeding(householdId)
 const { session } = useAuth()
 const [query, setQuery] = useSearchParams()
 const quick = query.get('quick') === '1'
 const targetHousehold = query.get('household')
 const wrongTag = !!targetHousehold && targetHousehold !== householdId
 const [editor, setEditor] = useState<Editor>(quick && !wrongTag ? { type: 'meal' } : null)
 const editorRef=useRef<HTMLElement>(null)
 useEffect(()=>{if(editor&&!data.loading)editorRef.current?.focus()},[editor,data.loading])
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const [remove, setRemove] = useState<FeedingEntry | null>(null)
 const [historyLimit, setHistoryLimit] = useState(20)
 const [now,setNow]=useState(()=>new Date())
 useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),30000);return()=>window.clearInterval(timer)},[])
 const checklist=todayChecklist(data.plan,data.events,timezone,now)
 const next=checklist.find(row=>!row.event)
 const recent=[...data.events].filter(e=>e.outcome!=='skipped').sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at))[0]
 const recorded=data.plan.length?checklist.filter(row=>row.event).length:countMealEvents(regularMeals(data.entries,data.products).filter(e=>dayKey(e.occurred_at,timezone)===dayKey(now,timezone)))
 function editMeal(event:MealEvent){setEditor({type:'meal',event});setMessage('')}
 const names = new Map(data.members.map(m => [m.user_id, m.display_name]))
 const meals = regularMeals(data.entries, data.products)
 const today = meals.filter(e => dayKey(e.occurred_at, timezone) === dayKey(new Date(), timezone))
 const live = data.entries.filter(e => !e.deleted_at&&!e.event_id).sort((a,b) => b.occurred_at.localeCompare(a.occurred_at))
 function close() { setEditor(null); setQuery({}, { replace: true }) }
 function saved() { close(); setRemove(null); setMessage('Saved. Your family’s feeding and stock records are up to date.'); data.refresh() }
 async function deleteEntry(entry: FeedingEntry) {
  setBusy(true); setError('')
  try {
   const { error } = await db().rpc('save_feeding_entry', { p_household: householdId, p_id: entry.id, p_product: entry.product_id, p_kind: entry.kind, p_quantity: Number(entry.quantity_grams), p_at: entry.occurred_at, p_delete: true })
   if (error) throw error
   saved()
  } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
 if (data.loading) return <p role="status">Loading feeding and food stock…</p>
 if (data.error) return <><PageTitle eyebrow="YOUR EVERYDAY" title="Feeding"/><Notice error>{data.error}</Notice><Button onClick={data.refresh}>Retry</Button></>
 return <div className="feeding-page"><PageTitle eyebrow="A LITTLE CARE, EVERY DAY" title={`${dogName}’s feeding`}>Meals remembered. Cupboards ready. A routine you share.</PageTitle>
  {wrongTag && <Notice error>This feeding tag belongs to another household. Switch to that household before using its tag.</Notice>}
  {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
  <section className="card feeding-overview"><div><p className="eyebrow feeding-overview-label"><Utensils size={15} aria-hidden="true"/>THE DAILY BOWL</p><h2>{next?`${next.status==='Due'?'Due now':'Next'}: ${next.meal.name} at ${next.meal.time}`:data.plan.length?'Today’s routine is recorded':'Ready for the next bowl?'}</h2><p className="meal-progress"><span className="feeding-progress-dot" aria-hidden="true"/>{recorded} of {data.mealsPerDay} meals recorded today</p><p className="muted">{formatGrams(today.reduce((sum,e) => sum+Number(e.quantity_grams),0))} served today · {timezone}<br/>{recent ? `Latest: ${recent.meal_name} · ${outcomeLabels[recent.outcome]} · ${names.get(recent.created_by||'')||'a family member'} · ${new Date(recent.occurred_at).toLocaleString(undefined,{timeZone:timezone,hour12:false})}` : meals[0] ? `Last feeding: ${new Date(meals[0].occurred_at).toLocaleString(undefined,{timeZone:timezone,hour12:false})}` : 'No feeding recorded yet.'}</p></div><div className="feeding-actions"><Button disabled={!data.products.length || wrongTag} onClick={() => { setEditor({ type: 'meal' }); setMessage('') }}>Record feeding</Button><Button className="secondary" disabled={!data.products.length} onClick={() => setEditor({ type: 'purchase' })}>Add food purchase</Button><Button className="secondary" onClick={data.refresh}>Refresh</Button></div></section>
  {editor && <section className="card feeding-editor" ref={editorRef} tabIndex={-1}>{editor.type === 'product' ? <ProductForm key={editor.product?.id || 'new-product'} householdId={householdId} product={editor.product} onSaved={saved} onCancel={close}/> : data.products.length && !wrongTag ? editor.type==='meal'&&!editor.entry ? <PlannedMealForm key={editor.event?.id||editor.mealId||'new-meal'} householdId={householdId} products={data.products} plan={data.plan} initialMealId={editor.mealId||next?.meal.id} event={editor.event} entries={data.entries} source={quick?'nfc':'app'} onSaved={saved} onCancel={close}/> : <EntryForm key={editor.entry?.id || editor.type} householdId={householdId} products={data.products} entries={data.entries} kind={editor.type} entry={editor.entry} source={quick ? 'nfc' : 'app'} names={names} timezone={timezone} onSaved={saved} onCancel={close}/> : <><Notice>Add your first food product before recording a meal.</Notice><Button onClick={() => setEditor({ type: 'product' })}>Add product</Button><Button className="secondary" onClick={close}>Cancel</Button></>}</section>}
  <MealChecklist plan={data.plan} events={data.events} timezone={timezone} names={names} userId={session!.user.id} now={now} onFeed={mealId=>{setEditor({type:'meal',mealId});setMessage('')}} onEdit={editMeal} disabled={wrongTag}/>
  <FeedingRoutineForm householdId={householdId} products={data.products} plan={data.plan} count={data.mealsPerDay} warningHours={data.warningHours} timezone={timezone} onSaved={saved}/>
  <div className="home-section-heading"><h2 className="feeding-section-heading"><PackageOpen size={20} aria-hidden="true"/>Food cupboard</h2><Button className="secondary" onClick={() => setEditor({ type: 'product' })}>Add product</Button></div>
  {!data.products.length && <section className="card"><h3>Start with the food you already use.</h3><p className="muted">Add dry food, wet food, or treats. Enter opening stock for an open package, then record future purchases separately.</p></section>}
  <div className="feeding-products">{data.products.map(product=><FoodProductCard key={product.id} product={product} entries={data.entries} timezone={timezone} onEdit={()=>setEditor({type:'product',product})}/>)}</div>
  <section className="card feeding-history"><h2 className="feeding-section-heading"><Clock3 size={20} aria-hidden="true"/>Shared history</h2><p className="muted">Everyone can correct purchases. Only the person who recorded a feeding can edit or remove it.</p>{<MealHistory events={[...data.events].sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at)).slice(0,historyLimit)} entries={data.entries} products={data.products} names={names} timezone={timezone} userId={session!.user.id} onEdit={editMeal}/>}
   {!live.length ? !data.events.length&&<p className="muted">No records yet.</p> : <ul className="invitation-list">{live.slice(0,historyLimit).map(entry => <li key={entry.id}><div><strong>{entry.kind === 'meal' ? 'Fed' : 'Purchased'} · {data.products.find(p => p.id === entry.product_id)?.name}</strong><small>{formatGrams(Number(entry.quantity_grams))}{entry.kind === 'purchase' ? ` · ${entry.packages} × ${formatGrams(Number(entry.package_grams))}` : ''} · {names.get(entry.created_by||'') || 'Former family member'} · {new Date(entry.occurred_at).toLocaleString(undefined, { timeZone: timezone, hour12: false })}{entry.source === 'nfc' ? ' · NFC' : ''}</small></div>{(entry.kind === 'purchase' || entry.created_by === session?.user.id) && <div className="feeding-actions"><Button className="secondary" onClick={() => setEditor({ type: entry.kind, entry })}>Edit</Button><Button className="secondary" onClick={() => setRemove(entry)}>Remove</Button></div>}</li>)}</ul>}{(live.length>historyLimit||data.events.length>historyLimit) && <Button className="secondary" onClick={() => setHistoryLimit(n => n+20)}>Show more</Button>}
   {remove && <div className="feeding-editor"><Notice>Remove this {remove.kind === 'meal' ? 'feeding' : 'purchase'} record? Stock will be recalculated. Removing a purchase is blocked if it would leave negative stock.</Notice><div className="feeding-actions"><Button disabled={busy} onClick={() => void deleteEntry(remove)}>Confirm removal</Button><Button className="secondary" disabled={busy} onClick={() => setRemove(null)}>Cancel</Button></div></div>}
  </section>
  <FeedingTagSetup householdId={householdId}/>
 </div>
}
