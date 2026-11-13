import { useRef, useState, type ReactNode } from 'react'
import type { MedicationDose } from '../../lib/supabase/database.types'

export function MedicationProgress({ doses, name, zone, busy, onTake, renderDose }: {
 doses: MedicationDose[]; name: string; zone: string; busy: boolean;
 onTake: (dose: MedicationDose) => Promise<void>; renderDose: (dose: MedicationDose) => ReactNode
}) {
 const [selected, setSelected] = useState<string | null>(null)
 const [saving, setSaving] = useState<string | null>(null)
 const inFlight = useRef(false)
 const given = doses.filter(dose => dose.status === 'given').length
 const progress = doses.length ? given / doses.length * 100 : 0
 const date = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'short' })
 const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
 const full = new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
 async function take(dose: MedicationDose) {
  if (busy || inFlight.current) return
  if (dose.status !== 'scheduled' || dose.recorded_at) { setSelected(dose.id); return }
  inFlight.current = true; setSaving(dose.id)
  try { await onTake(dose) } finally { inFlight.current = false; setSaving(null) }
 }
 const selectedDose = doses.find(dose => dose.id === selected)
 return <div className="medication-timeline">
  <div className="medication-progress medication-tracker-summary">
   <div className="medication-wheel" role="progressbar" aria-label={`${name}: doses given`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`${given} of ${doses.length} doses given`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle className="medication-wheel-track" cx="60" cy="60" r="51"/><circle className="medication-wheel-fill" cx="60" cy="60" r="51" pathLength="100" strokeDasharray={`${progress} 100`}/></svg>
    <span><strong>{Math.round(progress)}%</strong><small>given</small></span>
   </div>
   <div className="medication-summary-copy"><p className="eyebrow">Treatment progress</p><h3>{given} of {doses.length} doses given</h3>
   <p className="muted">Tap each scheduled day and time to confirm you have given the medication.</p></div>
  </div>
  {doses.length ? <ul className="dose-bubbles" aria-label={`${name} scheduled doses`}>
   {doses.map(dose => {
    const when = new Date(dose.scheduled_at)
    const state = dose.status === 'given' ? 'Given' : dose.status === 'skipped' ? 'Skipped' : Date.parse(dose.scheduled_at) < Date.now() ? 'Overdue' : 'Scheduled'
    return <li key={dose.id} className={dose.status === 'given' ? 'dose-step is-given' : 'dose-step'}>
     <button type="button" className={`dose-bubble ${dose.status === 'given' ? 'is-given' : ''}`} disabled={busy || saving !== null}
      aria-label={`${name}, ${full.format(when)}, ${state}. ${dose.status === 'scheduled' && !dose.recorded_at ? 'Confirm taken' : 'View record'}`}
      aria-busy={saving === dose.id} onClick={() => void take(dose)}>
      <span className="dose-bubble-day">{date.format(when)}</span><strong>{time.format(when)}</strong>
      <span className="dose-bubble-mark" aria-hidden="true">{saving === dose.id ? '…' : dose.status === 'given' ? '✓' : dose.status === 'skipped' ? '−' : '○'}</span>
     </button>
     <small>{saving === dose.id ? 'Saving…' : state}</small>
     <button type="button" className="dose-detail-link" aria-expanded={selected === dose.id} onClick={() => setSelected(selected === dose.id ? null : dose.id)}>Details</button>
    </li>
   })}
  </ul> : <p className="muted">No doses scheduled yet.</p>}
  {selectedDose && <ul className="walk-history health-record-list">{renderDose(selectedDose)}</ul>}
 </div>
}
