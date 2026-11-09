import { useId, useRef, useState, type FormEvent } from 'react'
import { Pencil } from 'lucide-react'
import { Button, Field, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { Household } from '../../lib/supabase/database.types'

export function FamilyNameForm({ household, onSaved }: { household: Household; onSaved: (household: Household) => void }) {
 const editorId = useId()
 const toggle = useRef<HTMLButtonElement>(null)
 const [editing, setEditing] = useState(false)
 const [name, setName] = useState(household.name)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [saved, setSaved] = useState(false)
 function cancel() {
  setName(household.name); setError(''); setEditing(false); toggle.current?.focus()
 }
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError(''); setSaved(false)
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) { setError('Enter a family name between 1 and 80 characters.'); return }
  setBusy(true)
  try {
   const { data, error } = await db().from('households').update({ name: trimmed }).eq('id', household.id).select('*').single()
   if (error) throw error
   if (!data) throw new Error('The family name could not be saved. Please refresh and try again.')
   setName(data.name); onSaved(data); setSaved(true); setEditing(false); toggle.current?.focus()
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 return <header className="page-title"><p className="eyebrow">YOUR FAMILY</p><div className="family-title-row"><h1>{household.name}</h1><button ref={toggle} type="button" className="family-name-edit" aria-label="Edit family name" title="Edit family name" aria-expanded={editing} aria-controls={editing ? editorId : undefined} disabled={busy} onClick={() => { if (editing) cancel(); else { setName(household.name); setError(''); setSaved(false); setEditing(true) } }}><Pencil size={15} aria-hidden="true"/></button></div><p className="muted">One dog. A little team of people who care.</p>
  {editing && <form id={editorId} onSubmit={submit} className="family-name-editor form-stack" onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.preventDefault(); cancel() } }}><Field label="Family name" name="family_name" value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={busy} autoComplete="off" autoFocus/>{error && <Notice error>{error}</Notice>}<div className="family-name-actions"><Button disabled={busy || name.trim() === household.name}>{busy ? 'Saving…' : 'Save'}</Button><Button type="button" className="secondary" disabled={busy} onClick={cancel}>Cancel</Button></div></form>}
  {saved && <p className="family-name-saved" role="status">Family name updated.</p>}
 </header>
}
