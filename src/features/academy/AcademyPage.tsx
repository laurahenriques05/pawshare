import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Award, BookOpen, Flame, LockKeyhole, Sparkles, Trash2 } from 'lucide-react'
import { Button, LoadingPlaceholder, Notice, PageTitle, errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { AcademyModuleProgress, AcademyPractice } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { academyModules, ACADEMY_RULES, isModuleUnlocked } from './catalog'
import { academyProgress } from './progress'

export function AcademyPage(){
 const {moduleId}=useParams();const {household,dog}=useHousehold();const {session}=useAuth()
 const [records,setRecords]=useState<AcademyPractice[]>([]),[milestones,setMilestones]=useState<AcademyModuleProgress[]>([]),[names,setNames]=useState(new Map<string,string>())
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const load=useCallback(async()=>{
  if(!household)return;setLoading(true);setError('')
  try{const [practice,progress,people]=await Promise.all([db().from('academy_practice').select('*').eq('household_id',household.id).is('deleted_at',null).order('practiced_at',{ascending:false}).limit(100),db().from('academy_module_progress').select('*').eq('household_id',household.id),db().rpc('get_household_members',{p_household:household.id})]);if(practice.error)throw practice.error;if(progress.error)throw progress.error;if(people.error)throw people.error;setRecords(practice.data||[]);setMilestones(progress.data||[]);setNames(new Map((people.data||[]).map(person=>[person.user_id,person.display_name])))}
  catch(e){setError(errorMessage(e))}finally{setLoading(false)}
 },[household?.id])
 useEffect(()=>{void load()},[load,retry])
 const progress=useMemo(()=>academyProgress(records,household?.timezone||'UTC',new Date(),milestones),[records,milestones,household?.timezone])
 const module=academyModules.find(item=>item.id===moduleId)
 if(moduleId&&!module)return <div className="academy-page"><PageTitle eyebrow="PAWSHARE ACADEMY" title="Lesson not found."/><Link className="text-link" to="/academy">Back to Academy</Link></div>
 if(loading)return <div className="academy-page"><PageTitle eyebrow="PAWSHARE ACADEMY" title={module?.title||'Learn a little, together.'}/><LoadingPlaceholder label="Loading Academy progress and lesson access" lines={3}/></div>
 if(error)return <div className="academy-page"><PageTitle eyebrow="PAWSHARE ACADEMY" title="Academy is temporarily unavailable.">Your lessons and progress are still safe. Try again after the database connection is ready.</PageTitle><Notice error>{error}</Notice><Button className="secondary" onClick={()=>setRetry(value=>value+1)}>Try again</Button><p><Link className="text-link" to="/more">Back to More</Link></p></div>
 if(module&&!isModuleUnlocked(module,progress.completedIds))return <div className="academy-page"><PageTitle eyebrow="PAWSHARE ACADEMY" title="A little more learning first.">Complete the previous lesson together to unlock this one.</PageTitle><Link className="text-link" to="/academy">Back to Academy</Link></div>
 return <div className="academy-page">
  {module?<><Link className="academy-back" to="/academy"><ArrowLeft size={16}/>All lessons</Link><PageTitle eyebrow={`${module.courseTitle.toUpperCase()} · LESSON ${module.position}`} title={module.title}>{module.objective}</PageTitle>
   <article className="card academy-lesson-card"><p className="academy-meta"><BookOpen size={16}/>About {module.estimatedMinutes} minutes</p>{module.sections.map(section=><section className="academy-lesson-section" key={section.heading}><h2>{section.heading}</h2><p>{section.text}</p></section>)}
    <section className="academy-try"><h2>Try it together</h2><p>Save what you practised. Completing this lesson earns {ACADEMY_RULES.xpPerModule} shared XP once for the household.</p><PracticeForm key={module.id} moduleId={module.id} householdId={household!.id} dogId={dog!.id} onSaved={load}/></section>
    <details className="academy-check"><summary>Quick check</summary><h3>{module.question}</h3><p><strong>{module.answer}</strong></p><p>{module.feedback}</p></details>
   </article>
   <section className="card academy-history"><h2>Family practice notes</h2>{loading?<p role="status">Loading practice…</p>:records.filter(record=>record.module_id===module.id).length===0?<p className="muted">No practice saved for this lesson yet.</p>:<ul className="academy-practice-list">{records.filter(record=>record.module_id===module.id).map(record=><li key={record.id}><div><strong>{record.completed?'Lesson completed':'Practice saved'} · {record.user_id===session?.user.id?'you':names.get(record.user_id||'')||'Former family member'}</strong><small>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short',timeZone:household!.timezone,hour12:false}).format(new Date(record.practiced_at))}</small>{record.performance&&<p>{record.performance}</p>}</div>{record.user_id===session?.user.id&&<div className="academy-own-actions"><PracticeEdit record={record} householdId={household!.id} dogId={dog!.id} onSaved={load}/><PracticeDelete record={record} householdId={household!.id} dogId={dog!.id} onDeleted={load}/></div>}</li>)}</ul>}</section>
  </>:<>
   <PageTitle eyebrow="PAWSHARE ACADEMY" title="Learn a little, together.">One shared learning journey for {dog?.name}. Any family member can keep it moving.</PageTitle>
   <><section className="academy-progress-grid"><div className="card academy-progress-card"><Sparkles/><strong>{progress.xp}</strong><span>shared XP · level {progress.level}</span></div><div className="card academy-progress-card"><Flame/><strong>{progress.streak}</strong><span>day family practice streak</span></div><div className="card academy-progress-card"><Award/><strong>{progress.completedCount}</strong><span>lessons completed</span></div></section>
    {progress.badges.length>0&&<p className="academy-badges" aria-label="Earned badges">{progress.badges.map(badge=><span key={badge}><Award size={15}/>{badge}</span>)}</p>}
   </>
   <section className="academy-course"><div className="academy-course-heading"><div><p className="eyebrow">A GOOD PLACE TO START</p><h2>Everyday care</h2></div><span>{progress.completedCount}/{academyModules.length} lessons</span></div><div className="academy-module-grid">{academyModules.map(item=>{const unlocked=isModuleUnlocked(item,progress.completedIds);const complete=progress.completedIds.has(item.id);return <article className={`card academy-module ${!unlocked?'locked':''}`} key={item.id}><div className="academy-module-top"><span className="icon-tile peach">{unlocked?<BookOpen size={19}/>:<LockKeyhole size={18}/>}</span><span>{complete?'Complete':unlocked?'Lesson '+item.position:'Locked'}</span></div><h3>{item.title}</h3><p>{item.objective}</p>{unlocked?<Link className="text-link" to={`/academy/${item.id}`}>{complete?'Review lesson':'Start lesson'} <ArrowUpRight size={16}/></Link>:<p className="muted">Complete the previous lesson to unlock it.</p>}</article>})}</div></section>
   <p className="academy-rules-note">Shared progress follows the family time zone. XP is awarded once per lesson; practice notes remain attributed to the person who saved them.</p>
  </>}
 </div>
}

function PracticeForm({moduleId,householdId,dogId,onSaved,initialRecord,onCancel}:{moduleId:string;householdId:string;dogId:string;onSaved:()=>Promise<void>;initialRecord?:AcademyPractice;onCancel?:()=>void}){
 const module=academyModules.find(item=>item.id===moduleId)!;const [checklist,setChecklist]=useState<Record<string,boolean>>(()=>initialRecord?.checklist||{});const [performance,setPerformance]=useState(initialRecord?.performance||'');const [completed,setCompleted]=useState(initialRecord?.completed||false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const [operationId,setOperationId]=useState(()=>initialRecord?.id||crypto.randomUUID())
 async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');setMessage('')
  try{const result=await db().rpc('save_academy_practice',{p_household:householdId,p_id:operationId,p_dog:dogId,p_module:moduleId,p_checklist:checklist,p_performance:performance,p_completed:completed});if(result.error)throw result.error;setMessage(initialRecord?'Your practice note was updated.':'Practice saved to your family’s learning journey.');if(!initialRecord){setChecklist({});setPerformance('');setCompleted(false);setOperationId(crypto.randomUUID())}await onSaved()}
  catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 return <form className="academy-practice-form" onSubmit={save}>{error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
  <fieldset disabled={busy}><legend>Practice checklist</legend>{module.checklist.map((item,index)=><label className="academy-check-row" key={item}><input type="checkbox" checked={!!checklist[String(index)]} onChange={e=>setChecklist({...checklist,[String(index)]:e.target.checked})}/><span>{item}</span></label>)}
   <label className="field">How did it go? (optional)<textarea maxLength={1200} rows={3} value={performance} onChange={e=>setPerformance(e.target.value)} placeholder="Share a short note with your family."/></label>
   <label className="academy-complete-row"><input type="checkbox" checked={completed} disabled={initialRecord?.completed} onChange={e=>setCompleted(e.target.checked)}/><span>{initialRecord?.completed?'Lesson completion is part of shared family progress':'Mark this lesson complete for our dog'}</span></label>
   <Button disabled={busy}>{busy?'Saving…':initialRecord?'Save changes':'Save practice'}</Button>{onCancel&&<Button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</Button>}
  </fieldset>
 </form>
}

function PracticeEdit({record,householdId,dogId,onSaved}:{record:AcademyPractice;householdId:string;dogId:string;onSaved:()=>Promise<void>}){
 const [editing,setEditing]=useState(false)
 return editing?<PracticeForm key={record.id} moduleId={record.module_id} householdId={householdId} dogId={dogId} initialRecord={record} onSaved={async()=>{await onSaved();setEditing(false)}} onCancel={()=>setEditing(false)}/>:<Button className="secondary" onClick={()=>setEditing(true)}>Edit</Button>
}

function PracticeDelete({record,householdId,dogId,onDeleted}:{record:AcademyPractice;householdId:string;dogId:string;onDeleted:()=>Promise<void>}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 async function remove(){setBusy(true);setError('');try{const result=await db().rpc('save_academy_practice',{p_household:householdId,p_id:record.id,p_dog:dogId,p_module:record.module_id,p_checklist:record.checklist,p_performance:record.performance,p_completed:record.completed,p_delete:true});if(result.error)throw result.error;setConfirm(false);await onDeleted()}catch(e){setError(errorMessage(e))}finally{setBusy(false)}}
 return <div className="academy-delete">{error&&<Notice error>{error}</Notice>}{confirm?<><Button className="secondary" disabled={busy} onClick={()=>void remove()}>{busy?'Removing…':'Confirm delete'}</Button><Button className="secondary" disabled={busy} onClick={()=>setConfirm(false)}>Keep</Button></>:<Button className="secondary" aria-label="Delete your practice record" onClick={()=>setConfirm(true)}><Trash2 size={15}/>Delete</Button>}</div>
}
