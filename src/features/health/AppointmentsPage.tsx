import { Link } from 'react-router-dom'
import { AppointmentCalendar } from './AppointmentCalendar'
import { useEffect, useState } from 'react'
import { Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { VetAppointment } from '../../lib/supabase/database.types'
import { useHousehold } from '../household/HouseholdProvider'
import { localTime, toInstant } from './time'
export function AppointmentsPage() {
 const { household, membership } = useHousehold()
 return household && membership ? <Appointments key={household.id} id={household.id} zone={household.timezone}/> : <Notice error>Access denied. Current family membership is required.</Notice>
}
function Appointments({ id, zone }: { id: string; zone: string }) {
 const today=localTime(new Date().toISOString(),zone).slice(0,10)
 const [selected,setSelected]=useState(today), [month,setMonth]=useState(today.slice(0,7)), [formOpen,setFormOpen]=useState(false)
 const [rows,setRows]=useState<VetAppointment[]>([]), [loading,setLoading]=useState(true), [error,setError]=useState(''), [retry,setRetry]=useState(0)
 const [editing,setEditing]=useState<VetAppointment|null>(null), [title,setTitle]=useState(''), [time,setTime]=useState(''), [location,setLocation]=useState(''), [notes,setNotes]=useState(''), [saving,setSaving]=useState(false), [saveError,setSaveError]=useState(''), [saved,setSaved]=useState(false)
 useEffect(()=>{let active=true;setLoading(true);setError('');setRows([])
 async function load(){try{
 const member=await db().from('households').select('id').eq('id',id).maybeSingle()
 if(member.error) throw member.error
 if(!member.data) throw new Error('Access denied. You are no longer a member of this family.')
 const result=await db().from('vet_appointments').select('*').eq('household_id',id).order('starts_at')
 if(result.error) throw result.error
 if(active)setRows(result.data)
 }catch(e){if(active)setError(errorMessage(e))}finally{if(active)setLoading(false)}}
 void load();return()=>{active=false}
 },[id,retry])
 function reset(){setEditing(null);setTitle('');setTime('');setLocation('');setNotes('');setSaveError('')}
 async function save(event:React.FormEvent){event.preventDefault();setSaving(true);setSaveError('');setSaved(false)
 try{if(!title.trim()||title.trim().length>120)throw new Error('Enter a title of 1–120 characters.')
 const values={title:title.trim(),starts_at:toInstant(time,zone),location:location.trim(),notes:notes.trim()}
 const result=editing ? await db().from('vet_appointments').update(values).eq('household_id',id).eq('id',editing.id).select().single() : await db().from('vet_appointments').insert({...values,household_id:id}).select().single()
 if(result.error)throw result.error
 setSelected(time.slice(0,10));setMonth(time.slice(0,7));reset();setFormOpen(false);setSaved(true);setRetry(v=>v+1)
 }catch(e){setSaveError(errorMessage(e))}finally{setSaving(false)}}
 return <div className="walk-page vet-page"><PageTitle eyebrow="HEALTH" title="Veterinary appointments">Shared care, in your family time zone: {zone}. Times use the 24-hour clock.</PageTitle>
 <Link className="button secondary" to="/health/vaccinations">Vaccination records</Link>
 <Link className="button secondary" to="/health/medications">Medication schedules &amp; dose logs</Link>
 <AppointmentCalendar month={month} selected={selected} today={today} rows={rows} zone={zone} loading={loading||!!error} onEdit={row=>{setFormOpen(true);setEditing(row);setTitle(row.title);setTime(localTime(row.starts_at,zone));setLocation(row.location);setNotes(row.notes);setSaved(false);setSaveError('')}} onMonth={setMonth} onSelect={day=>{setSelected(day);setSaved(false)}} onAdd={()=>{reset();setTime(selected+'T09:00');setFormOpen(true);setSaved(false)}}/>
 {saved&&<Notice>Appointment saved.</Notice>}
 {formOpen&&<section className="card"><h2>{editing?'Edit appointment':'New appointment'}</h2><form onSubmit={save}><fieldset disabled={saving} className="vet-fields"><Field label="Title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/><Field label={`Date and time (${zone})`} type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)}/><Field label="Vet / location" maxLength={200} value={location} onChange={e=>setLocation(e.target.value)}/><Field label="Notes" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/>{saveError&&<Notice error>{saveError} Please check your access and try saving again.</Notice>}<div className="walk-actions"><Button type="submit">{saving?'Saving…':'Save appointment'}</Button><Button type="button" className="secondary" onClick={()=>{reset();setFormOpen(false)}}>Cancel</Button></div></fieldset></form>{saved&&<Notice>Appointment saved.</Notice>}</section>}
 <section className="card"><h2>Appointments · {selected}</h2>{loading?<p role="status">Loading appointments…</p>:error?<><Notice error>{error}</Notice><Button onClick={()=>setRetry(v=>v+1)}>Try again</Button></>:rows.filter(row=>localTime(row.starts_at,zone).startsWith(selected)).length===0?<p>No appointments on this day. Select + in the calendar to add one.</p>:<ul className="walk-history">{rows.filter(row=>localTime(row.starts_at,zone).startsWith(selected)).map(row=><li key={row.id}><h3>{row.title}</h3><p><time dateTime={row.starts_at}>{localTime(row.starts_at,zone).replace('T',' · ')}</time> ({zone})</p>{row.location&&<p>{row.location}</p>}{row.notes&&<p className="walk-notes">{row.notes}</p>}<Button className="secondary" onClick={()=>{setFormOpen(true);setEditing(row);setTitle(row.title);setTime(localTime(row.starts_at,zone));setLocation(row.location);setNotes(row.notes);setSaved(false);setSaveError('');window.scrollTo({top:0})}}>Edit {row.title}</Button></li>)}</ul>}</section></div>
}
