import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
vi.mock('@googlemaps/js-api-loader', () => ({ importLibrary: vi.fn(), setOptions: vi.fn() }))
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal('window',new EventTarget()) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('official Google Maps loader (isolated, no network)', () => {
 it('does not load Google or issue requests without a configured key', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY','')
  const loader = await import('../features/walks/googleMaps')
  expect(loader.googleMapsConfigured()).toBe(false)
  await expect(loader.loadGoogleMaps()).rejects.toThrow('not configured')
  expect(importLibrary).not.toHaveBeenCalled()
  expect(setOptions).not.toHaveBeenCalled()
 })
 it('shares one library request across every map and uses an origin-only auth referrer', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY','test-public-browser-key')
  vi.mocked(importLibrary).mockResolvedValue({} as never)
  const loader = await import('../features/walks/googleMaps')
  expect(loader.googleMapsConfigured()).toBe(true)
  const first = loader.loadGoogleMaps(),second = loader.loadGoogleMaps()
  expect(first).toBe(second)
  await first
  expect(setOptions).toHaveBeenCalledExactlyOnceWith({key:'test-public-browser-key',v:'quarterly',authReferrerPolicy:'origin'})
  expect(importLibrary).toHaveBeenCalledTimes(2)
  expect(importLibrary).toHaveBeenCalledWith('maps')
  expect(importLibrary).toHaveBeenCalledWith('core')
 })
 it('allows retry after a failed library load and exposes auth failure to mounted maps', async () => {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY','test-public-browser-key')
  vi.mocked(importLibrary).mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValue({} as never)
  const loader = await import('../features/walks/googleMaps')
  await expect(loader.loadGoogleMaps()).rejects.toThrow('network unavailable')
  await expect(loader.loadGoogleMaps()).resolves.toBeDefined()
  expect(importLibrary).toHaveBeenCalledTimes(4)
  const onError = vi.fn()
  window.addEventListener(loader.GOOGLE_MAP_ERROR,onError)
  const failure = (window as Window & {gm_authFailure?:()=>void}).gm_authFailure
  expect(failure).toBeTypeOf('function')
  failure!()
  expect(onError).toHaveBeenCalledOnce()
 })
})
