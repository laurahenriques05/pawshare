import { useEffect, useRef, useState } from 'react'
import type { Map as VectorMap, GeoJSONSource, StyleSpecification } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Button } from '../../components/ui'
import type { Point } from './gps'
import { mapCoordinates } from './mapGeometry'
import { createPinchZoomHandler } from './mapGestures'
import { type ReplayFrame } from './routeReplay'
import { useRouteReplay } from './useRouteReplay'
import { RouteMapControls } from './RouteMapControls'
import { OpenStreetRouteMap } from './OpenStreetRouteMap'
import style from './mapStyle.json'
import 'maplibre-gl/dist/maplibre-gl.css'
import './walks.css'

export default function VectorRouteMap({ points, compact = false }: { points: Point[]; compact?: boolean }) {
 const host = useRef<HTMLDivElement>(null)
 const credits = useRef<HTMLDivElement>(null)
 const fit = useRef<() => void>(() => {})
 const drawPoints = useRef<(points: Point[]) => void>(() => {})
 const renderFrame = useRef<(frame: ReplayFrame, playing: boolean) => void>(() => {})
 const latest = useRef(points)
 const replay = useRouteReplay(points)
 const latestFrame = useRef({ frame: replay.frame, playing: replay.playing })
 const [visible, setVisible] = useState(false), [loading, setLoading] = useState(true), [ready, setReady] = useState(false)
 const [error, setError] = useState(''), [retry, setRetry] = useState(0), [fallback, setFallback] = useState(false)
 const hasPoints = mapCoordinates(points).length > 0
 useEffect(() => { latest.current = points; drawPoints.current(points) }, [points])
 useEffect(() => { latestFrame.current = { frame: replay.frame, playing: replay.playing }; renderFrame.current(replay.frame, replay.playing) }, [replay.frame, replay.playing])
 useEffect(() => {
  if (!host.current || fallback) return
  const observer = new IntersectionObserver(entries => {
   if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect() }
  })
  observer.observe(host.current)
  return () => observer.disconnect()
 }, [hasPoints, fallback])
 useEffect(() => {
  if (!visible || !host.current || !hasPoints || fallback) return
  const element = host.current
  let disposed = false, instance: VectorMap | undefined, resize: ResizeObserver | undefined
  let removeWheel: (() => void) | undefined
  setLoading(true); setReady(false); setError('')
  void import('maplibre-gl').then(M => {
   if (disposed) return
   M.setWorkerUrl(workerUrl)
   instance = new M.Map({
    container: element, style: structuredClone(style) as StyleSpecification,
    center: [0, 0], zoom: 0, minZoom: 0, maxZoom: 20,
    scrollZoom: false, doubleClickZoom: false, dragRotate: false,
    dragPan: !matchMedia('(pointer: coarse)').matches,
    touchZoomRotate: true, touchPitch: false, attributionControl: false,
    renderWorldCopies: true, pitchWithRotate: false,
   })
   const map = instance
   const attribution = new M.AttributionControl({ compact: false })
   map.addControl({
    onAdd: current => { const placeholder = document.createElement('div'); credits.current?.append(attribution.onAdd(current)); return placeholder },
    onRemove: () => attribution.onRemove(),
   })
   map.touchZoomRotate.disableRotation()
   map.addControl(new M.NavigationControl({ showCompass: false }), 'top-left')
   map.addControl(new M.ScaleControl({ unit: 'metric' }), 'bottom-left')
   let bounds = new M.LngLatBounds()
   const updateBounds = (next: Point[]) => {
    const coordinates = mapCoordinates(next)
    if (!coordinates.length) return
    let south = Infinity, north = -Infinity, west = Infinity, east = -Infinity
    for (const [lat, lng] of coordinates) { south = Math.min(south, lat); north = Math.max(north, lat); west = Math.min(west, lng); east = Math.max(east, lng) }
    bounds = new M.LngLatBounds([west, south], [east, north])
    const [start, end] = [coordinates[0], coordinates.at(-1)!]
    void (map.getSource('walk-ends') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [start, end].map(([lat, lng], i) => ({ type: 'Feature', properties: { kind: i ? 'finish' : 'start' }, geometry: { type: 'Point', coordinates: [lng, lat] } })) }).catch(() => {})
   }
   fit.current = () => map.fitBounds(bounds, { padding: 35, maxZoom: 17, duration: 0 })
   const onWheel = createPinchZoomHandler((delta, event) => {
    const box = element.getBoundingClientRect()
    map.zoomTo(Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), map.getZoom() + delta)), { around: map.unproject([event.clientX - box.left, event.clientY - box.top]), duration: 0 })
   })
   element.addEventListener('wheel', onWheel, { passive: false })
   removeWheel = () => element.removeEventListener('wheel', onWheel)
   map.on('style.load', () => {
    if (disposed) return
    const empty = { type: 'FeatureCollection' as const, features: [] }
    map.addSource('walk-route', { type: 'geojson', data: empty })
    map.addSource('walk-ends', { type: 'geojson', data: empty })
    map.addSource('walk-cursor', { type: 'geojson', data: empty })
    map.addLayer({ id: 'walk-route-halo', type: 'line', source: 'walk-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#fffdf7', 'line-width': 8 } })
    map.addLayer({ id: 'walk-route-green', type: 'line', source: 'walk-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#425c39', 'line-width': 5 } })
    map.addLayer({ id: 'walk-ends', type: 'circle', source: 'walk-ends', paint: { 'circle-radius': 5, 'circle-color': ['match', ['get', 'kind'], 'start', '#fffdf7', '#425c39'], 'circle-stroke-color': ['match', ['get', 'kind'], 'start', '#425c39', '#fffdf7'], 'circle-stroke-width': 2.5 } })
    map.addLayer({ id: 'walk-cursor', type: 'circle', source: 'walk-cursor', paint: { 'circle-radius': 6, 'circle-color': '#425c39', 'circle-stroke-color': '#fffdf7', 'circle-stroke-width': 3 } })
    drawPoints.current = updateBounds
    let applying = false
    let queued: { frame: ReplayFrame; playing: boolean } | null = null
    const flushFrame = async () => {
     if (applying || !queued || disposed) return
     const { frame, playing } = queued
     queued = null; applying = true
     try {
      await Promise.all([
       (map.getSource('walk-route') as GeoJSONSource).setData({ type: 'FeatureCollection', features: frame.lines.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: frame.lines.map(line => line.map(([lat, lng]) => [lng, lat])) } }] : [] }),
       (map.getSource('walk-cursor') as GeoJSONSource).setData({ type: 'FeatureCollection', features: playing && frame.cursor ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [frame.cursor[1], frame.cursor[0]] } }] : [] }),
      ])
     } catch { if (!disposed) setError('The route could not be drawn. Retry map.') }
     finally { applying = false; if (queued && !disposed) void flushFrame() }
    }
    renderFrame.current = (frame, playing) => { queued = { frame, playing }; void flushFrame() }
    updateBounds(latest.current); renderFrame.current(latestFrame.current.frame, latestFrame.current.playing)
    fit.current(); setReady(true)
   })
   map.on('load', () => { if (!disposed) setLoading(false) })
   map.on('error', () => { if (!disposed) { setLoading(false); setError('Some street detail could not load. Check your connection and retry.') } })
   resize = new ResizeObserver(() => map.resize())
   resize.observe(element)
  }).catch(() => { if (!disposed) setFallback(true) })
  return () => { disposed = true; removeWheel?.(); resize?.disconnect(); instance?.remove(); drawPoints.current = () => {}; renderFrame.current = () => {}; fit.current = () => {} }
 }, [visible, hasPoints, retry, fallback])
 if (!hasPoints) return <p className="walk-empty">No GPS route recorded. Time-only walks are still included in summaries.</p>
 if (fallback) return <OpenStreetRouteMap points={points} compact={compact}/>
 return <figure className={`walk-route-map walk-vector-map${compact ? ' compact' : ''}`}>
  <div ref={host} className="walk-map-canvas" role="region" aria-label="Recorded walking route map. Pinch to zoom; normal scrolling leaves the map unchanged."/>
  <span className="walk-map-north" aria-hidden="true">N ↑</span>
  {visible && loading && <p className="walk-map-status" role="status">Loading street map…</p>}
  {error && <p className="walk-map-status" role="alert">{error} <Button className="secondary" onClick={() => setRetry(value => value + 1)}>Retry map</Button></p>}
  <RouteMapControls playing={replay.playing} disabled={!ready || !replay.canReplay} status={replay.status} onFit={() => fit.current()} onReplay={() => { if (!replay.playing) fit.current(); replay.toggle() }}/>
  <div ref={credits} className="walk-map-credits" aria-label="Map credits"/>
 </figure>
}
