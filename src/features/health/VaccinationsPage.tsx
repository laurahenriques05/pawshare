import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Field, Notice, PageTitle, errorMessage } from '../../components/ui'
import { useHousehold } from '../household/HouseholdProvider'
import { db } from '../../lib/supabase/client'
import type { Vaccination } from '../../lib/supabase/database.types'
import { localTime } from './time'
import { vaccinationDates, vaccinationStatus } from './vaccinations'
export function VaccinationsPage(){const {household,membership}=useHousehold();return household&&membership?<Records key={household.id} home={household.id} zone={household.timezone}/>:<Notice error>Family access denied.</Notice>}
function Records({home,zone}:{home:string;zone:string}){
 const [rows,setRows]=useState<Vaccination[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState(''),[saved,setSaved]=useState(false)
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState(''),[given,setGiven]=useState(''),[due,setDue]=useState(''),[vet,setVet]=useState(''),[batch,setBatch]=useState(''),[notes,setNotes]=useState('')
 const [,tick]=useState(0);useEffect(()=>{const timer=setInterval(()=>tick(v=>v+1),60000);return()=>clearInterval(timer)},[])
 const today=localTime(new Date().toISOString(),zone).slice(0,10)
 useEffect(()=>{let live=true;setLoading(true);setError('');setRows([]);void(async()=>{try{
 const member=await db().from('households').select('id').eq('id',home).maybeSingle();if(member.error)throw member.error;if(!member.data)throw new Error('Family access denied.')
 const result=await db().from('vaccinations').select('*').eq('household_id',home).order('given_on',{ascending:false}).order('created_at',{ascending:false});if(result.error)throw result.error;if(live)setRows(result.data)
 }catch(e){if(live)setError(errorMessage(e))}finally{if(live)setLoading(false)}})();return()=>{live=false}},[home,retry])
 function reset(){setEditing(null);setName('');setGiven('');setDue('');setVet('');setBatch('');setNotes('');setSaveError('')}
 async function save(event:React.FormEvent){event.preventDefault();setSaving(true);setSaveError('');setSaved(false);try{
 vaccinationDates(given,due,today);if(!name.trim())throw new Error('Enter the vaccine name.')
 const values={name:name.trim(),given_on:given,next_due_on:due||null,veterinarian:vet.trim(),batch_number:batch.trim(),notes:notes.trim()}
 const result=editing?await db().from('vaccinations').update(values).eq('id',editing).eq('household_id',home).select().single():await db().from('vaccinations').insert({...values,household_id:home}).select().single();if(result.error)throw result.error
 reset();setSaved(true);setRetry(v=>v+1)
 }catch(e){setSaveError(errorMessage(e))}finally{setSaving(false)}}
 return <div className="walk-page"><PageTitle eyebrow="HEALTH" title="Vaccination records">Shared vaccination history and next due dates · {zone}.</PageTitle><Link to="/health">← Health calendar</Link><section className="card" id="vaccination-form"><h2>{editing?'Edit vaccination':'Add vaccination'}</h2><p className="muted">Record a vaccination already given. Enter the next date supplied by your veterinarian; PawShare does not calculate it.</p><form onSubmit={save}><fieldset className="vet-fields" disabled={saving}><Field label="Vaccine name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/><Field label="Date given" type="date" required max={today} value={given} onChange={e=>setGiven(e.target.value)}/><Field label="Next due date (optional)" type="date" value={due} onChange={e=>setDue(e.target.value)}/><Field label="Veterinarian / clinic (optional)" maxLength={200} value={vet} onChange={e=>setVet(e.target.value)}/><Field label="Batch number (optional)" maxLength={120} value={batch} onChange={e=>setBatch(e.target.value)}/><Field label="Notes (optional)" maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/>{saveError&&<Notice error>{saveError}</Notice>}<div className="walk-actions"><Button>{saving?'Saving…':'Save vaccination'}</Button>{editing&&<Button type="button" className="secondary" onClick={reset}>Cancel</Button>}</div></fieldset></form>{saved&&<Notice>Vaccination saved.</Notice>}</section>
 <section className="card"><h2>Vaccination history</h2>{loading?<p role="status">Loading vaccinations…</p>:error?<><Notice error>{error}</Notice><Button onClick={()=>setRetry(v=>v+1)}>Try again</Button></>:rows.length===0?<p>No vaccination records yet.</p>:<ul className="walk-history">{rows.map(row=><li key={row.id}><h3>{row.name}</h3><p>Given: <time dateTime={row.given_on}>{row.given_on}</time></p><p>{vaccinationStatus(row.next_due_on,today)}{row.next_due_on&&<> · Next due: <time dateTime={row.next_due_on}>{row.next_due_on}</time></>}</p>{row.veterinarian&&<p>Veterinarian: {row.veterinarian}</p>}{row.batch_number&&<p>Batch: {row.batch_number}</p>}{row.notes&&<p className="walk-notes">{row.notes}</p>}<Button disabled={saving} className="secondary" onClick={()=>{setEditing(row.id);setName(row.name);setGiven(row.given_on);setDue(row.next_due_on||'');setVet(row.veterinarian);setBatch(row.batch_number);setNotes(row.notes);setSaveError('');setSaved(false);document.getElementById('vaccination-form')?.scrollIntoView({behavior:'smooth'})}}>Edit {row.name}</Button></li>)}</ul>}</section></div>
}
