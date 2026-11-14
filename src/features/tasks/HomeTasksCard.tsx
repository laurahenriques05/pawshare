import { useCallback,useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight,ListChecks } from 'lucide-react'
import { Button,LoadingPlaceholder,Notice,errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { TaskOccurrence } from '../../lib/supabase/database.types'
import { localTime } from '../health/time'
import { taskStatus } from './model'

export function HomeTasksCard({householdId,zone}:{householdId:string;zone:string}){
 const [rows,setRows]=useState<TaskOccurrence[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const now=Date.now(),from=new Date(now-90*86400000).toISOString(),until=new Date(now+180*86400000).toISOString()
  const generated=await db().rpc('generate_task_occurrences',{p_household:householdId,p_from:from,p_until:until});if(generated.error)throw generated.error
  const occurrences=await db().from('task_occurrences').select('*').eq('household_id',householdId).gte('due_at',from).lte('due_at',until).order('due_at').limit(300)
  if(occurrences.error)throw occurrences.error
  setRows(occurrences.data||[])
 }catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[householdId])
 useEffect(()=>{void load()},[load,retry])
 const now=Date.now(),overdue=rows.filter(row=>taskStatus(row,now)==='overdue'),upcoming=rows.find(row=>taskStatus(row,now)==='upcoming')
 return <section className="card home-walk-card home-tasks-card"><div className="home-card-heading"><span className="icon-tile peach"><ListChecks size={19}/></span><div><p className="eyebrow">A LITTLE TEAMWORK</p><h3>Family tasks</h3></div></div>
  {loading?<LoadingPlaceholder label="Loading shared tasks"/>:error?<><Notice error>{error}</Notice><Button className="secondary" onClick={()=>setRetry(value=>value+1)}>Try again</Button></>:<><p>{overdue.length?`${overdue.length} overdue ${overdue.length===1?'task':'tasks'}`:upcoming?`Next: ${upcoming.title}`:'No open tasks in the planning window.'}</p>{upcoming&&<small>Due {localTime(upcoming.due_at,zone).replace('T',' ')}</small>}</>}
  <div className="home-task-links"><Link className="text-link" to="/tasks">View tasks <ArrowUpRight size={15}/></Link><Link className="text-link" to="/calendar">Calendar <ArrowUpRight size={15}/></Link></div>
 </section>
}
