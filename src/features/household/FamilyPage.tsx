import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Copy, Link as LinkIcon, ShieldCheck, Users } from 'lucide-react'
import { Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { appUrl, db } from '../../lib/supabase/client'
import type { FamilyMember, Invitation } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from './HouseholdProvider'
import { FamilyNameForm } from './FamilyNameForm'

export function FamilyPage() {
 const { household, membership, updateHousehold } = useHousehold()
 const { session } = useAuth()
 const owner = membership?.role === 'owner'
 const [members, setMembers] = useState<FamilyMember[]>([])
 const [invitations, setInvitations] = useState<Invitation[]>([])
 const [loading, setLoading] = useState(true)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [message, setMessage] = useState('')
 const [createdLink, setCreatedLink] = useState<{ url: string; email: string } | null>(null)
 const load = useCallback(async () => {
  if (!household) return
  setLoading(true); setError('')
  try {
   const [people, invites] = await Promise.all([
    db().rpc('get_household_members', { p_household: household.id }),
    owner ? db().from('invitations').select('id,household_id,email,created_by,created_at,expires_at,accepted_at,accepted_by,revoked_at').eq('household_id', household.id).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null })
   ])
   if (people.error) throw people.error
   if (invites.error) throw invites.error
   setMembers(people.data || []); setInvitations(invites.data || [])
  } catch (error) { setError(errorMessage(error)) }
  finally { setLoading(false) }
 }, [household?.id, owner])
 useEffect(() => { void load() }, [load])
 async function create(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = event.currentTarget
  const email = String(new FormData(form).get('email')).trim().toLowerCase()
  setBusy(true); setError(''); setMessage(''); setCreatedLink(null)
  try {
   const { data, error } = await db().rpc('create_household_invitation', { p_household: household!.id, p_email: email })
   if (error) throw error
   if (!data) throw new Error('The invitation could not be created. Please retry.')
   setCreatedLink({ url: `${appUrl}/invite/${data.token}`, email }); form.reset(); await load()
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 async function revoke(id: string) {
  setBusy(true); setError(''); setMessage('')
  try {
   const { error } = await db().rpc('revoke_household_invitation', { p_invitation: id })
   if (error) throw error
   setCreatedLink(null); setMessage('Invitation revoked. That link can no longer be used.'); await load()
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 async function copy() {
  try { await navigator.clipboard.writeText(createdLink!.url); setMessage('Invitation link copied. Share it with the person you invited.') }
  catch { setMessage('Copy the invitation address from the box below to share it.') }
 }
 return <><PageTitle eyebrow="YOUR FAMILY" title={household!.name}>One dog. A little team of people who care.</PageTitle>
  {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
  {owner && <FamilyNameForm key={household!.id} household={household!} onSaved={updateHousehold}/>}
  <div className="family-grid"><section className="card"><div className="icon-tile"><Users/></div><h2>Your pack</h2>
   {loading ? <p role="status" className="muted">Loading family…</p> : <ul className="member-list">{members.map(member => <li key={member.user_id}><span className="avatar">{member.display_name.charAt(0).toUpperCase()}</span><div><strong>{member.display_name}{member.user_id === session?.user.id ? ' (you)' : ''}</strong><small>Joined {new Date(member.joined_at).toLocaleDateString()}</small></div><span className="role-badge">{member.role}</span></li>)}</ul>}
   {error && <Button type="button" className="secondary" onClick={() => void load()}>Retry loading family</Button>}
  </section><section className="card"><div className="icon-tile peach"><LinkIcon/></div><h2>{owner ? 'Make room for family.' : 'All connected.'}</h2>
   {owner ? <><p className="muted">Enter their email, create a link, and send it to them. They’ll use that email to join your private household.</p><form className="form-stack" onSubmit={create}><Field label="Family member’s email" name="email" type="email" required maxLength={254} autoComplete="off" placeholder="someone@example.com"/><Button disabled={busy}>{busy ? 'Please wait…' : 'Create invitation link'}</Button></form><p className="photo-hint">Links expire after 7 days. Creating a new link for the same email replaces the old one. No invitation email is sent automatically.</p></> : <p className="muted">Your household owner can invite more people. Everyone here shares the same dog profile and photo.</p>}
   {createdLink && <div className="created-invite"><strong>Ready for {createdLink.email}</strong><p>Share this link privately. Only that email can accept it.</p><label className="field">Invitation link<input value={createdLink.url} readOnly onFocus={event => event.currentTarget.select()}/></label><Button type="button" className="secondary" onClick={() => void copy()}><Copy size={16}/>Copy link</Button></div>}
  </section></div>
  {owner && <section className="card invitation-history"><h2>Invitations</h2>{loading ? <p role="status">Loading invitations…</p> : invitations.length === 0 ? <p className="muted">No invitations yet. You can also keep using PawShare on your own.</p> : <ul className="invitation-list">{invitations.map(invite => {
   const status = invite.accepted_at ? 'Joined' : invite.revoked_at ? 'Revoked' : new Date(invite.expires_at).getTime() <= Date.now() ? 'Expired' : 'Pending'
   return <li key={invite.id}><div><strong>{invite.email}</strong><small>{status} · {status === 'Pending' ? 'Expires' : 'Created'} {new Date(status === 'Pending' ? invite.expires_at : invite.created_at).toLocaleDateString()}</small></div>{status === 'Pending' && <Button type="button" className="secondary" disabled={busy} onClick={() => void revoke(invite.id)}>Revoke</Button>}</li>
  })}</ul>}</section>}
  <div className="privacy-strip"><ShieldCheck size={20}/><p>Invitations grant member access only. Your family’s data stays private.</p></div>
 </>
}
