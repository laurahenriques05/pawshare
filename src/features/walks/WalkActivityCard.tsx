import { Footprints, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Button, errorMessage } from '../../components/ui'
import { getPoints } from './api'
import { RouteMap } from './RouteMap'
import { type Point } from './gps'
import './walks.css'

export function WalkStats({ meters, seconds }: { meters: number; seconds: number }) {
 const minutes = Math.floor(seconds / 60)
 return <dl className="walk-activity-stats">
  <div><dt>Distance</dt><dd>{Math.round(meters).toLocaleString()} <small>m</small></dd></div>
  <div><dt>Time</dt><dd>{minutes < 60 ? <>{minutes}<small>min</small> {Math.floor(seconds % 60)}<small>s</small></> : <>{Math.floor(minutes / 60)}<small>h</small> {minutes % 60}<small>min</small></>}</dd></div>
  <div><dt>Average speed</dt><dd>{(seconds > 0 ? meters / seconds * 3.6 : 0).toFixed(1)} <small>km/h</small></dd></div>
 </dl>
}
function SavedRoutePreview({ id }: { id: string }) {
 const host = useRef<HTMLDivElement>(null)
 const [visible, setVisible] = useState(false)
 const [points, setPoints] = useState<Point[] | null>(null)
 const [error, setError] = useState('')
 const [retry, setRetry] = useState(0)
 useEffect(() => {
  if (!host.current) return
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
  })
  observer.observe(host.current)
  return () => observer.disconnect()
 }, [])
 useEffect(() => {
  if (!visible) return
  let live = true
  setError(''); setPoints(null)
  void getPoints(id).then(result => { if (live) setPoints(result) }).catch(e => { if (live) setError(errorMessage(e)) })
  return () => { live = false }
 }, [id, visible, retry])
 return <div ref={host} className="walk-saved-route">{error ? <p role="alert">Route unavailable: {error} <Button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry route</Button></p> : points ? <RouteMap points={points} compact/> : <p role="status">{visible ? 'Loading saved route…' : 'Map loads when viewed.'}</p>}</div>
}
export function WalkActivityCard({ id, title, startedAt, location, points, meters, seconds, demo = false, loadRoute = false }: {
 id: string; title: string; startedAt: string; location?: string; points?: Point[]; meters: number; seconds: number; demo?: boolean; loadRoute?: boolean
}) {
 return <article className="walk-activity-card">
  <div className="walk-activity-heading"><span className="icon-tile"><Footprints size={20}/></span><div><p className="muted">{new Date(startedAt).toLocaleString()}{demo && <span className="walk-demo-label">Demo · fictional walk</span>}</p><h3><Link to={`/walks/${id}`}>{title}</Link></h3></div></div>
  <WalkStats meters={meters} seconds={seconds}/>
  {points ? <RouteMap points={points} compact/> : loadRoute && <SavedRoutePreview id={id}/>}
  <div className="walk-activity-footer"><span className="muted">{location || 'Saved GPS walk'}</span><Link to={`/walks/${id}`}>View walk <ArrowUpRight size={16}/></Link></div>
 </article>
}
