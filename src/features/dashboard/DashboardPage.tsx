import { Link } from 'react-router-dom'
import { ArrowUpRight, Bell, CalendarDays, GraduationCap, ListChecks, PawPrint, ShieldCheck, Users } from 'lucide-react'
import { PageTitle, Button, Notice } from '../../components/ui'
import { useHousehold } from '../household/HouseholdProvider'
import { useAuth } from '../auth/AuthProvider'
import { DogForm } from '../dog-profile/DogForm'
import { DogPhoto } from '../dog-profile/DogPhoto'
import { db } from '../../lib/supabase/client'
import { useState } from 'react'
import { HomeView } from './HomeView'
import { HomeFamilyCard } from './HomeFamilyCard'
export function DashboardPage() {
 const { dog, household, membership } = useHousehold()
 const { session } = useAuth()
 return <HomeView dog={dog!} household={household!} photo={<DogPhoto householdId={household!.id} dogId={dog!.id} name={dog!.name} className="home-portrait"/>} family={<HomeFamilyCard householdId={household!.id} currentUserId={session!.user.id} owner={membership?.role === 'owner'} dogName={dog!.name}/>}/>
}
export function DogProfilePage() { const { dog, household, reload } = useHousehold(); return <><PageTitle eyebrow="YOUR DOG" title={`${dog!.name}’s profile`}>The little details that make them, them.</PageTitle><section className="card max-w-2xl"><DogForm dog={dog} householdId={household!.id} onSaved={reload}/></section></> }
export function MorePage() {
 const { household, membership } = useHousehold(); const { session } = useAuth(); const [error, setError] = useState('')
 return <><PageTitle eyebrow="YOUR SPACE" title="A little more PawShare."/><div className="more-grid"><Link className="card more-link" to="/more/dog"><PawPrint/><div><h3>Dog profile</h3><p className="muted">View and edit your best friend’s details</p></div><ArrowUpRight/></Link><Link className="card more-link" to="/more/family"><Users/><div><h3>Family · {household!.name}</h3><p className="muted">{membership!.role === 'owner' ? 'Invite people and manage invitation links' : 'Meet the people caring for your dog'}</p></div><ArrowUpRight/></Link><Link className="card more-link" to="/tasks"><ListChecks/><div><h3>Family tasks</h3><p className="muted">Share responsibilities and recurring care</p></div><ArrowUpRight/></Link><Link className="card more-link" to="/calendar"><CalendarDays/><div><h3>Shared calendar</h3><p className="muted">See upcoming care across PawShare</p></div><ArrowUpRight/></Link><Link className="card more-link" to="/academy"><GraduationCap/><div><h3>Academy</h3><p className="muted">Learn and keep one shared family journey</p></div><ArrowUpRight/></Link><Link className="card more-link" to="/more/notifications"><Bell/><div><h3>Notifications</h3><p className="muted">Choose reminders for your account and devices</p></div><ArrowUpRight/></Link><section className="card"><ShieldCheck/><h3>Account</h3><Link className="text-link" to="/more/account">Edit account settings</Link><p className="muted break-all">{session?.user.email}</p><p className="muted">Household time zone: {household!.timezone}</p>{error && <Notice error>{error}</Notice>}<Button className="secondary" onClick={async () => { const { error } = await db().auth.signOut(); if (error) setError(error.message) }}>Sign out</Button></section></div></>
}
