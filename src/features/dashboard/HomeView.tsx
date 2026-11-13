import { HomeHealthCard } from '../health/HomeHealthCard'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Camera, PawPrint, ShieldCheck } from 'lucide-react'
import { PageTitle } from '../../components/ui'
import { FeedingHomeCard } from '../feeding/FeedingHomeCard'
import { HomeFeaturePreviews } from './HomeFeaturePreviews'
import { HomeWalkCard } from '../walks/HomeWalkCard'
import type { Dog, Household } from '../../lib/supabase/database.types'

export function HomeView({ dog, household, photo, family }: { dog: Dog; household: Household; photo: ReactNode; family: ReactNode }) {
 const birthday = dog.date_of_birth ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${dog.date_of_birth}T00:00:00Z`)) : 'Not added yet'
 return <div className="home-page"><PageTitle eyebrow="YOUR LITTLE CORNER OF DOG LIFE" title="Welcome home.">A little love. A little care. All for {dog.name}.</PageTitle>
  <section className="card home-dog-card" aria-labelledby="home-dog-name"><div className="home-portrait-wrap">{photo}<Link className="home-photo-action" to="/more/dog" aria-label={`Add or change ${dog.name}’s photo`} title="Change dog photo"><Camera size={14}/></Link></div><div className="home-dog-copy"><p className="eyebrow">THE HEART OF YOUR FAMILY</p><h2 id="home-dog-name">{dog.name}</h2><p className="home-dog-breed">{dog.breed || 'One of a kind'}</p></div><Link className="home-profile-action" to="/more/dog">View profile<ArrowUpRight size={16}/></Link></section>
  <div className="home-section-heading"><div><p className="eyebrow">THE EVERYDAY ESSENTIALS</p><h2>Your shared little world</h2></div><span className="home-private-label"><ShieldCheck size={14}/>Private to your family</span></div>
  <div className="home-details-grid">{family}<section className="card home-profile-card" aria-labelledby="home-profile-title"><div className="home-card-heading"><span className="icon-tile"><PawPrint size={20}/></span><div><p className="eyebrow">THE LITTLE DETAILS</p><h3 id="home-profile-title">All about {dog.name}</h3></div></div><dl className="home-dog-details"><div><dt>Weight</dt><dd>{dog.weight_kg ? `${dog.weight_kg} kg` : 'Not added yet'}</dd></div><div><dt>Birthday</dt><dd>{birthday}</dd></div><div><dt>Sex</dt><dd>{dog.sex === 'unknown' ? 'Not specified' : dog.sex === 'female' ? 'Female' : 'Male'}</dd></div><div><dt>Everyday energy</dt><dd>{dog.activity_level === 'high' ? 'Always on the go' : dog.activity_level === 'low' ? 'Taking it slowly' : 'A little of everything'}</dd></div></dl><Link className="text-link" to="/more/dog">Edit profile details<ArrowUpRight size={16}/></Link></section></div>
  <FeedingHomeCard householdId={household.id} timezone={household.timezone}/>
  <HomeWalkCard/>
  <HomeHealthCard key={household.id} home={household.id} zone={household.timezone}/>
  <HomeFeaturePreviews/>

  <footer className="home-footer"><PawPrint size={15} aria-hidden="true"/><p>A space for <strong>{household.name}</strong>. Made for the love of your dog.</p></footer>
 </div>
}
