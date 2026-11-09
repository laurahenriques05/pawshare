import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, UserPlus, Users } from 'lucide-react'
import { Button, Notice, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { FamilyMember } from '../../lib/supabase/database.types'

export function FamilySummary({ members, currentUserId, owner, dogName }: { members: FamilyMember[]; currentUserId: string; owner: boolean; dogName: string }) {
 return <><div className="home-family-people">{members.slice(0, 4).map(member => <div className="home-person" key={member.user_id}><span className="home-person-avatar" aria-hidden="true">{member.display_name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || '?'}</span><div><strong>{member.display_name}{member.user_id === currentUserId && <span className="home-you"> · you</span>}</strong><span className="home-person-role">{member.role === 'owner' ? 'Household owner' : 'Family member'}</span></div></div>)}</div>
  <p className="home-family-caption">{members.length === 1 ? `You and ${dogName}. A lovely little team.` : members.length > 4 ? `And ${members.length - 4} more in your family. Good care is a team effort.` : `A little team looking out for ${dogName}.`}</p>
  <Link className={`button ${owner ? '' : 'secondary'} home-family-action`} to="/more/family">{owner ? <><UserPlus size={17}/>Invite someone</> : <>View family<ArrowUpRight size={17}/></>}</Link>
 </>
}

export function HomeFamilyCard({ householdId, currentUserId, owner, dogName }: { householdId: string; currentUserId: string; owner: boolean; dogName: string }) {
 const [members, setMembers] = useState<FamilyMember[]>([])
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [retry, setRetry] = useState(0)
 // Keep a request scoped to this household; a slow previous request must not replace it.
 const load = useCallback(async () => db().rpc('get_household_members', { p_household: householdId }), [householdId])
 useEffect(() => {
  let active = true
  setLoading(true); setError(''); setMembers([])
  void (async () => {
   try {
    const { data, error } = await load()
    if (error) throw error
    if (active) setMembers(data || [])
   } catch (error) { if (active) setError(errorMessage(error)) }
   finally { if (active) setLoading(false) }
  })()
  return () => { active = false }
 }, [load, retry])
 return <section className="card home-family-card" aria-labelledby="home-family-title" aria-busy={loading}><div className="home-card-heading"><span className="icon-tile peach"><Users size={20}/></span><div><p className="eyebrow">BETTER TOGETHER</p><h3 id="home-family-title">Your little pack</h3></div>{!loading && !error && <span className="home-count">{members.length} {members.length === 1 ? 'person' : 'people'}</span>}</div>
  {loading ? <p className="muted home-family-loading" role="status">Gathering your pack…</p> : error ? <><Notice error>We couldn’t load your family. {error}</Notice><Button className="secondary" onClick={() => setRetry(value => value + 1)}>Try again</Button></> : members.length ? <FamilySummary members={members} currentUserId={currentUserId} owner={owner} dogName={dogName}/> : <><p className="muted">Your family list is taking a little longer to arrive.</p><Link className="text-link" to="/more/family">Open family<ArrowUpRight size={16}/></Link></>}
 </section>
}
