import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { formatGrams, localDateTime, regularMeals } from './model'
import type { FeedingEntry, FoodProduct } from './types'
export function EntryForm({ householdId, products, entries, kind, entry, source = 'app', names, timezone, onSaved, onCancel }: { householdId: string; products: FoodProduct[]; entries: FeedingEntry[]; kind: 'meal' | 'purchase'; entry?: FeedingEntry; source?: 'app' | 'nfc'; names: Map<string,string>; timezone: string; onSaved: () => void; onCancel: () => void }) {
 const [id] = useState(() => entry?.id || crypto.randomUUID())
 const [selected, setSelected] = useState(entry?.product_id || products[0]?.id || '')
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [duplicate, setDuplicate] = useState(false)
 const last = regularMeals(entries.filter(e => e.id !== id), products)[0]
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const f = new FormData(event.currentTarget)
  setBusy(true); setError('')
  try {
   const size = Number(f.get('package')); const count = Number(f.get('packages'))
   const { error } = await db().rpc('save_feeding_entry', { p_household: householdId, p_id: id, p_product: selected, p_kind: kind, p_quantity: kind === 'purchase' ? Math.round(size*count*100)/100 : Number(f.get('quantity')), p_at: new Date(String(f.get('at'))).toISOString(), p_package: kind === 'purchase' ? size : null, p_packages: kind === 'purchase' ? count : null, p_source: entry?.source || source, p_allow_duplicate: f.get('extra') === 'on' })
   if (error) { if (error.message.includes('DUPLICATE_MEAL')) { setDuplicate(true); throw new Error('Another meal was recorded within the usual feeding interval. Check the latest meal below before confirming an extra meal.') } throw error }
   onSaved()
  } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
 return <form className="form-stack" onSubmit={submit}><h2>{entry ? 'Correct' : 'Record'} {kind === 'meal' ? 'feeding' : 'food purchase'}</h2>
  {source === 'nfc' && <Notice>Opened from your feeding tag. Confirm the product and quantity to record a meal.</Notice>}
  <label className="field">Food product<select value={selected} onChange={e => { setSelected(e.target.value); setDuplicate(false) }} required>{products.map(p => <option key={p.id} value={p.id}>{p.name}{p.category === 'treat' ? ' · treats' : ''}</option>)}</select></label>
  {kind === 'meal' ? <Field key={selected} label="Quantity given (g)" name="quantity" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={entry?.product_id === selected ? entry.quantity_grams : products.find(p => p.id === selected)?.portion_grams}/> : <div className="form-grid"><Field label="Food per package (g)" name="package" type="number" min="0.01" max="100000000" step="0.01" required defaultValue={entry?.package_grams || 1000} hint="For example: 2 kg = 2000 g."/><Field label="Number of packages" name="packages" type="number" min="1" max="10000" step="1" required defaultValue={entry?.packages || 1}/></div>}
  <Field label={kind === 'meal' ? 'Feeding time (your device’s local time)' : 'Purchase time (your device’s local time)'} name="at" type="datetime-local" required defaultValue={localDateTime(entry ? new Date(entry.occurred_at) : new Date())}/>
  {error && <Notice error>{error}</Notice>}
  {duplicate && <><p className="muted">{last ? `Latest regular meal: ${formatGrams(Number(last.quantity_grams))}, ${new Date(last.occurred_at).toLocaleString(undefined, { timeZone: timezone, hour12: false })}, by ${names.get(last.created_by||'') || 'a family member'}.` : 'Refresh the page to see the latest meal recorded by your family.'}</p><label className="feeding-check"><input type="checkbox" name="extra" required/>I checked the recent feeding and want to record an intentional extra meal.</label></>}
  <div className="family-name-actions"><Button disabled={busy || !selected}>{busy ? 'Saving…' : kind === 'meal' ? 'Confirm feeding' : 'Save purchase'}</Button><Button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</Button></div>
 </form>
}
