import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { Brand, Button, Loading, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { InvitationPreview } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from './HouseholdProvider'
import { forgetInvitation, rememberInvitation, validInvitationToken } from './invitations'

export function InvitationPage() {
 const { token = '' } = useParams()
 const { session, loading: authLoading } = useAuth()
 const { select } = useHousehold()
 const navigate = useNavigate()
 const [preview, setPreview] = useState<InvitationPreview | null>(null)
 const [loading, setLoading] = useState(false)
 const [busy, setBusy] = useState(false)
 const [error, setError] = useState('')
 const [attempt, retry] = useState(0)
 const valid = validInvitationToken(token)
 useEffect(() => { if (valid) rememberInvitation(token) }, [token, valid])
 useEffect(() => {
  let active = true
  if (!session || !valid) return
  setLoading(true); setError(''); setPreview(null)
  Promise.resolve(db().rpc('preview_household_invitation', { p_token: token })).then(({ data, error }) => {
   if (!active) return
   if (error) setError(error.message); else setPreview(data)
   setLoading(false)
  }).catch(error => { if (active) { setError(errorMessage(error)); setLoading(false) } })
  return () => { active = false }
 }, [session?.user.id, token, valid, attempt])
 async function accept() {
  setBusy(true); setError('')
  try {
   const { data, error } = await db().rpc('accept_household_invitation', { p_token: token })
   if (error) throw error
   if (!data) throw new Error('Unable to join this household. Please retry.')
   forgetInvitation(); select(data); navigate('/', { replace: true })
  } catch (error) { setError(errorMessage(error)) }
  finally { setBusy(false) }
 }
 if (authLoading) return <Loading/>
 const authQuery = `?invite=${encodeURIComponent(token)}`
 return <div className="onboarding"><header><Brand/><Link to="/" onClick={forgetInvitation}>Back to PawShare</Link></header><main className="onboard-card card invite-landing"><div className="icon-tile"><Users/></div><PageTitle eyebrow="A LITTLE MORE TOGETHER" title={preview ? `Join ${preview.household_name}.` : 'You’re invited to the pack.'}>{preview?.dog_name ? `Help care for ${preview.dog_name}, together.` : 'Join a private PawShare household and share everyday dog care.'}</PageTitle>
  {!valid ? <Notice error>This invitation link is invalid. Ask the household owner for a new one.</Notice> : !session ? <><p className="muted">Sign in or create an account with the email address the owner invited. You won’t need to create a household or register another dog.</p><div className="form-stack"><Link className="button" to={`/sign-in${authQuery}`}>Sign in to join</Link><Link className="button secondary" to={`/sign-up${authQuery}`}>Create an account</Link></div><p className="fine-print">After confirming a new account, reopen this invitation link if you’re not returned here automatically.</p></> : <>
   <p className="muted break-all">Signed in as {session.user.email}</p>
   {loading && <p role="status">Checking your invitation…</p>}{error && <Notice error>{error}</Notice>}
   {preview && <><p className="muted">You’ll join as a member. Your existing households will stay available.</p><Button disabled={busy} onClick={() => void accept()}>{busy ? 'Joining your family…' : preview.already_member ? 'Open this household' : 'Accept invitation'}</Button></>}
   {error && <Button className="secondary" disabled={busy} onClick={() => retry(value => value + 1)}>Check again</Button>}
   <Button className="secondary" disabled={busy} onClick={async () => { const { error } = await db().auth.signOut(); if (error) setError(error.message) }}>Use a different account</Button>
  </>}
 </main></div>
}
