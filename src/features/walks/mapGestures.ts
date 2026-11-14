/** Trackpad pinch reaches browsers as Ctrl+wheel; ordinary two-finger scrolling does not. */
export function createPinchZoomHandler(onZoom: (delta: number, event: WheelEvent) => void) {
 let accumulated = 0
 return (event: WheelEvent) => {
  if (!event.ctrlKey || !Number.isFinite(event.deltaY) || event.deltaY === 0) { accumulated = 0; return }
  event.preventDefault()
  event.stopPropagation()
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 800 : 1)
  if (Math.sign(pixels) !== Math.sign(accumulated)) accumulated = 0
  accumulated += pixels
  const steps = Math.trunc(accumulated / 24)
  if (steps) { accumulated -= steps * 24; onZoom(-steps * .25, event) }
 }
}
export const kilometersLabel = (meters: number) => (meters / 1000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
