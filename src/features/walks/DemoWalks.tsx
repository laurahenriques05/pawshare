import { Link } from 'react-router-dom'
import { Notice, PageTitle } from '../../components/ui'
import { demoWalks, type DemoWalk } from './demo'
import { RouteMap } from './RouteMap'
import { WalkStats } from './WalkActivityCard'

export function DemoWalkDetail({ walk }: { walk: DemoWalk }) {
 return <div className="walk-page"><Link to="/walks">← All walks</Link><PageTitle eyebrow="CLASSROOM EXAMPLE" title={walk.title}/>
  <Notice>Fictional demonstration walk. No real person or GPS session is represented; this example counts towards displayed Walks totals while demonstration mode is on, and is not saved to your household.</Notice>
  <section className="card"><div className="walk-heading"><h2>{walk.location}</h2><span className="walk-demo-label">Demo</span></div><p>{new Date(walk.startedAt).toLocaleString()}</p><WalkStats meters={walk.meters} seconds={walk.seconds}/><RouteMap points={walk.points}/></section>
  <nav className="walk-actions" aria-label="Other demonstration walks">{demoWalks.filter(item => item.id !== walk.id).map(item => <Link key={item.id} to={`/walks/${item.id}`}>{item.title}</Link>)}</nav>
 </div>
}
