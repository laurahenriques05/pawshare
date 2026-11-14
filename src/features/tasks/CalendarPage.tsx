import { useCallback,useEffect,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft,ChevronRight,Plus } from 'lucide-react'
import { Button,Notice,PageTitle,errorMessage } from '../../components/ui'
import { useHousehold } from '../household/HouseholdProvider'
import { loadCalendarEvents } from './calendarData'
import { eventOnDate,shiftMonth,type CalendarEvent,type CalendarSource } from './model'

const filters:{id:CalendarSource;label:string}[]=[{id:'task',label:'Tasks'},{id:'feeding',label:'Food restocking'},{id:'health',label:'Health'}]
function dateForZone(zone:string){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function startMonth(date:string){return date.slice(0,7)}
function monthDays(month:string){const [year,number]=month.split('-').map(Number);const count=new Date(Date.UTC(year,number,0)).getUTCDate();const padding=(new Date(Date.UTC(year,number-1,1)).getUTCDay()+6)%7;return{count,padding}}
function eventTime(event:CalendarEvent,zone:string){return event.allDay?'All day':new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(event.occursAt))}
export function CalendarPage(){
 const {household}=useHousehold();const zone=household?.timezone||'UTC';const today=dateForZone(zone)
 const [month,setMonth]=useState(()=>startMonth(today)),[selected,setSelected]=useState(today),[events,setEvents]=useState<CalendarEvent[]>([])
 const [active,setActive]=useState<Record<CalendarSource,boolean>>({task:true,feeding:true,health:true}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const load=useCallback(async()=>{if(!household)return;setLoading(true);setError('');try{setEvents(await loadCalendarEvents(household.id,zone,month))}catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[household?.id,zone,month])
 useEffect(()=>{void load()},[load,retry])
 const visible=useMemo(()=>events.filter(event=>active[event.source]),[events,active])
 const selectedEvents=visible.filter(event=>eventOnDate(event,selected,zone))
 const {count,padding}=monthDays(month)
 const monthLabel=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`))
 function changeMonth(value:string){setMonth(value);setSelected(value===startMonth(today)?today:`${value}-01`)}
 return <div className="calendar-page"><PageTitle eyebrow="YOUR FAMILY" title="Shared calendar">Care plans in your household time zone · {zone}</PageTitle>
  {error&&<Notice error>{error}</Notice>}
  <section className="card shared-calendar" aria-label="Shared household calendar">
   <div className="shared-calendar-toolbar"><button type="button" onClick={()=>changeMonth(startMonth(today))}>Today</button><div className="shared-calendar-links"><Link to="/tasks"><Plus size={15}/>Add a task</Link><Link to="/health/appointments"><Plus size={15}/>Add appointment</Link></div></div>
   <div className="shared-calendar-month"><button type="button" aria-label="Previous month" onClick={()=>changeMonth(shiftMonth(month,-1))}><ChevronLeft/></button><h2 aria-live="polite">{monthLabel}</h2><button type="button" aria-label="Next month" onClick={()=>changeMonth(shiftMonth(month,1))}><ChevronRight/></button></div>
   <fieldset className="calendar-filters"><legend>Show</legend>{filters.map(filter=><label key={filter.id}><input type="checkbox" checked={active[filter.id]} onChange={e=>setActive({...active,[filter.id]:e.target.checked})}/>{filter.label}</label>)}</fieldset>
   <div className="shared-calendar-scroll" tabIndex={0} aria-label="Month calendar, scroll horizontally on small screens"><div className="shared-calendar-grid">
    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
    {Array.from({length:padding},(_,index)=><span key={`pad-${index}`} aria-hidden="true"/>)}
    {Array.from({length:count},(_,index)=>{const day=`${month}-${String(index+1).padStart(2,'0')}`;const onDay=visible.filter(event=>eventOnDate(event,day,zone));return <div className="shared-calendar-cell" key={day}><button type="button" className={`shared-calendar-day ${day===selected?'selected':''} ${day===today?'today':''}`} aria-pressed={day===selected} aria-current={day===today?'date':undefined} aria-label={`${day}, ${onDay.length} events`} onClick={()=>setSelected(day)}><span>{index+1}</span>{onDay.length>0&&<small>{onDay.length} {onDay.length===1?'event':'events'}</small>}</button>{onDay.slice(0,2).map(event=><Link className={`calendar-event calendar-${event.source} ${event.completed?'calendar-completed':''}`} to={event.href} key={event.id} title={event.title}><time>{eventTime(event,zone)}</time><span>{event.title}</span></Link>)}{onDay.length>2&&<button className="calendar-more" type="button" onClick={()=>setSelected(day)}>+{onDay.length-2} more</button>}</div>})}
   </div></div>
   {loading?<p role="status" className="calendar-load">Loading shared events…</p>:<section className="calendar-day-list" aria-live="polite"><h3>{new Intl.DateTimeFormat(undefined,{dateStyle:'full',timeZone:'UTC'}).format(new Date(`${selected}T12:00:00Z`))}</h3>{selectedEvents.length===0?<p className="muted">No shared events for this day.</p>:<ul>{selectedEvents.map(event=><li key={event.id}><Link to={event.href}><span className={`calendar-event-dot calendar-dot-${event.source}`}/><div><strong>{event.title}</strong><small>{eventTime(event,zone)} · {event.source==='task'?'Task':event.source==='feeding'?'Food restocking':'Health'}</small></div><ChevronRight size={17}/></Link></li>)}</ul>}</section>}
  </section>
  {error&&<Button className="secondary" onClick={()=>setRetry(value=>value+1)}>Retry loading calendar</Button>}
  <p className="calendar-footer-note">Tasks, feeding forecasts and Health records remain saved in their own feature. This calendar presents those source records without making duplicate copies.</p>
 </div>
}
