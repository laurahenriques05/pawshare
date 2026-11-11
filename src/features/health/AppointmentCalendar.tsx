import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { VetAppointment } from '../../lib/supabase/database.types'
import { localTime } from './time'
export function monthDays(month: string) {
 const [year, number] = month.split('-').map(Number)
 const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
 const padding = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
 return { count, padding }
}
export function shiftMonth(month: string, step: number) {
 const [year, number] = month.split('-').map(Number)
 return new Date(Date.UTC(year, number - 1 + step, 1)).toISOString().slice(0, 7)
}
export function AppointmentCalendar({ month, selected, today, rows, zone, onMonth, onSelect, onAdd, onEdit, loading }: {
 month: string; selected: string; today: string; rows: VetAppointment[]; zone: string; loading: boolean
 onMonth: (month: string) => void; onSelect: (day: string) => void; onAdd: () => void; onEdit: (row: VetAppointment) => void
}) {
 const { count, padding } = monthDays(month)
 const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'))
 const counts = new Map<string, number>()
 for (const row of rows) { const day = localTime(row.starts_at, zone).slice(0, 10); counts.set(day, (counts.get(day) || 0) + 1) }
 return <section className="card vet-calendar" aria-label="Veterinary appointment calendar">
 <div className="vet-calendar-toolbar"><button type="button" className="vet-calendar-text" onClick={()=>{onMonth(today.slice(0,7));onSelect(today)}}>Today</button><button type="button" className="vet-calendar-add" aria-label="Add appointment on selected day" onClick={onAdd}><Plus size={24}/></button></div>
 <div className="vet-calendar-month"><button type="button" aria-label="Previous month" onClick={()=>onMonth(shiftMonth(month,-1))}><ChevronLeft/></button><h2 aria-live="polite">{label}</h2><button type="button" aria-label="Next month" onClick={()=>onMonth(shiftMonth(month,1))}><ChevronRight/></button></div>
 <div className="vet-calendar-scroll" tabIndex={0} aria-label="Month calendar, scroll horizontally on small screens"><div className="vet-calendar-grid">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span className="vet-weekday" key={day}>{day}</span>)}{Array.from({length:padding},(_,i)=><span key={`pad-${i}`}/>)}{Array.from({length:count},(_,i)=>{const day=`${month}-${String(i+1).padStart(2,'0')}`;const total=counts.get(day)||0;return <div key={day} className="vet-day-cell"><button type="button" aria-pressed={day===selected} aria-current={day===today?'date':undefined} aria-label={`${day}${loading?'':`, ${total} appointment${total===1?'':'s'}`}`} className={`vet-day ${day===selected?'selected':''} ${day===today?'today':''}`} onClick={()=>onSelect(day)}><span>{i+1}</span></button>{rows.filter(row=>localTime(row.starts_at,zone).startsWith(day)).map(row=><button key={row.id} type="button" className="vet-event" onClick={()=>{onSelect(day);onEdit(row)}} aria-label={`Edit ${row.title}, ${localTime(row.starts_at,zone).replace('T',' ')}`}><time dateTime={row.starts_at}>{localTime(row.starts_at,zone).slice(11)}</time><span>{row.title}</span></button>)}</div>})}</div></div>
 <p className="muted vet-calendar-zone">{zone} · Select a day, then + to add a visit.</p></section>
}
