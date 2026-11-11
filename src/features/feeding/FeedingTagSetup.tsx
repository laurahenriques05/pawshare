import { useEffect, useRef, useState } from 'react'
import { Button, Notice, errorMessage } from '../../components/ui'
import { appUrl } from '../../lib/supabase/client'

type TagWriter = { write: (message: { records: { recordType: 'url'; data: string }[] }, options: { signal: AbortSignal; overwrite: boolean }) => Promise<void> }
type NfcWindow = Window & { NDEFReader?: new () => TagWriter }

export function FeedingTagSetup({ householdId }: { householdId: string }) {
 const writerClass = (window as NfcWindow).NDEFReader
 const supported = window.isSecureContext && !!writerClass
 const controller = useRef<AbortController | null>(null)
 const [busy, setBusy] = useState(false)
 const [replace, setReplace] = useState(false)
 const [message, setMessage] = useState('')
 const [error, setError] = useState('')
 useEffect(() => () => { controller.current?.abort() }, [])
 async function writeTag() {
  if (!writerClass || !supported || controller.current) return
  const operation = new AbortController()
  controller.current = operation
  setBusy(true); setMessage('Hold a writable NFC tag against your phone and keep PawShare open.'); setError('')
  const timeout = window.setTimeout(() => operation.abort(), 60000)
  try {
   await new writerClass().write({ records: [{ recordType: 'url', data: `${appUrl}/feed?quick=1&household=${householdId}` }] }, { signal: operation.signal, overwrite: replace })
   if (!operation.signal.aborted) setMessage('Feeding tag written. Move it away, then tap it again to test quick feeding. No meal has been recorded.')
  } catch (error) {
   if (operation.signal.aborted) setMessage('Tag setup stopped. Tap “Set up feeding tag” to try again.')
   else { setMessage(''); setError(`${errorMessage(error)} Check NFC is enabled, allow the browser’s NFC permission, and use a writable NDEF tag. If it already contains data, explicitly enable replacement below.`) }
  } finally {
   window.clearTimeout(timeout)
   if (controller.current === operation) { controller.current = null; setBusy(false) }
  }
 }
 return <section className="card feeding-routine"><h2>Set up your feeding NFC tag</h2>
  {supported ? <><p className="muted">Set up the tag here in PawShare. Turn on NFC, tap the button, allow access, and hold a writable NFC tag against your phone.</p><label className="feeding-check"><input type="checkbox" checked={replace} disabled={busy} onChange={event => setReplace(event.target.checked)}/>Replace an existing tag’s contents with this household’s feeding action.</label><div className="feeding-actions"><Button type="button" disabled={busy} onClick={() => void writeTag()}>{busy ? 'Waiting for your tag…' : 'Set up feeding tag'}</Button>{busy && <Button type="button" className="secondary" onClick={() => controller.current?.abort()}>Cancel</Button>}</div></> : <Notice>This browser cannot write NFC tags. In-app tag setup is supported in compatible Chrome browsers on NFC-enabled Android phones. Writing a tag on iPhone requires a native PawShare app; adding this website to the Home Screen does not enable tag writing.</Notice>}
  {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
  <p className="photo-hint">A configured tag opens quick feeding and still asks you to confirm the meal. Tag setup never records food, and tags are not permanently locked. Once configured, a supported iPhone can open its website link without a separate NFC app. If sign-in interrupts the action, tap again after signing in.</p>
 </section>
}
