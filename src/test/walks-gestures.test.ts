import { describe, expect, it, vi } from 'vitest'
import { createPinchZoomHandler, kilometersLabel } from '../features/walks/mapGestures'
function wheel(deltaY: number, ctrlKey = false, deltaMode = 0) {
 return {deltaY,ctrlKey,deltaMode,preventDefault:vi.fn(),stopPropagation:vi.fn()} as unknown as WheelEvent
}
describe('deliberate trackpad pinch versus normal page scrolling', () => {
 it('does not zoom or intercept ordinary wheel/two-finger scrolling', () => {
  const zoom=vi.fn(),handler=createPinchZoomHandler(zoom)
  for (const delta of [-400,-24,24,400]) {
   const event=wheel(delta)
   handler(event)
   expect(event.preventDefault).not.toHaveBeenCalled()
   expect(event.stopPropagation).not.toHaveBeenCalled()
  }
  expect(zoom).not.toHaveBeenCalled()
 })
 it('zooms both directions only for the Ctrl+wheel signal used by trackpad pinch', () => {
  const zoom=vi.fn(),handler=createPinchZoomHandler(zoom)
  const inward=wheel(-48,true),outward=wheel(24,true)
  handler(inward);handler(outward)
  expect(zoom).toHaveBeenNthCalledWith(1,.5,inward)
  expect(zoom).toHaveBeenNthCalledWith(2,-.25,outward)
  expect(inward.preventDefault).toHaveBeenCalledOnce()
  expect(outward.preventDefault).toHaveBeenCalledOnce()
 })
 it('accumulates small pinch events and resets when the gesture reverses or scrolling resumes', () => {
  const zoom=vi.fn(),handler=createPinchZoomHandler(zoom)
  handler(wheel(-12,true));expect(zoom).not.toHaveBeenCalled()
  handler(wheel(-12,true));expect(zoom.mock.calls[0][0]).toBe(.25)
  handler(wheel(-20,true));handler(wheel(10,true));expect(zoom).toHaveBeenCalledOnce()
  handler(wheel(100));handler(wheel(14,true));expect(zoom).toHaveBeenCalledOnce()
  handler(wheel(10,true));expect(zoom.mock.calls[1][0]).toBe(-.25)
 })
 it('handles line/page units and ignores zero or invalid deltas', () => {
  const zoom=vi.fn(),handler=createPinchZoomHandler(zoom)
  handler(wheel(0,true));handler(wheel(NaN,true));expect(zoom).not.toHaveBeenCalled()
  handler(wheel(3,true,1));expect(zoom.mock.calls[0][0]).toBe(-.5)
 })
})
describe('walk distance in kilometres', () => {
 it('converts metres only for display and keeps two decimals', () => {
  expect(kilometersLabel(8320)).toMatch(/^8[.,]32$/)
  expect(kilometersLabel(1730)).toMatch(/^1[.,]73$/)
  expect(kilometersLabel(0)).toMatch(/^0[.,]00$/)
  expect(kilometersLabel(80)).toMatch(/^0[.,]08$/)
 })
})
