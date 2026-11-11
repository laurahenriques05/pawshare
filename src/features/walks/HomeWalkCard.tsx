import { Link } from 'react-router-dom'
import { Footprints, ArrowUpRight } from 'lucide-react'
import { Button } from '../../components/ui'
import { useHousehold } from '../household/HouseholdProvider'
import { useWalks } from './WalkProvider'
import { summarize, timeLabel } from './gps'
export function HomeWalkCard(){
 const data=useWalks(),{household}=useHousehold()
 const today=summarize(data.walks,'day',household!.timezone),active=data.walks.find(w=>!w.ended_at&&!w.deleted_at),latest=data.walks.find(w=>w.ended_at&&!w.deleted_at)
 return <section className="card home-walk-card" aria-labelledby="home-walk-title"><div className="home-card-heading"><span className="icon-tile"><Footprints size={20}/></span><div><p className="eyebrow">A LITTLE FRESH AIR</p><h3 id="home-walk-title">Walks</h3></div></div>{data.loading?<p role="status">Loading walking summary…</p>:data.error?<><p role="alert">Walking summary unavailable.</p><Button className="secondary" onClick={()=>void data.reload()}>Retry</Button></>:<><p>{active?'Your dog is out on a walk. The route is private until it finishes.':`${today.count} completed ${today.count===1?'walk':'walks'} today · ${timeLabel(today.seconds)} · ${(today.meters/1000).toFixed(2)} km`}</p>{latest?<p className="muted">Latest: <Link to={`/walks/${latest.id}`}>{new Date(latest.started_at).toLocaleDateString()} · {(latest.distance_m/1000).toFixed(2)} km</Link></p>:<p className="muted">Your first completed walk will appear here.</p>}{active&&<p className="muted">Completed today: {timeLabel(today.seconds)} · {(today.meters/1000).toFixed(2)} km</p>}</>}<Link className="text-link" to="/walks">{active?'Open Walks':'Plan a little adventure'}<ArrowUpRight size={16}/></Link></section>
}
