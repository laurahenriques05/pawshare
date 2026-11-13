import { Syringe, Pill, FolderHeart, Stethoscope, Phone, Activity, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AppointmentCalendar } from './AppointmentCalendar'
import { useEffect, useState } from 'react'
import { Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { VetAppointment, Vaccination } from '../../lib/supabase/database.types'
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
 const [vaccinations,setVaccinations]=useState<Vaccination[]>([]),[vaccineError,setVaccineError]=useState('')
 const [deleting,setDeleting]=useState<VetAppointment|null>(null),[deleteError,setDeleteError]=useState(''),[deleted,setDeleted]=useState(false)
 const [editing,setEditing]=useState<VetAppointment|null>(null), [title,setTitle]=useState(''), [time,setTime]=useState(''), [location,setLocation]=useState(''), [notes,setNotes]=useState(''), [saving,setSaving]=useState(false), [saveError,setSaveError]=useState(''), [saved,setSaved]=useState(false)
 useEffect(()=>{let active=true;setLoading(true);setError('');setRows([]);setVaccinations([]);setVaccineError('')
 async function load(){try{
 const member=await db().from('households').select('id').eq('id',id).maybeSingle()
 if(member.error) throw member.error
 if(!member.data) throw new Error('Access denied. You are no longer a member of this family.')
 const result=await db().from('vet_appointments').select('*').eq('household_id',id).order('starts_at')
 if(result.error) throw result.error
 if(active)setRows(result.data)
 const vaccines=await db().from('vaccinations').select('*').eq('household_id',id).not('next_due_on','is',null)
 if(active){if(vaccines.error)setVaccineError(vaccines.error.message);else setVaccinations(vaccines.data)}
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
 async function removeAppointment(){if(!deleting)return;setSaving(true);setDeleteError('');setSaved(false);setDeleted(false)
 try{const result=await db().from('vet_appointments').delete().eq('household_id',id).eq('id',deleting.id).select('id').single();if(result.error)throw result.error
 if(editing?.id===deleting.id){reset();setFormOpen(false)}setDeleting(null);setDeleted(true);setRetry(v=>v+1)
 }catch(e){setDeleteError(errorMessage(e))}finally{setSaving(false)}}
 return <div className="walk-page vet-page"><PageTitle eyebrow="HEALTH" title="Health">Your dog’s care, records and appointments, together in one place.</PageTitle>
 <nav className="health-sections" aria-label="Health features">{[
 {path:'vaccinations',title:'Vaccinations',description:'Records and next due dates',icon:Syringe},
 {path:'medications',title:'Medications',description:'Schedules and dose logs',icon:Pill},
 {path:'treatments',title:'Treatments',description:'Past care and treatment notes',icon:Stethoscope},
 {path:'weight',title:'Weight',description:'Measurements and trends',icon:Activity},
 {path:'documents',title:'Documents',description:'Prescriptions and health files',icon:FolderHeart},
 {path:'contacts',title:'Vet contacts',description:'Your veterinary care team',icon:Phone},
 ].map(item=><Link className="card health-section-link" key={item.path} to={`/health/${item.path}`}><item.icon size={22} aria-hidden="true"/><div><h2>{item.title}</h2><p>{item.description}</p></div><ArrowUpRight size={17} aria-hidden="true"/></Link>)}</nav>
 <header className="health-calendar-heading"><div><h2>Care calendar</h2><p className="muted">Keep upcoming vet visits and vaccination dates in view.</p></div></header>
 {vaccineError&&<div><Notice error>Vaccination dates could not be loaded: {vaccineError}</Notice><Button onClick={()=>setRetry(v=>v+1)}>Retry calendar</Button></div>}
 <AppointmentCalendar vaccinations={vaccinations} month={month} selected={selected} today={today} rows={rows} zone={zone} loading={loading||!!error} onEdit={row=>{setFormOpen(true);setEditing(row);setTitle(row.title);setTime(localTime(row.starts_at,zone));setLocation(row.location);setNotes(row.notes);setSaved(false);setSaveError('')}} onMonth={setMonth} onSelect={day=>{setSelected(day);setSaved(false)}} onAdd={()=>{reset();setTime(selected+'T09:00');setFormOpen(true);setSaved(false)}}/>
 {deleted&&<Notice>Appointment deleted.</Notice>}
 {deleting&&<section className="card" aria-label="Confirm appointment deletion"><h2>Delete {deleting.title}?</h2><p>{localTime(deleting.starts_at,zone).replace('T',' · ')}</p><p>This permanently removes the appointment for everyone in your family. This cannot be undone.</p>{deleteError&&<Notice error>{deleteError}</Notice>}<div className="walk-actions"><Button disabled={saving} onClick={()=>void removeAppointment()}>{saving?'Deleting…':'Confirm deletion'}</Button><Button disabled={saving} className="secondary" onClick={()=>{setDeleting(null);setDeleteError('')}}>Keep appointment</Button></div></section>}
 {saved&&<Notice>Appointment saved.</Notice>}
 {formOpen&&<section className="card"><h2>{editing?'Edit veterinary appointment':'New veterinary appointment'}</h2><form onSubmit={save}><fieldset disabled={saving} className="vet-fields"><Field label="Title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/><Field label="Date and time" type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)}/><Field label="Vet / location" maxLength={200} value={location} onChange={e=>setLocation(e.target.value)}/><Field label="Notes" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/>{saveError&&<Notice error>{saveError} Please check your access and try saving again.</Notice>}<div className="walk-actions"><Button type="submit">{saving?'Saving…':'Save appointment'}</Button><Button type="button" className="secondary" onClick={()=>{reset();setFormOpen(false)}}>Cancel</Button>{editing&&<Button type="button" className="secondary" onClick={()=>{setDeleting(editing);setDeleteError('')}}>Delete appointment</Button>}</div></fieldset></form>{saved&&<Notice>Appointment saved.</Notice>}</section>}
 {vaccinations.some(record=>record.next_due_on===selected)&&<section className="card"><h2>Vaccinations due · {selected}</h2><ul className="walk-history">{vaccinations.filter(record=>record.next_due_on===selected).map(record=><li key={record.id}><Link to={`/health/vaccinations?record=${encodeURIComponent(record.id)}`}>{record.name} · View vaccination record →</Link></li>)}</ul></section>}
 <section className="card"><h2>Appointments · {selected}</h2>{loading?<p role="status">Loading appointments…</p>:error?<><Notice error>{error}</Notice><Button onClick={()=>setRetry(v=>v+1)}>Try again</Button></>:rows.filter(row=>localTime(row.starts_at,zone).startsWith(selected)).length===0?<p>No appointments on this day. Select + in the calendar to add one.</p>:<ul className="walk-history">{rows.filter(row=>localTime(row.starts_at,zone).startsWith(selected)).map(row=><li key={row.id}><h3>{row.title}</h3><p><time dateTime={row.starts_at}>{localTime(row.starts_at,zone).replace('T',' · ')}</time></p>{row.location&&<p>{row.location}</p>}{row.notes&&<p className="walk-notes">{row.notes}</p>}<Button className="secondary" onClick={()=>{setFormOpen(true);setEditing(row);setTitle(row.title);setTime(localTime(row.starts_at,zone));setLocation(row.location);setNotes(row.notes);setSaved(false);setSaveError('');window.scrollTo({top:0})}}>Edit {row.title}</Button><Button className="secondary" disabled={saving} onClick={()=>{setDeleting(row);setDeleteError('');setDeleted(false);window.scrollTo({top:0})}}>Delete {row.title}</Button></li>)}</ul>}</section></div>
}
