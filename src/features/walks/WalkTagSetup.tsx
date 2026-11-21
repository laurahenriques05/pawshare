import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Copy, Nfc, Smartphone } from 'lucide-react'
import { Button, Notice, errorMessage } from '../../components/ui'
import { collarTagUrl } from './nfc'
import { appUrl } from '../../lib/supabase/client'

type TagWriter = { write: (message: { records: { recordType: 'url'; data: string }[] }, options: { signal: AbortSignal; overwrite: boolean }) => Promise<void> }
type NfcWindow = Window & { NDEFReader?: new () => TagWriter }

export function WalkTagSetup({ householdId }: { householdId: string }) {
 const writerClass = (window as NfcWindow).NDEFReader
 const supported = window.isSecureContext && !!writerClass
 const controller = useRef<AbortController | null>(null)
 const [busy, setBusy] = useState(false)
 const [replace, setReplace] = useState(false)
 const [message, setMessage] = useState('')
 const [error, setError] = useState('')
 const walkUrl = collarTagUrl(appUrl, householdId)
 useEffect(() => () => { controller.current?.abort() }, [])
 async function writeTag() {
  if (!writerClass || !supported || controller.current) return
  const operation = new AbortController()
  controller.current = operation
  setBusy(true); setMessage('Hold a writable NFC tag against your phone and keep PawShare open.'); setError('')
  const timeout = window.setTimeout(() => operation.abort(), 60000)
  try {
   await new writerClass().write({ records: [{ recordType: 'url', data: walkUrl }] }, { signal: operation.signal, overwrite: replace })
   if (!operation.signal.aborted) setMessage('Walk tag written. Move it away, then tap it again to open Start walk setup. No walk has been started.')
  } catch (error) {
   if (operation.signal.aborted) setMessage('Tag setup stopped. Tap “Set up collar tag” to try again.')
   else { setMessage(''); setError(`${errorMessage(error)} Check NFC is enabled, allow the browser’s NFC permission, and use a writable NDEF tag. If it already contains data, explicitly enable replacement below.`) }
  } finally {
   window.clearTimeout(timeout)
   if (controller.current === operation) { controller.current = null; setBusy(false) }
  }
 }
 async function copyTagLink() {
  setError('')
  try {
   await navigator.clipboard.writeText(walkUrl)
   setMessage('NFC link copied. In NFC Tools, choose Write → Add a record → Custom URL/URI, paste it, then tap Write.')
  } catch {
   setMessage('Copy the link below, then paste it into a Custom URL/URI record in NFC Tools.')
  }
 }
 return <section className="card feeding-routine feeding-tag-setup walk-tag-setup"><h2>Set up your walking NFC tag</h2>
  <div className="feeding-tag-guide" aria-labelledby="walk-tag-guide-title"><h3 id="walk-tag-guide-title">Three simple steps</h3><ol>
   <li><span><Copy aria-hidden="true"/></span><div><strong>{supported?'Start setup':'Copy the PawShare link'}</strong><small>{supported?'Tap “Set up collar tag” below.':'Use the button below.'}</small></div></li>
   <li><span><Nfc aria-hidden="true"/></span><div><strong>{supported?'Hold the tag to your phone':'Write it with NFC Tools'}</strong><small>{supported?'Keep it still until PawShare confirms.':'Write → Add a record → Custom URL/URI → paste → Write.'}</small></div></li>
   <li><span><Smartphone aria-hidden="true"/></span><div><strong>Tap before your walk</strong><small>Choose your options, then confirm the start.</small></div><CheckCircle2 className="feeding-tag-done" aria-hidden="true"/></li>
  </ol></div>
  {supported ? <><label className="feeding-check"><input type="checkbox" checked={replace} disabled={busy} onChange={event => setReplace(event.target.checked)}/>Replace an existing tag’s contents with this household’s walking action.</label><div className="feeding-actions"><Button type="button" disabled={busy} onClick={() => void writeTag()}>{busy ? 'Waiting for your tag…' : 'Set up collar tag'}</Button>{busy && <Button type="button" className="secondary" onClick={() => controller.current?.abort()}>Cancel</Button>}</div></> : <Notice>Your browser cannot write the tag directly. Use NFC Tools once with the button below.</Notice>}
  {!supported && <div className="feeding-actions"><Button type="button" onClick={() => void copyTagLink()}>Copy link for NFC Tools</Button></div>}
  {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
  {!supported && message.startsWith('Copy the link below') && <code className="walk-url">{walkUrl}</code>}
  <p className="feeding-tag-safety"><CheckCircle2 aria-hidden="true"/>Tapping opens Start walk setup. Nothing is recorded until you confirm.</p>
 </section>
}
