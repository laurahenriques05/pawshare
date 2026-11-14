import { useEffect, useMemo, useRef, useState } from 'react'
import type { Point } from './gps'
import { buildReplayTrack, replayFrame } from './routeReplay'

export function useRouteReplay(points: Point[]) {
 const track = useMemo(() => buildReplayTrack(points), [points])
 const [progress, setProgress] = useState(1)
 const [playing, setPlaying] = useState(false)
 const [status, setStatus] = useState('')
 const frame = useMemo(() => replayFrame(track, progress), [track, progress])
 const request = useRef<number | null>(null)
 const cancel = () => { if (request.current !== null) cancelAnimationFrame(request.current); request.current = null }
 useEffect(() => {
  cancel(); setPlaying(false); setProgress(1); setStatus('')
  return cancel
 }, [track])
 function toggle() {
  cancel()
  if (playing) { setPlaying(false); setProgress(1); setStatus('Route reproduction stopped.'); return }
  if (!track.total) return
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setProgress(1); setStatus('Full route displayed.'); return }
  setPlaying(true); setProgress(0); setStatus('Reproducing the recorded route.')
  const start = performance.now()
  let lastPaint = -Infinity
  const tick = (now: number) => {
   const progress = Math.min(1, (now - start) / 12000)
   if (now - lastPaint >= 32 || progress === 1) { setProgress(progress); lastPaint = now }
   if (progress < 1) request.current = requestAnimationFrame(tick)
   else { request.current = null; setPlaying(false); setStatus('Route reproduced.') }
  }
  request.current = requestAnimationFrame(tick)
 }
 return { frame, playing, status, toggle, canReplay: track.total > 0 }
}
