import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { Button } from '../../components/ui'
import { type Point } from './gps'
import { mapCoordinates, mapSegments } from './mapGeometry'
import 'leaflet/dist/leaflet.css'
import './walks.css'

/** Coordinates stay in the browser; only visible map tile areas go to OSM. */
export function RouteMap({ points, compact = false }: { points: Point[]; compact?: boolean }) {
 const host = useRef<HTMLDivElement>(null)
 const map = useRef<LeafletMap | null>(null)
 const fit = useRef<() => void>(() => {})
 const draw = useRef<(points: Point[]) => void>(() => {})
 const latest = useRef(points)
 useEffect(() => { latest.current = points; draw.current(points) }, [points])
 const [visible, setVisible] = useState(false)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [retry, setRetry] = useState(0)
 const valid = mapCoordinates(points)
 useEffect(() => {
  if (!host.current) return
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
  })
  observer.observe(host.current)
  return () => observer.disconnect()
 }, [points.length > 0])
 useEffect(() => {
  if (!visible || !host.current || !points.length) return
  let disposed = false
  let instance: LeafletMap | undefined
  let resize: ResizeObserver | undefined
  setLoading(true); setError('')
  void import('leaflet').then(L => {
   if (disposed || !host.current) return
   const coordinates = mapCoordinates(latest.current)
   if (!coordinates.length) { setLoading(false); return }
   instance = L.map(host.current, { scrollWheelZoom: false, worldCopyJump: true, maxZoom: 19, minZoom: 0 })
   map.current = instance
   let bounds = L.latLngBounds(coordinates)
   const fitRoute = () => instance?.fitBounds(bounds, { padding: [35, 35], maxZoom: 17, animate: false })
   fit.current = fitRoute
   const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, referrerPolicy: 'origin',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
   })
   tiles.on('tileerror', () => { if (!disposed) { setError('Street map unavailable. The GPS trace remains visible. Check your connection and retry.'); setLoading(false) } })
   tiles.on('load', () => { if (!disposed) setLoading(false) })
   tiles.addTo(instance)
   const routeLayer = L.layerGroup().addTo(instance)
   draw.current = next => {
    routeLayer.clearLayers()
    const current = mapCoordinates(next)
    if (!current.length) return
    bounds = L.latLngBounds(current)
    for (const coordinates of mapSegments(next)) {
     L.polyline(coordinates, { color: '#fffdf7', weight: 8, opacity: 1, interactive: false }).addTo(routeLayer)
     L.polyline(coordinates, { color: '#425c39', weight: 5, opacity: 1, interactive: false }).addTo(routeLayer)
    }
    L.circleMarker(current[0], { radius: 6, color: '#425c39', weight: 3, fillColor: '#fffdf7', fillOpacity: 1 }).bindTooltip('Start').addTo(routeLayer)
    L.circleMarker(current.at(-1)!, { radius: 5, color: '#fffdf7', weight: 2, fillColor: '#425c39', fillOpacity: 1 }).bindTooltip('Finish').addTo(routeLayer)
   }
   draw.current(latest.current)
   L.control.scale({ imperial: false }).addTo(instance)
   fitRoute()
   resize = new ResizeObserver(() => instance?.invalidateSize({ animate: false }))
   resize.observe(host.current)
  }).catch(() => { if (!disposed) { setLoading(false); setError('The map could not load. Check your connection and retry.') } })
  return () => { disposed = true; resize?.disconnect(); instance?.remove(); map.current = null; fit.current = () => {}; draw.current = () => {} }
 }, [visible, retry])
 if (!valid.length) return <p className="walk-empty">No GPS route recorded. Time-only walks are still included in summaries.</p>
 return <figure className={`walk-route-map${compact ? ' compact' : ''}`}>
  <div ref={host} className="walk-map-canvas" role="region" aria-label="Interactive walking route map. Use arrow keys to pan and plus or minus to zoom."/>
  {visible && loading && <p className="walk-map-status" role="status">Loading street map…</p>}
  {error && <p className="walk-map-status" role="alert">{error} <Button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry map</Button></p>}
  <div className="walk-map-tools"><span><span className="walk-route-start"/> Start <span className="walk-route-finish"/> Finish</span><div><Button className="secondary" onClick={() => fit.current()}>Fit route</Button><Button className="secondary" onClick={() => map.current?.fitWorld()}>World</Button></div></div>
  <figcaption>Drag or pinch to explore anywhere. GPS gaps stay open. Street maps need internet; OpenStreetMap receives the area viewed and your IP address. <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noreferrer">Map privacy</a></figcaption>
 </figure>
}
