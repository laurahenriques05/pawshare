/// <reference types="google.maps" />
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
export const googleMapsConfigured = () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim())
type Libraries = { maps: google.maps.MapsLibrary; core: google.maps.CoreLibrary }
let pending: Promise<Libraries> | undefined
let configured = false
export const GOOGLE_MAP_ERROR = 'pawshare:google-map-error'

/** Shared official loader; no key means no Google request and no map-load charges. */
export function loadGoogleMaps(): Promise<Libraries> {
 const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim()
 if (!key) return Promise.reject(new Error('Google Maps is not configured.'))
 if (!configured) {
  const host = window as Window & { gm_authFailure?: () => void }
  host.gm_authFailure = () => window.dispatchEvent(new Event(GOOGLE_MAP_ERROR))
  setOptions({ key, v: 'quarterly', authReferrerPolicy: 'origin' })
  configured = true
 }
 if (!pending) {
  pending = Promise.all([importLibrary('maps'), importLibrary('core')])
   .then(([maps, core]) => ({ maps, core }))
   .catch(error => { pending = undefined; throw error })
 }
 return pending
}
