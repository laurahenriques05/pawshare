import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Brand, Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { useHousehold } from '../household/HouseholdProvider'
import { DogForm } from '../dog-profile/DogForm'
export function OnboardingPage() {
 const { household, dog, reload } = useHousehold(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
 if (household && dog) return <Navigate to="/" replace/>
 async function create(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('')
  try { const { error } = await db().rpc('create_household', { p_name: String(form.get('name')).trim(), p_timezone: String(form.get('timezone')).trim() }); if (error) throw error; await reload() } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
 }
 return <div className="onboarding"><header><Brand/><Button className="secondary" onClick={() => void db().auth.signOut()}>Sign out</Button></header><main className="onboard-card"><div className="steps"><span className="active">1 <span>Your space</span></span><i/><span className={household ? 'active' : ''}>2 <span>Your dog</span></span><i/><span>3 <span>Welcome home</span></span></div><PageTitle eyebrow={household ? 'STEP 02 · THE BEST PART' : 'STEP 01 · MAKE YOURSELF AT HOME'} title={household ? 'Who’s the good dog?' : 'A space for your little pack.'}>{household ? 'A few details to make this feel like home. You can edit them later.' : 'Just you and your dog? Perfect. Family can join another time.'}</PageTitle>{household ? <DogForm householdId={household.id} onSaved={reload}/> : <form onSubmit={create} className="form-stack"><Field label="Household name" name="name" required maxLength={80} placeholder="Give your space a name"/><Field label="Time zone" name="timezone" required defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'} hint="An IANA time zone, such as Europe/Lisbon. Used for your household’s day."/>{error && <Notice error>{error}</Notice>}<Button disabled={busy}>{busy ? 'Creating your space…' : 'Continue to your dog →'}</Button></form>}<p className="fine-print">Private by default. Shared only with your household.</p></main></div>
}
