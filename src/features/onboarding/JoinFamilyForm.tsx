import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Field, Notice } from '../../components/ui'
import { parseInvitationInput } from '../household/invitations'

export function JoinFamilyForm() {
 const navigate = useNavigate()
 const [expanded, setExpanded] = useState(false)
 const [error, setError] = useState('')
 function join(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = new FormData(event.currentTarget)
  const token = parseInvitationInput(String(form.get('invitation') || ''))
  if (!token) { setError('Paste a complete PawShare invitation link or the 64-character invitation code.'); return }
  navigate(`/invite/${token}`)
 }
 return <section className="onboard-join" aria-label="Join an existing family">
  <p className="muted">Already have a family on PawShare?</p>
  <Button type="button" className="secondary" aria-expanded={expanded} aria-controls="join-family-form" onClick={() => setExpanded(value => !value)}>Join an existing family</Button>
  {expanded && <form id="join-family-form" onSubmit={join} className="form-stack">
   <p className="muted">Ask the family owner to share an invitation from their Family page. Use the same email address they invited.</p>
   <Field label="Invitation link or code" name="invitation" required autoComplete="off" spellCheck={false} placeholder="Paste your family invitation"/>
   {error && <Notice error>{error}</Notice>}
   <Button>Continue to invitation →</Button>
  </form>}
 </section>
}
