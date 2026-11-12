import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Notice, PageTitle } from '../../components/ui'
import type { HistoryEntry } from './history'
import { WalkActivityCard } from './WalkActivityCard'

export function WalkHistoryPage({ history, loading, ready, error, onRetry }: {
 history: HistoryEntry[]; loading: boolean; ready: boolean; error: string; onRetry: () => void
}) {
 const [limit, setLimit] = useState(20)
 return <div className="walk-page"><Link to="/walks">← Walks</Link><PageTitle eyebrow="YOUR WALKING DIARY" title="Past Adventures"/>
  {error && <Notice error>{error}<p><Button className="secondary" onClick={onRetry}>Retry connection</Button></p></Notice>}
  {loading ? <p role="status">Loading walks…</p> : !ready ? <section className="card"><p>Your walking history is not available yet.</p><Button className="secondary" onClick={onRetry}>Retry connection</Button></section> : <section className="card">
   {!history.length ? <p className="walk-empty">Your first completed walk will appear here.</p> : <div className="walk-activity-list">{history.slice(0,limit).map(walk => <WalkActivityCard key={walk.id} {...walk} loadRoute={!walk.demo}/>)}</div>}
   {history.length > limit && <Button className="secondary" onClick={() => setLimit(value => value + 20)}>Load more walks</Button>}
  </section>}
 </div>
}
