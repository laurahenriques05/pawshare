import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { categories } from './model'
import type { FoodProduct } from './types'
export function ProductForm({ householdId, product, onSaved, onCancel }: { householdId: string; product?: FoodProduct; onSaved: () => void; onCancel: () => void }) {
 const [id] = useState(() => product?.id || crypto.randomUUID())
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const f = new FormData(event.currentTarget)
  setBusy(true); setError('')
  try {
   const { error } = await db().rpc('save_food_product', { p_household: householdId, p_id: id, p_name: String(f.get('name')).trim(), p_category: String(f.get('category')), p_portion: Number(f.get('portion')), p_daily: Number(f.get('daily')), p_opening: Number(f.get('opening')), p_reminder: Number(f.get('reminder')) })
   if (error) throw error
   onSaved()
  } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
 return <form className="form-stack" onSubmit={submit}><h2>{product ? 'Edit food product' : 'Add a food product'}</h2>
  <Field label="Product name" name="name" required maxLength={100} defaultValue={product?.name} placeholder="e.g. Adult chicken kibble"/>
  <label className="field">Food type<select name="category" defaultValue={product?.category || 'dry'}>{Object.entries(categories).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
  <div className="form-grid"><Field label="Usual portion (g)" name="portion" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={product?.portion_grams || 100}/><Field label="Expected daily use (g)" name="daily" type="number" min="0" max="1000000" step="0.01" required defaultValue={product?.daily_grams ?? 200} hint="Across the whole day. Enter 0 if irregular; no run-out estimate will be shown."/></div>
  <Field label="Opening stock / correction baseline (g)" name="opening" type="number" min="0" max="100000000" step="0.01" required defaultValue={product?.opening_grams || 0} hint="Food already owned before tracking. Purchases are added separately. Adjust this baseline for unrecorded waste or stock corrections."/>
  <Field label="Restocking warning (days before running out)" name="reminder" type="number" min="0" max="90" step="1" required defaultValue={product?.reminder_days ?? 7}/>
  <p className="fine-print">Use your dog’s existing feeding routine. These quantities are not a nutrition recommendation.</p>
  {error && <Notice error>{error}</Notice>}<div className="family-name-actions"><Button disabled={busy}>{busy ? 'Saving…' : 'Save product'}</Button><Button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</Button></div>
 </form>
}
