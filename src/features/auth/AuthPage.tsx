import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowRight, Heart, ShieldCheck, Sprout } from 'lucide-react'
import { Brand, Button, Field, Notice, errorMessage } from '../../components/ui'
import { appUrl, db } from '../../lib/supabase/client'
import { useAuth } from './AuthProvider'
import { invitationDestination, pendingInvitation, rememberInvitation } from '../household/invitations'
export function AuthPage() {
 const { pathname, search } = useLocation(); const invite = pendingInvitation(search); const authQuery = invite ? `?invite=${invite}` : '';
 useEffect(() => { if (invite) rememberInvitation(invite) }, [invite]); const signup = pathname === '/sign-up'; const forgot = pathname === '/forgot-password'; const reset = pathname === '/reset-password'
 const { session } = useAuth()
 const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [done, setDone] = useState(false)
 if ((session && !reset) || done) return <Navigate to={invitationDestination(search)} replace/>
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const form = new FormData(event.currentTarget); const email = String(form.get('email') || '').trim(); const password = String(form.get('password') || '')
  setBusy(true); setError(''); setMessage('')
  try {
   const auth = db().auth
   if (signup) { const { data, error } = await auth.signUp({ email, password, options: { data: { display_name: String(form.get('name')).trim() }, emailRedirectTo: `${appUrl}/auth/callback` } }); if (error) throw error; if (!data.session) setMessage(invite ? 'Check your email to confirm your account, then reopen the family invitation link if needed.' : 'Check your email to confirm your account. Open the confirmation link, then continue here.'); }
   else if (forgot) { const { error } = await auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/reset-password` }); if (error) throw error; setMessage('If an account exists for this email, a password reset link will arrive shortly.'); }
   else if (reset) { if (!session) throw new Error('Open the password reset link from your email first.'); const { error } = await auth.updateUser({ password }); if (error) throw error; setDone(true) }
   else { const { error } = await auth.signInWithPassword({ email, password }); if (error) throw error }
  } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
 return <div className="auth-layout"><aside className="auth-story"><Brand/><div><span className="pill">A happier everyday, together</span><h1>Little moments.<br/>A whole lot<br/>of love.</h1><p>One dog. One family. All connected.</p><div className="story-art" aria-hidden="true"><Heart size={90} strokeWidth={1}/><Sprout size={60}/></div></div><p className="story-footer"><ShieldCheck size={18}/> Your family’s space. Always private.</p></aside><main className="auth-main"><div className="mobile-brand"><Brand/></div><div className="auth-form"><p className="eyebrow">WELCOME TO PAWSHARE</p><h1>{signup ? 'Good care starts here.' : forgot ? 'Let’s get you back in.' : reset ? 'A fresh start.' : 'Welcome back.'}</h1><p className="muted">{signup ? invite ? 'Create your account to join the family. Use the email address that was invited.' : 'Create your account. Make a little space for your family.' : forgot ? 'We’ll email you a link to reset your password.' : reset ? 'Choose a new password for your account.' : 'Your little corner of dog life is waiting.'}</p>
 <form onSubmit={submit} className="form-stack">{signup && <Field label="Your name" name="name" autoComplete="name" required maxLength={80}/>} {!reset && <Field label="Email address" name="email" type="email" autoComplete="email" required maxLength={254}/>} {!forgot && <Field label={reset ? 'New password' : 'Password'} name="password" type="password" autoComplete={signup || reset ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required hint={signup || reset ? 'At least 8 characters.' : undefined}/>}
 {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}<Button disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : forgot ? 'Send reset link' : reset ? 'Save password' : 'Sign in'}<ArrowRight size={18}/></Button></form>
 {!signup && !forgot && !reset && <Link className="text-link" to="/forgot-password">Forgot your password?</Link>}<p className="auth-switch">{signup ? 'Already part of the pack?' : 'New to PawShare?'} <Link to={`${signup ? '/sign-in' : '/sign-up'}${authQuery}`}>{signup ? 'Sign in' : 'Create an account'}</Link></p>{forgot && <Link to="/sign-in">Back to sign in</Link>}<p className="fine-print">A private space for your dog’s everyday care.<br/>Inviting family is always optional.</p></div></main></div>
}
