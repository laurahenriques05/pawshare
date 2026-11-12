import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap } from 'leaflet'
import { Button } from '../../components/ui'
import { type Point } from './gps'
import { mapCoordinates } from './mapGeometry'
import { createPinchZoomHandler } from './mapGestures'
import 'leaflet/dist/leaflet.css'
import { type ReplayFrame } from './routeReplay'
import { useRouteReplay } from './useRouteReplay'
import { RouteMapControls } from './RouteMapControls'
import './walks.css'

/** Coordinates stay in the browser; only visible map tile areas go to OSM. */
export function OpenStreetRouteMap({ points, compact = false }: { points: Point[]; compact?: boolean }) {
 const host = useRef<HTMLDivElement>(null)
 const fit = useRef<() => void>(() => {})
 const draw = useRef<(points: Point[]) => void>(() => {})
 const latest = useRef(points)
 const replay = useRouteReplay(points)
 const renderFrame = useRef<(frame: ReplayFrame, playing: boolean) => void>(() => {})
 const latestFrame = useRef({ frame: replay.frame, playing: replay.playing })
 const [ready, setReady] = useState(false)
 useEffect(() => { latestFrame.current = { frame: replay.frame, playing: replay.playing }; renderFrame.current(replay.frame, replay.playing) }, [replay.frame, replay.playing])
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
  let removeWheel: (()=>void) | undefined
  setLoading(true); setReady(false); setError('')
  void import('leaflet').then(L => {
   if (disposed || !host.current) return
   const coordinates = mapCoordinates(latest.current)
   if (!coordinates.length) { setLoading(false); return }
   instance = L.map(host.current, { scrollWheelZoom: false, touchZoom: true, doubleClickZoom: false, dragging: !window.matchMedia('(pointer: coarse)').matches, zoomSnap: .25, zoomDelta: .5, worldCopyJump: true, maxZoom: 19, minZoom: 0 })
   instance.attributionControl.setPrefix(false)
   const canvas = host.current
   const onWheel = createPinchZoomHandler((delta, event) => {
    if (!instance) return
    const zoom = Math.max(instance.getMinZoom(), Math.min(instance.getMaxZoom(), instance.getZoom() + delta))
    instance.setZoomAround(instance.mouseEventToContainerPoint(event), zoom, { animate: false })
   })
   canvas.addEventListener('wheel', onWheel, { passive: false })
   removeWheel = () => canvas.removeEventListener('wheel', onWheel)
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
   const lines = L.layerGroup().addTo(instance)
   const cursor = L.circleMarker(coordinates[0], { radius: 6, color: '#fffdf7', weight: 3, fillColor: '#425c39', fillOpacity: 1 })
   renderFrame.current = (frame, playing) => {
    lines.clearLayers()
    for (const coordinates of frame.lines) {
     L.polyline(coordinates, { color: '#fffdf7', weight: 8, opacity: 1, interactive: false }).addTo(lines)
     L.polyline(coordinates, { color: '#425c39', weight: 5, opacity: 1, interactive: false }).addTo(lines)
    }
    if (playing && frame.cursor) cursor.setLatLng(frame.cursor).addTo(instance!)
    else cursor.remove()
   }
   draw.current = next => {
    routeLayer.clearLayers()
    const current = mapCoordinates(next)
    if (!current.length) return
    bounds = L.latLngBounds(current)
    renderFrame.current(latestFrame.current.frame, latestFrame.current.playing)
    L.circleMarker(current[0], { radius: 6, color: '#425c39', weight: 3, fillColor: '#fffdf7', fillOpacity: 1 }).bindTooltip('Start').addTo(routeLayer)
    L.circleMarker(current.at(-1)!, { radius: 5, color: '#fffdf7', weight: 2, fillColor: '#425c39', fillOpacity: 1 }).bindTooltip('Finish').addTo(routeLayer)
   }
   draw.current(latest.current); setReady(true)
   L.control.scale({ imperial: false }).addTo(instance)
   fitRoute()
   resize = new ResizeObserver(() => instance?.invalidateSize({ animate: false }))
   resize.observe(host.current)
  }).catch(() => { if (!disposed) { setLoading(false); setError('The map could not load. Check your connection and retry.') } })
  return () => { disposed = true; resize?.disconnect(); removeWheel?.(); instance?.remove(); fit.current = () => {}; draw.current = () => {}; renderFrame.current = () => {} }
 }, [visible, retry])
 if (!valid.length) return <p className="walk-empty">No GPS route recorded. Time-only walks are still included in summaries.</p>
 return <figure className={`walk-route-map${compact ? ' compact' : ''}`}>
  <div ref={host} className="walk-map-canvas" role="region" aria-label="Interactive walking route map. Pinch with two fingers to zoom. Normal scrolling leaves the map unchanged. Keyboard and zoom buttons are available."/>
  {visible && loading && <p className="walk-map-status" role="status">Loading street map…</p>}
  {error && <p className="walk-map-status" role="alert">{error} <Button className="secondary" onClick={() => setRetry(n => n + 1)}>Retry map</Button></p>}
  <RouteMapControls playing={replay.playing} disabled={!ready || !replay.canReplay} status={replay.status} onFit={() => fit.current()} onReplay={() => { if (!replay.playing) fit.current(); replay.toggle() }}/>

 </figure>
}
