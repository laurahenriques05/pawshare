import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { Button, Notice, PageTitle } from '../../components/ui'
import { filterHistory, type HistoryEntry, type HistoryPeriod } from './history'
import { WalkActivityCard } from './WalkActivityCard'

const periodLabels = { day: 'Today', week: 'This week', month: 'This month', year: 'This year' } as const

export function WalkHistoryPage({ history, timezone, loading, ready, error, onRetry }: {
 history: HistoryEntry[]; timezone: string; loading: boolean; ready: boolean; error: string; onRetry: () => void
}) {
 const [limit, setLimit] = useState(20)
 const [period, setPeriod] = useState<HistoryPeriod>('month')
 const selected = filterHistory(history, period, timezone)
 return <div className="walk-page walk-history-page"><Link to="/walks">← Walks</Link><div className="walk-diary-heading"><PageTitle eyebrow="YOUR WALKING DIARY" title="Past Adventures"/><span className="walk-period-select"><select aria-label="Walking history period" value={period} onChange={e=>{setPeriod(e.target.value as HistoryPeriod);setLimit(20)}}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option></select><span className="walk-period-value" aria-hidden="true">{periodLabels[period]}</span><ChevronDown aria-hidden="true" size={16}/></span></div>
  {error && <Notice error>{error}<p><Button className="secondary" onClick={onRetry}>Retry connection</Button></p></Notice>}
  {loading ? <p role="status">Loading walks…</p> : !ready ? <section className="card"><p>Your walking history is not available yet.</p><Button className="secondary" onClick={onRetry}>Retry connection</Button></section> : <section className="card">
   {!history.length ? <p className="walk-empty">Your first completed walk will appear here.</p> : !selected.length ? <p className="walk-empty" role="status">No completed walks in this period.</p> : <div className="walk-activity-list">{selected.slice(0,limit).map(walk => <WalkActivityCard key={walk.id} {...walk} loadRoute={!walk.demo}/>)}</div>}
   {selected.length > limit && <Button className="secondary" onClick={() => setLimit(value => value + 20)}>Load more walks</Button>}
  </section>}
 </div>
}
