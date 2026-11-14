import { Link } from 'react-router-dom'
import { PageTitle } from '../../components/ui'
import { demoWalks, type DemoWalk } from './demo'
import { RouteMap } from './RouteMap'
import { WalkStats } from './WalkActivityCard'

export function DemoWalkDetail({ walk }: { walk: DemoWalk }) {
 return <div className="walk-page"><Link to="/walks">← All walks</Link><PageTitle eyebrow="YOUR WALKING DIARY" title={walk.title}/>

  <section className="card"><p>{new Date(walk.startedAt).toLocaleString()}</p><WalkStats meters={walk.meters} seconds={walk.seconds}/><RouteMap points={walk.points}/></section>
  <nav className="walk-actions" aria-label="Other walks">{demoWalks.filter(item => item.id !== walk.id).map(item => <Link key={item.id} to={`/walks/${item.id}`}>{item.title}</Link>)}</nav>
 </div>
}
