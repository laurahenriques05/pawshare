import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db, appUrl } from '../../lib/supabase/client'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { useFeeding } from './useFeeding'
import { categories, dayKey, formatGrams, regularMeals, stockForecast } from './model'
import { ProductForm } from './ProductForm'
import { EntryForm } from './EntryForm'
import type { FeedingEntry, FoodProduct } from './types'

type Editor = { type: 'product'; product?: FoodProduct } | { type: 'meal' | 'purchase'; entry?: FeedingEntry } | null
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
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const [remove, setRemove] = useState<FeedingEntry | null>(null)
 const [historyLimit, setHistoryLimit] = useState(20)
 const names = new Map(data.members.map(m => [m.user_id, m.display_name]))
 const meals = regularMeals(data.entries, data.products)
 const today = meals.filter(e => dayKey(e.occurred_at, timezone) === dayKey(new Date(), timezone))
 const live = data.entries.filter(e => !e.deleted_at).sort((a,b) => b.occurred_at.localeCompare(a.occurred_at))
 function close() { setEditor(null); setQuery({}, { replace: true }) }
 function saved() { close(); setRemove(null); setMessage('Saved. Your family’s feeding and stock records are up to date.'); data.refresh() }
 async function saveRoutine(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const meals = Number(new FormData(event.currentTarget).get('meals'))
  setBusy(true); setError('')
  try { const { error } = await db().rpc('save_feeding_settings', { p_household: householdId, p_meals: meals }); if (error) throw error; saved() } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
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
  <section className="card feeding-overview"><div><p className="eyebrow">TODAY’S REGULAR MEALS</p><h2>{today.length} / {data.mealsPerDay} recorded</h2><p className="muted">{formatGrams(today.reduce((sum,e) => sum+Number(e.quantity_grams),0))} today · {timezone}<br/>{meals[0] ? `Last meal by ${names.get(meals[0].created_by) || 'a family member'} at ${new Date(meals[0].occurred_at).toLocaleString(undefined, { timeZone: timezone, hour12: false })}` : 'No regular meals recorded yet.'}</p></div><div className="feeding-actions"><Button disabled={!data.products.length || wrongTag} onClick={() => { setEditor({ type: 'meal' }); setMessage('') }}>Record feeding</Button><Button className="secondary" disabled={!data.products.length} onClick={() => setEditor({ type: 'purchase' })}>Add food purchase</Button><Button className="secondary" onClick={data.refresh}>Refresh</Button></div></section>
  {editor && <section className="card feeding-editor">{editor.type === 'product' ? <ProductForm key={editor.product?.id || 'new-product'} householdId={householdId} product={editor.product} onSaved={saved} onCancel={close}/> : data.products.length && !wrongTag ? <EntryForm key={editor.entry?.id || editor.type} householdId={householdId} products={data.products} entries={data.entries} kind={editor.type} entry={editor.entry} source={quick ? 'nfc' : 'app'} names={names} timezone={timezone} onSaved={saved} onCancel={close}/> : <><Notice>Add your first food product before recording a meal.</Notice><Button onClick={() => setEditor({ type: 'product' })}>Add product</Button><Button className="secondary" onClick={close}>Cancel</Button></>}</section>}
  <div className="home-section-heading"><h2>Food cupboard</h2><Button className="secondary" onClick={() => setEditor({ type: 'product' })}>Add product</Button></div>
  {!data.products.length && <section className="card"><h3>Start with the food you already use.</h3><p className="muted">Add dry food, wet food, or treats. Enter opening stock for an open package, then record future purchases separately.</p></section>}
  <div className="feeding-products">{data.products.map(product => {
   const f = stockForecast(product, data.entries)
   return <section className="card" key={product.id}><p className="eyebrow">{categories[product.category]}</p><h3>{product.name}</h3><p className="feeding-stock">{formatGrams(f.remaining)} <span>remaining</span></p><p className="muted">Usual portion: {formatGrams(Number(product.portion_grams))}<br/>{f.days === null ? 'No daily estimate set.' : `About ${Number(f.days.toFixed(1))} days left · ${formatGrams(Number(product.daily_grams))}/day`}</p>{f.low && <Notice>{f.remaining === 0 ? 'Out of food. Add a purchase to restock.' : 'Time to buy more food.'}</Notice>}{f.buyBy && <p className="photo-hint">Estimated buy-by date: {f.buyBy.toLocaleDateString(undefined, { timeZone: timezone })}. Forecasts change with stock and your saved daily use.</p>}<Button className="secondary" onClick={() => setEditor({ type: 'product', product })}>Edit product / stock baseline</Button></section>
  })}</div>
  <section className="card feeding-routine"><h2>Regular feeding routine</h2><form className="form-stack" onSubmit={saveRoutine}><Field key={data.mealsPerDay} label="Regular meals per day" name="meals" type="number" min="1" max="12" step="1" required defaultValue={data.mealsPerDay} hint={`Warn when another regular meal is recorded less than ${Number((24/data.mealsPerDay).toFixed(1))} hours after the previous one. Treats are separate.`}/><Button disabled={busy}>Save routine</Button></form><p className="photo-hint">Product daily-use estimates are configured separately, so mixed foods and treats can have different quantities.</p></section>
  <section className="card feeding-history"><h2>Shared history</h2><p className="muted">Everyone can correct purchases. Only the person who recorded a feeding can edit or remove it.</p>{!live.length ? <p className="muted">No records yet.</p> : <ul className="invitation-list">{live.slice(0,historyLimit).map(entry => <li key={entry.id}><div><strong>{entry.kind === 'meal' ? 'Fed' : 'Purchased'} · {data.products.find(p => p.id === entry.product_id)?.name}</strong><small>{formatGrams(Number(entry.quantity_grams))}{entry.kind === 'purchase' ? ` · ${entry.packages} × ${formatGrams(Number(entry.package_grams))}` : ''} · {names.get(entry.created_by) || 'Former family member'} · {new Date(entry.occurred_at).toLocaleString(undefined, { timeZone: timezone, hour12: false })}{entry.source === 'nfc' ? ' · NFC' : ''}</small></div>{(entry.kind === 'purchase' || entry.created_by === session?.user.id) && <div className="feeding-actions"><Button className="secondary" onClick={() => setEditor({ type: entry.kind, entry })}>Edit</Button><Button className="secondary" onClick={() => setRemove(entry)}>Remove</Button></div>}</li>)}</ul>}{live.length>historyLimit && <Button className="secondary" onClick={() => setHistoryLimit(n => n+20)}>Show more</Button>}
   {remove && <div className="feeding-editor"><Notice>Remove this {remove.kind === 'meal' ? 'feeding' : 'purchase'} record? Stock will be recalculated. Removing a purchase is blocked if it would leave negative stock.</Notice><div className="feeding-actions"><Button disabled={busy} onClick={() => void deleteEntry(remove)}>Confirm removal</Button><Button className="secondary" disabled={busy} onClick={() => setRemove(null)}>Cancel</Button></div></div>}
  </section>
  <section className="card feeding-routine"><h2>Set up your feeding NFC tag</h2><p className="muted">In a phone NFC-writing app, choose to write a website/URL to a reusable tag. Paste this address, write it, then test it while signed in. Place the tag near the bowl. Tapping opens quick feeding; nothing is recorded until you confirm.</p><Field label="Feeding tag address" readOnly value={`${appUrl}/feed?quick=1&household=${householdId}`} onFocus={event => event.currentTarget.select()}/><p className="photo-hint">If sign-in interrupts the NFC action, tap the tag again after signing in. Tag reading/writing support depends on the phone and tag; real-device testing is still required.</p></section>
 </div>
}
