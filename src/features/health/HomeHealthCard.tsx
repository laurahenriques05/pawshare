import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { Button,Notice } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import { localTime } from './time'
export function HomeHealthCard({home,zone}:{home:string;zone:string}){
 const [summary,setSummary]=useState<string[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0)
 useEffect(()=>{let live=true;setLoading(true);setError('');setSummary([]);void(async()=>{try{
 const now=new Date().toISOString(),today=localTime(now,zone).slice(0,10)
 const [visits,vaccines,medications]=await Promise.all([db().from('vet_appointments').select('title,starts_at').eq('household_id',home).gte('starts_at',now).order('starts_at').limit(1),db().from('vaccinations').select('name,next_due_on').eq('household_id',home).not('next_due_on','is',null).order('next_due_on').limit(1),db().from('medication_schedules').select('id').eq('household_id',home)])
 for(const r of [visits,vaccines,medications])if(r.error)throw r.error
 const lines:string[]=[];if(visits.data?.[0])lines.push(`${visits.data[0].title} · ${localTime(visits.data[0].starts_at,zone).replace('T',' ')}`)
 if(vaccines.data?.[0]){const v=vaccines.data[0];lines.push(`${v.name} · ${v.next_due_on!<today?'overdue':'next due'} ${v.next_due_on}`)}
 if(medications.data?.length){const doses=await db().from('medication_doses').select('id',{count:'exact',head:true}).in('schedule_id',medications.data.map(s=>s.id)).eq('status','scheduled').lte('scheduled_at',now);if(doses.error)throw doses.error;if(doses.count)lines.push(`${doses.count} medication dose(s) overdue`)}
 if(live)setSummary(lines)
 }catch(e){if(live)setError((e as Error).message)}finally{if(live)setLoading(false)}})();return()=>{live=false}},[home,zone,retry])
 return <section className="card home-walk-card"><h3>Health</h3>{loading?<p role="status">Loading health summary…</p>:error?<><Notice error>{error}</Notice><Button onClick={()=>setRetry(v=>v+1)}>Try again</Button></>:summary.length?<ul>{summary.map(line=><li key={line}>{line}</li>)}</ul>:<p>No upcoming appointments or recorded due dates.</p>}<Link className="text-link" to="/health">Open Health →</Link></section>
}
