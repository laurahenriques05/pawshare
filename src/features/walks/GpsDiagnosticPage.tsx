import { useEffect, useRef, useState } from 'react'
import { Button, Notice, PageTitle } from '../../components/ui'

export function GpsDiagnosticPage() {
 const watch = useRef<number | null>(null)
 const lastFix = useRef<number | null>(null)
 const [running, setRunning] = useState(false)
 const [error, setError] = useState('')
 const [fix, setFix] = useState<GeolocationPosition | null>(null)
 const [count, setCount] = useState(0)
 const [now, setNow] = useState(Date.now())
 const [events, setEvents] = useState<string[]>([])
 function log(message: string) {
  setEvents(previous => [`${new Date().toLocaleTimeString()} — ${message}`, ...previous].slice(0, 40))
 }
 function stop() {
  if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
  watch.current = null
  setRunning(false)
 }
 useEffect(() => () => {
  if (watch.current !== null) navigator.geolocation.clearWatch(watch.current)
 }, [])
 useEffect(() => {
  if (!running) return
  const interval = window.setInterval(() => setNow(Date.now()), 1000)
  const visibility = () => log(document.hidden ? 'App hidden; tracking may be suspended.' : 'App visible again.')
  const online = () => log(navigator.onLine ? 'Internet connection restored.' : 'Offline; GPS can still deliver positions.')
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('online', online)
  window.addEventListener('offline', online)
  return () => {
   clearInterval(interval)
   document.removeEventListener('visibilitychange', visibility)
   window.removeEventListener('online', online)
   window.removeEventListener('offline', online)
  }
 }, [running])
 function start() {
  if (watch.current !== null) return
  setError('')
  if (!window.isSecureContext || !navigator.geolocation) {
   setError('Location needs HTTPS (or localhost) and a browser with geolocation support.')
   return
  }
  setFix(null); setCount(0); setEvents([]); lastFix.current = null
  setRunning(true)
  log('Location test started. Waiting for permission and a GPS position.')
  watch.current = navigator.geolocation.watchPosition(position => {
   const received = Date.now()
   const gap = lastFix.current === null ? 0 : received - lastFix.current
   if (gap > 30000) log(`Position delivery interrupted for ${Math.round(gap / 1000)} seconds.`)
   lastFix.current = received
   setNow(received); setFix(position); setCount(value => value + 1); setError('')
  }, failure => {
   setError(failure.code === 1 ? 'Location permission denied. Allow location for this site in your browser settings, then try again.' : failure.code === 2 ? 'Location unavailable. Try outdoors with location services enabled.' : 'Location request timed out. Waiting for another position.')
   log(`Location error: ${failure.code}`)
   if (failure.code === 1) stop()
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
 }
 const age = fix ? Math.max(0, Math.floor((now - fix.timestamp) / 1000)) : null
 return <section>
  <PageTitle eyebrow="WALKS · GPS PROTOTYPE" title="Test your walking GPS">Check location delivery on your phone before we build recorded walks.</PageTitle>
  <Notice>This test requests your location only when you press Start GPS test. Coordinates stay in this screen’s memory and are cleared when you leave or reload. No walk is saved or shared.</Notice>
  <p>Keep this page open while testing. Browsers may pause GPS when the screen locks or another app opens. Missing positions do not mean you stopped moving.</p>
  {error && <Notice error>{error}</Notice>}
  <p><Button onClick={running ? () => { stop(); log('Test stopped.') } : start}>{running ? 'Stop GPS test' : 'Start GPS test'}</Button></p>
  <div className="notice" role="status">{running ? (fix ? 'Receiving location' : 'Waiting for location') : 'Test stopped'} · {count} positions received</div>
  <dl>
   <dt>Latest position</dt><dd>{fix ? `${fix.coords.latitude.toFixed(6)}, ${fix.coords.longitude.toFixed(6)}` : 'No position yet'}</dd>
   <dt>Reported accuracy</dt><dd>{fix ? `±${Math.round(fix.coords.accuracy)} m` : '—'}</dd>
   <dt>Age of latest position</dt><dd>{age === null ? '—' : `${age} seconds`}</dd>
  </dl>
  {running && age !== null && age > 30 && <Notice>No fresh position for over 30 seconds. Tracking may be interrupted.</Notice>}
  <h2>Test log</h2>
  <p>Last 40 events. Note the phone, browser, test conditions and longest interruption; avoid sharing coordinates.</p>
  <ul>{events.map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ul>
 </section>
}
