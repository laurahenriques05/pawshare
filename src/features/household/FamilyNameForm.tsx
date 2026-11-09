import { useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Button, Field, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { Household } from '../../lib/supabase/database.types'

export function FamilyNameForm({ household, onSaved }: { household: Household; onSaved: (household: Household) => void }) {
 const [name, setName] = useState(household.name)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [saved, setSaved] = useState(false)
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError(''); setSaved(false)
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) { setError('Enter a family name between 1 and 80 characters.'); return }
  setBusy(true)
  try {
   const { data, error } = await db().from('households').update({ name: trimmed }).eq('id', household.id).select('*').single()
   if (error) throw error
   if (!data) throw new Error('The family name could not be saved. Please refresh and try again.')
   setName(data.name); onSaved(data); setSaved(true)
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 return <section className="card family-name-card"><div className="family-name-heading"><div className="icon-tile"><Pencil size={20}/></div><div><h2>Make it your family’s.</h2><p className="muted">Change the name everyone in your household sees.</p></div></div><form onSubmit={submit} className="form-stack"><Field label="Family name" name="family_name" value={name} onChange={event => { setName(event.target.value); setSaved(false) }} required maxLength={80} disabled={busy} autoComplete="off"/>{error && <Notice error>{error}</Notice>}{saved && <Notice>Family name updated.</Notice>}<Button disabled={busy || name.trim() === household.name}>{busy ? 'Saving…' : 'Save family name'}</Button></form></section>
}
