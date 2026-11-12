import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Notice, PageTitle } from '../../components/ui'
import { demoWalks, type DemoWalk } from './demo'
import { RouteMap } from './RouteMap'
import { WalkActivityCard, WalkStats } from './WalkActivityCard'

export function DemoWalks() {
 const [show, setShow] = useState(true)
 return <section className="card walk-demo-section" aria-label="Classroom walk examples">
  <div className="walk-heading"><div><p className="eyebrow">CLASSROOM EXAMPLES</p><h2>Three trails to explore</h2></div><Button className="secondary" aria-expanded={show} aria-controls="demo-walk-list" onClick={() => setShow(value => !value)}>{show ? 'Hide examples' : 'Show examples'}</Button></div>
  <p>Three fictional past walks for the presentation. They stay separate from your family’s saved history and statistics. Real walks use the phone’s GPS anywhere in the world.</p>
  {show && <div id="demo-walk-list" className="walk-activity-list">{demoWalks.map(walk => <WalkActivityCard key={walk.id} {...walk} demo/>)}</div>}
 </section>
}
export function DemoWalkDetail({ walk }: { walk: DemoWalk }) {
 return <div className="walk-page"><Link to="/walks">← All walks</Link><PageTitle eyebrow="CLASSROOM EXAMPLE" title={walk.title}/>
  <Notice>Fictional demonstration walk. No real person or GPS session is represented; this example is not saved to your household or counted in statistics.</Notice>
  <section className="card"><div className="walk-heading"><h2>{walk.location}</h2><span className="walk-demo-label">Demo</span></div><p>{new Date(walk.startedAt).toLocaleString()}</p><WalkStats meters={walk.meters} seconds={walk.seconds}/><RouteMap points={walk.points}/></section>
  <nav className="walk-actions" aria-label="Other demonstration walks">{demoWalks.filter(item => item.id !== walk.id).map(item => <Link key={item.id} to={`/walks/${item.id}`}>{item.title}</Link>)}</nav>
 </div>
}
