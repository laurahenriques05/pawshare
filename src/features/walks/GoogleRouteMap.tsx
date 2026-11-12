import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui'
import type { Point } from './gps'
import { mapCoordinates, mapSegments } from './mapGeometry'
import { GOOGLE_MAP_ERROR, loadGoogleMaps } from './googleMaps'
import './walks.css'

export default function GoogleRouteMap({ points, compact = false }: { points: Point[]; compact?: boolean }) {
 const host = useRef<HTMLDivElement>(null)
 const latest = useRef(points)
 const draw = useRef<(points: Point[]) => void>(() => {})
 const fit = useRef<() => void>(() => {})
 const world = useRef<() => void>(() => {})
 const [visible, setVisible] = useState(false)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState('')
 const [retry, setRetry] = useState(0)
 const hasPoints = mapCoordinates(points).length > 0
 useEffect(() => { latest.current = points; draw.current(points) }, [points])
 useEffect(() => {
  if (!host.current) return
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
  })
  observer.observe(host.current)
  return () => observer.disconnect()
 }, [hasPoints])
 useEffect(() => {
  if (!visible || !host.current || !hasPoints) return
  const element = host.current
  let disposed = false
  let instance: google.maps.Map | undefined
  let core: google.maps.CoreLibrary | undefined
  let resize: ResizeObserver | undefined
  const paths: google.maps.Polyline[] = []
  setLoading(true); setError('')
  const fail = () => { if (!disposed) { setLoading(false); setError('Google Maps is unavailable. Check the map configuration or connection, then retry.') } }
  window.addEventListener(GOOGLE_MAP_ERROR, fail)
  const timeout = window.setTimeout(fail, 30_000)
  void loadGoogleMaps().then(libraries => {
   if (disposed || !host.current) return
   const maps = libraries.maps; core = libraries.core
   instance = new maps.Map(host.current, {
    center: { lat: 0, lng: 0 }, zoom: 2, minZoom: 0, maxZoom: 21,
    mapTypeId: 'roadmap', gestureHandling: 'greedy', scrollwheel: true,
    zoomControl: true, mapTypeControl: false, streetViewControl: false,
    fullscreenControl: true, keyboardShortcuts: true,
   })
   const map = instance
   let bounds = new core.LatLngBounds()
   const fitRoute = () => {
    map.fitBounds(bounds, 36)
    core!.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() || 0) > 17) map.setZoom(17) })
   }
   fit.current = fitRoute
   world.current = () => { map.setCenter({ lat: 0, lng: 0 }); map.setZoom(0) }
   map.data.setStyle(feature => ({
    icon: { path: core!.SymbolPath.CIRCLE, scale: feature.getProperty('kind') === 'start' ? 6 : 5,
     fillColor: feature.getProperty('kind') === 'start' ? '#fffdf7' : '#425c39', fillOpacity: 1,
     strokeColor: feature.getProperty('kind') === 'start' ? '#425c39' : '#fffdf7', strokeWeight: 2 },
    title: feature.getProperty('kind') === 'start' ? 'Start' : 'Finish',
   }))
   draw.current = next => {
    paths.splice(0).forEach(path => path.setMap(null))
    map.data.forEach(feature => map.data.remove(feature))
    const coords = mapCoordinates(next)
    if (!coords.length) return
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
    for (const [lat, lng] of coords) { south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lng); east = Math.max(east, lng) }
    bounds = new core!.LatLngBounds(
     new core!.LatLng(south, west, true),
     new core!.LatLng(north, east, true),
    )
    for (const line of mapSegments(next)) {
     const path = line.map(([lat, lng]) => new core!.LatLng(lat, lng, true))
     for (const [strokeColor, strokeWeight] of [['#fffdf7', 8], ['#425c39', 5]] as const) {
      paths.push(new maps.Polyline({ map, path, strokeColor, strokeWeight, strokeOpacity: 1, clickable: false }))
     }
    }
    const [start, end] = [coords[0], coords.at(-1)!]
    map.data.addGeoJson({ type: 'FeatureCollection', features: [start, end].map(([lat, lng], index) => ({
     type: 'Feature', properties: { kind: index ? 'finish' : 'start' }, geometry: { type: 'Point', coordinates: [lng, lat] },
    })) })
   }
   draw.current(latest.current)
   core.event.addListenerOnce(map, 'tilesloaded', () => { if (!disposed) { window.clearTimeout(timeout); setLoading(false) } })
   fitRoute()
   resize = new ResizeObserver(() => core!.event.trigger(map, 'resize'))
   resize.observe(host.current)
  }).catch(fail)
  return () => {
   disposed = true; window.clearTimeout(timeout); window.removeEventListener(GOOGLE_MAP_ERROR, fail); resize?.disconnect()
   paths.forEach(path => path.setMap(null))
   if (instance && core) { core.event.clearInstanceListeners(instance); instance.data.setMap(null) }
   fit.current = () => {}; world.current = () => {}; draw.current = () => {}
   element.replaceChildren()
  }
 }, [visible, hasPoints, retry])
 if (!hasPoints) return <p className="walk-empty">No GPS route recorded. Time-only walks are still included in summaries.</p>
 return <figure className={`walk-route-map${compact ? ' compact' : ''}`}>
  <div ref={host} className="walk-map-canvas" role="region" aria-label="Google Maps walking route. Drag to pan, pinch or use the mouse wheel to zoom."/>
  {visible && loading && <p className="walk-map-status" role="status">Loading Google Maps…</p>}
  {error && <p className="walk-map-status" role="alert">{error} <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Retry map</Button></p>}
  <div className="walk-map-tools"><span><span className="walk-route-start"/> Start <span className="walk-route-finish"/> Finish</span><div><Button className="secondary" onClick={() => fit.current()}>Fit route</Button><Button className="secondary" onClick={() => world.current()}>World</Button></div></div>
  <figcaption>Google Maps · Drag to explore. Pinch or use the mouse wheel to zoom. GPS gaps stay open. Google receives the viewed area, route overlay and device/network information. <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Map privacy</a></figcaption>
 </figure>
}
