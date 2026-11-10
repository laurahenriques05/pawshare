import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { FamilyMember } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'
import { forgetInvitation } from './invitations'
import { useHousehold } from './HouseholdProvider'

export function LeaveHouseholdForm({ members }: { members: FamilyMember[] }) {
 const { household, membership, reload } = useHousehold()
 const { session } = useAuth()
 const navigate = useNavigate()
 const [open, setOpen] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const owner = membership?.role === 'owner'
 const others = members.filter(member => member.user_id !== session?.user.id)
 async function leave(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  setBusy(true); setError('')
  try {
   const { error } = await db().rpc('leave_household', { p_household: household!.id, p_new_owner: owner ? String(form.get('new_owner') || '') : null })
   if (error) throw error
   forgetInvitation()
   await reload()
   navigate('/', { replace: true })
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 return <section className="card household-leave"><h2>Your household membership</h2>
  <p className="muted">You can leave this family and join another using an invitation code. Your PawShare account stays active.</p>
  {!open ? <Button className="secondary" onClick={() => setOpen(true)}>Leave household</Button> : <form className="form-stack" onSubmit={leave}>
   <p className="muted">Leave {household?.name}? You’ll lose access to this family’s dog and shared information. The family and dog stay available to the remaining members.</p>
   {owner && (others.length ? <label className="field">Choose the next owner<select name="new_owner" required defaultValue=""><option value="" disabled>Select a family member</option>{others.map(member => <option key={member.user_id} value={member.user_id}>{member.display_name}</option>)}</select><small>Ownership transfers when you confirm leaving.</small></label> : <Notice>Invite another person and wait for them to join before leaving. Your household needs an owner.</Notice>)}
   {error && <Notice error>{error}</Notice>}
   <div className="family-name-actions"><Button disabled={busy || (owner && !others.length)}>{busy ? 'Leaving…' : 'Confirm and leave'}</Button><Button type="button" className="secondary" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Cancel</Button></div>
  </form>}
 </section>
}
