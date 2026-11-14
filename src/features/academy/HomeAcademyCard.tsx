import { useCallback,useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight,Flame,GraduationCap,Sparkles } from 'lucide-react'
import { Button,LoadingPlaceholder,Notice,errorMessage } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { AcademyModuleProgress, AcademyPractice } from '../../lib/supabase/database.types'
import { academyProgress } from './progress'
import { academyModules } from './catalog'

export function HomeAcademyCard({householdId,zone,dogName}:{householdId:string;zone:string;dogName:string}){
 const [records,setRecords]=useState<AcademyPractice[]>([]),[milestones,setMilestones]=useState<AcademyModuleProgress[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const load=useCallback(async()=>{setLoading(true);setError('');try{const [activity,progress]=await Promise.all([db().from('academy_practice').select('*').eq('household_id',householdId).is('deleted_at',null).order('practiced_at',{ascending:false}).limit(500),db().from('academy_module_progress').select('*').eq('household_id',householdId)]);if(activity.error)throw activity.error;if(progress.error)throw progress.error;setRecords(activity.data||[]);setMilestones(progress.data||[])}catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[householdId])
 useEffect(()=>{void load()},[load,retry])
 const progress=academyProgress(records,zone,new Date(),milestones),next=progress.nextModule
 return <section className="card home-walk-card home-academy-card"><div className="home-card-heading"><span className="icon-tile peach"><GraduationCap size={20}/></span><div><p className="eyebrow">LITTLE WINS TOGETHER</p><h3>Academy</h3></div></div>
  {loading?<LoadingPlaceholder label="Loading shared progress"/>:error?<><Notice error>{error}</Notice><Button className="secondary" onClick={()=>setRetry(value=>value+1)}>Try again</Button></>:<div className="home-academy-stats"><span><Sparkles size={14}/>{progress.xp} XP · Level {progress.level}</span><span><Flame size={14}/>{progress.streak} day streak</span></div>}
  {!loading&&!error&&next&&<p>{progress.completedIds.has(next.id)?`${dogName} has started learning together.`:`Next lesson: ${next.title}`}</p>}
  <Link className="text-link" to={!loading&&!error&&next?`/academy/${next.id}`:'/academy'}>Open Academy <ArrowUpRight size={15}/></Link>
 </section>
}
