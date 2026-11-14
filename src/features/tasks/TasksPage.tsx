import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, ListChecks, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button, Field, Notice, PageTitle, errorMessage, isSchemaUnavailable } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { FamilyMember, TaskOccurrence, TaskSeries } from '../../lib/supabase/database.types'
import { localTime, toInstant } from '../health/time'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { recurrenceLabel, taskStatus } from './model'

type OccurrenceWithTask = TaskOccurrence & { task:TaskSeries }
const emptyForm={title:'',details:'',assignedTo:'',firstDue:'',recurrence:'none' as TaskSeries['recurrence'],every:1,endsOn:''}
export function TasksPage(){
 const {household}=useHousehold();const {session}=useAuth();const [search]=useSearchParams()
 const [series,setSeries]=useState<TaskSeries[]>([]),[occurrences,setOccurrences]=useState<TaskOccurrence[]>([]),[members,setMembers]=useState<FamilyMember[]>([])
 const [form,setForm]=useState(emptyForm),[editing,setEditing]=useState<string|null>(null),[archive,setArchive]=useState<TaskSeries|null>(null)
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0)
 const load=useCallback(async()=>{
  if(!household)return
  setLoading(true);setError('')
  try{
   const now=Date.now(),from=new Date(now-90*86400000).toISOString(),until=new Date(now+180*86400000).toISOString()
   const generated=await db().rpc('generate_task_occurrences',{p_household:household.id,p_from:from,p_until:until});if(generated.error)throw generated.error
   const [s,o,m]=await Promise.all([
    db().from('task_series').select('*').eq('household_id',household.id).is('archived_at',null).order('first_due_at'),
    db().from('task_occurrences').select('*').eq('household_id',household.id).gte('due_at',from).lte('due_at',until).order('due_at'),
    db().rpc('get_household_members',{p_household:household.id}),
   ])
   if(s.error)throw s.error;if(o.error)throw o.error;if(m.error)throw m.error
   setSeries(s.data||[]);setOccurrences(o.data||[]);setMembers(m.data||[])
  }catch(e){setError(errorMessage(e))}finally{setLoading(false)}
 },[household?.id])
 useEffect(()=>{void load()},[load,retry])
 const names=useMemo(()=>new Map(members.map(member=>[member.user_id,member.display_name])),[members])
 const byId=useMemo(()=>new Map(series.map(task=>[task.id,task])),[series])
 const rows=useMemo<OccurrenceWithTask[]>(()=>occurrences.flatMap(occurrence=>{const task=byId.get(occurrence.series_id);return task?[{...occurrence,task}]:[]}),[occurrences,byId])
 const focusId=search.get('occurrence')
 useEffect(()=>{if(!loading&&focusId)document.getElementById(`task-${focusId}`)?.scrollIntoView({block:'center',behavior:'smooth'})},[loading,focusId,rows.length])
 function startEdit(task?:TaskSeries){
  if(task){setEditing(task.id);setForm({title:task.title,details:task.details,assignedTo:task.assigned_to||'',firstDue:localTime(task.first_due_at,household!.timezone),recurrence:task.recurrence,every:task.recurrence_every,endsOn:task.ends_on||''})}
  else{setEditing(null);setForm({...emptyForm,firstDue:localTime(new Date(Date.now()+3600000).toISOString(),household!.timezone)})}
  setError('');setMessage('')
 }
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!household)return;setBusy(true);setError('');setMessage('')
  try{
   const result=await db().rpc('save_household_task',{p_household:household.id,p_id:editing,p_title:form.title,p_details:form.details,p_assigned_to:form.assignedTo||null,p_first_due_at:toInstant(form.firstDue,household.timezone),p_recurrence:form.recurrence,p_recurrence_every:form.recurrence==='none'?1:form.every,p_ends_on:form.recurrence==='none'||!form.endsOn?null:form.endsOn})
   if(result.error)throw result.error
   setForm(emptyForm);setEditing(null);setMessage(editing?'Task updated. Open future occurrences use the updated schedule.':'Task saved. Its calendar dates are ready.');await load()
  }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function toggle(row:OccurrenceWithTask,complete:boolean){setBusy(true);setError('');setMessage('')
  try{const result=await db().rpc('complete_household_task',{p_occurrence:row.id,p_completed:complete});if(result.error)throw result.error;setMessage(complete?'Task marked done.':'Completion corrected.');await load()}
  catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function archiveTask(){if(!household||!archive)return;setBusy(true);setError('')
  try{const result=await db().rpc('archive_household_task',{p_household:household.id,p_task:archive.id});if(result.error)throw result.error;setMessage('Task stopped. Its history is kept.');setArchive(null);await load()}
  catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 const now=Date.now()
 return <div className="task-page">
  <PageTitle eyebrow="YOUR FAMILY" title="Tasks and calendar">Share the little jobs that keep your dog’s days happy.</PageTitle>
  <div className="task-shortcuts"><Link className="text-link" to="/calendar">Open shared calendar <ChevronRight size={16}/></Link><Link className="text-link" to="/academy">Open Academy <ChevronRight size={16}/></Link></div>
  {error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
  <section className="card task-form-card"><div className="task-title-row"><span className="icon-tile peach"><Plus size={19}/></span><div><h2>{editing?'Edit task':'Add a family task'}</h2><p className="muted">All family members can edit shared tasks. Completion is attributed to the person who marks it done.</p></div></div>
   <form className="form-stack task-form" onSubmit={save}><div className="task-form-grid"><Field label="Task title" required maxLength={100} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><Field label="Due date and time · 24-hour" type="datetime-local" required value={form.firstDue} onChange={e=>setForm({...form,firstDue:e.target.value})}/></div>
    <label className="field">Details<textarea maxLength={1200} rows={3} value={form.details} onChange={e=>setForm({...form,details:e.target.value})}/></label>
    <label className="field">Responsible family member<select value={form.assignedTo} onChange={e=>setForm({...form,assignedTo:e.target.value})}><option value="">Anyone in the family</option>{members.map(member=><option key={member.user_id} value={member.user_id}>{member.display_name}{member.user_id===session?.user.id?' (you)':''}</option>)}</select></label>
    <div className="task-form-grid"><label className="field">Repeat<select value={form.recurrence} onChange={e=>setForm({...form,recurrence:e.target.value as TaskSeries['recurrence'],endsOn:''})}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
     {form.recurrence!=='none'&&<Field label="Every (interval)" type="number" min={1} max={52} required value={form.every} onChange={e=>setForm({...form,every:Number(e.target.value)})}/>}
    </div>
    {form.recurrence!=='none'&&<Field label="Repeat until (optional)" type="date" value={form.endsOn} onChange={e=>setForm({...form,endsOn:e.target.value})} hint="Repeats follow the household time zone. A monthly task uses the same day, clamped to the month's final day."/>}
    <div className="walk-actions"><Button disabled={busy||loading||isSchemaUnavailable(error)}>{busy?'Saving…':editing?'Save task':'Add task'}</Button>{editing&&<Button type="button" className="secondary" onClick={()=>startEdit()}>Cancel edit</Button>}</div>
   </form>
  </section>
  {archive&&<section className="card task-confirm"><h2>Stop “{archive.title}”?</h2><p>Future occurrences will stop appearing. Completed and overdue history will remain.</p><div className="walk-actions"><Button disabled={busy} onClick={()=>void archiveTask()}>Stop task</Button><Button className="secondary" onClick={()=>setArchive(null)}>Keep task</Button></div></section>}
  <section className="card task-list-card"><div className="task-title-row"><span className="icon-tile"><ListChecks size={20}/></span><div><h2>Upcoming and overdue</h2><p className="muted">Times shown in {household?.timezone}.</p></div></div>
   {loading?<p role="status">Loading family tasks…</p>:error&&!series.length?<Button className="secondary" onClick={()=>setRetry(v=>v+1)}>Retry</Button>:rows.length===0?<p className="muted">No task dates in this view. Add a one-time or recurring task above.</p>:<ul className="task-occurrence-list">{rows.map(row=>{const status=taskStatus(row,now),name=names.get(row.assigned_to||'')||'';return <li key={row.id} id={`task-${row.id}`} className={focusId===row.id?'task-focused':''}><div className="task-occurrence-copy"><div className="task-occurrence-heading"><strong>{row.title}</strong><span className={`task-status task-${status}`}>{status==='completed'?'Done':status==='overdue'?'Overdue':'Upcoming'}</span></div><p>{localTime(row.due_at,household!.timezone).replace('T',' · ')} · {row.assigned_to?(name?`For ${name}`:'Assigned family member'):'Anyone'} · {recurrenceLabel(row)}</p>{row.details&&<p>{row.details}</p>}{row.completed_by&&<small>Completed by {row.completed_by===session?.user.id?'you':names.get(row.completed_by)||'Former family member'}</small>}</div><div className="task-row-actions">{status!=='completed'?<Button className="secondary" disabled={busy} aria-label={`Mark ${row.title} complete`} onClick={()=>void toggle(row,true)}><Check size={16}/>Done</Button>:row.completed_by===session?.user.id&&<Button className="secondary" disabled={busy} aria-label={`Correct ${row.title} completion`} onClick={()=>void toggle(row,false)}><RotateCcw size={15}/>Undo</Button>}<Button className="secondary" disabled={busy} onClick={()=>startEdit(row.task)}>Edit</Button><Button className="secondary task-icon-button" aria-label={`Stop ${row.title}`} disabled={busy} onClick={()=>setArchive(row.task)}><Trash2 size={15}/></Button></div></li>})}</ul>}
   {series.length>0&&<p className="task-history-note">{series.length} active task {series.length===1?'series':'series'}. Calendar shows occurrences within the current planning window.</p>}
  </section>
 </div>
}
