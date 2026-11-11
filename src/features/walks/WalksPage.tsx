import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Footprints, ArrowUpRight } from 'lucide-react'
import { Button, Notice, PageTitle } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { useWalks } from './WalkProvider'
import { duration, paceLabel, routeDistance, summarize, timeLabel } from './gps'
import { RouteMap } from './RouteMap'
import { walkNotifications } from './notifications'
import { clearWalkStart, pendingWalkStart } from './nfc'

export function WalksPage() {
 const {session}=useAuth(),{household,dog}=useHousehold(),data=useWalks(),navigate=useNavigate()
 const [search,setSearch]=useSearchParams(),[confirm,setConfirm]=useState<'start'|'end'|null>(null),[period,setPeriod]=useState<'day'|'week'|'month'>('day')
 const [notify,setNotify]=useState(''),[copied,setCopied]=useState('')
 const active=data.walks.find(w=>!w.ended_at&&!w.deleted_at),mine=active?.walker_id===session!.user.id
 const [historyLimit,setHistoryLimit]=useState(20)
 const summary=summarize(data.walks,period,household!.timezone)
 const history=data.walks.filter(w=>w.ended_at&&!w.deleted_at),deleted=data.walks.filter(w=>w.deleted_at&&w.walker_id===session!.user.id)
 const meters=mine?routeDistance(data.points):0
 const dialog=useRef<HTMLDivElement>(null),previousFocus=useRef<HTMLElement|null>(null)
 useEffect(()=>{if((search.get('action')==='start'||pendingWalkStart())&&data.ready){clearWalkStart();setConfirm('start');const next=new URLSearchParams(search);next.delete('action');setSearch(next,{replace:true})}},[search,setSearch,data.ready])
 useEffect(()=>{
  if(!confirm)return
  previousFocus.current=document.activeElement as HTMLElement
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
  return()=>previousFocus.current?.focus()
 },[confirm])
 useEffect(()=>{
  if(!data.warning||!active)return
  walkNotifications.show(active.id,()=>navigate('/walks'))
  return()=>walkNotifications.cancel(active.id)
 },[data.warning,active?.id,navigate])
 async function notifications(){
  if(typeof Notification==='undefined'){setNotify('This browser does not support system notifications. The in-app warning remains available.');return}
  try {const permission=await Notification.requestPermission();setNotify(permission==='granted'?'Browser notifications enabled where supported. Keep the app visible for reliable GPS and the in-app warning.':'Notifications unavailable or denied. You can still use the in-app warning.')}catch{setNotify('System notifications need the shared mobile notification integration. Use the in-app warning for now.')}
 }
 return <div className="walk-page"><PageTitle eyebrow="A LITTLE FRESH AIR" title={`Out with ${dog!.name}.`}>Your shared walking diary. One little adventure at a time.</PageTitle>
  {data.error&&<Notice error>{data.error}<p><Button className="secondary" onClick={()=>{void data.reload();void data.sync()}}>Retry connection</Button></p></Notice>}
  {data.loading?<p role="status">Loading walks…</p>:!data.ready?<section className="card"><h2>Your walking diary is getting ready</h2><p>Walks and summaries will appear here once the connection is ready. GPS diagnostics and the walking lesson are available below.</p></section>:<>
   <section className="card walk-hero"><div className="walk-heading"><span className="icon-tile"><Footprints/></span><div><p className="eyebrow">{active?'OUT EXPLORING':'READY WHEN YOU ARE'}</p><h2>{active?(mine?'Your walk is in progress':'Your dog is on a walk'):'A new trail awaits'}</h2></div></div>
    {active?<><p>Started {new Date(active.started_at).toLocaleString()}. {mine?'Your route stays private until you end the walk.':'The route becomes visible after the walker finishes.'}</p>
     {mine&&<><div className="walk-metrics"><div><strong>{timeLabel(duration(active,data.now))}</strong><span>Elapsed time</span></div><div><strong>{(meters/1000).toFixed(2)} km</strong><span>Recorded distance</span></div><div><strong>{paceLabel(meters,duration(active,data.now))}</strong><span>Average pace</span></div></div>
      <p role="status">{data.gpsMessage} {data.pending>0&&`${data.pending} GPS points waiting to sync.`}</p>
      {data.tracking&&data.points.length>0&&data.now-Date.parse(data.points.at(-1)!.recorded_at)>30000&&<Notice>GPS is interrupted. Distance may be incomplete. Missing GPS does not trigger automatic ending.</Notice>}
      <Notice>Keep the app visible and the screen unlocked for GPS. Refreshing stops recording: return here and press Resume GPS. Offline points are kept on this device until saved.</Notice>
      <div className="walk-actions">{!data.tracking&&!data.ending&&<Button disabled={data.busy} onClick={()=>void data.resume()}>Resume GPS</Button>}<Button className="secondary" disabled={data.busy||data.ending} onClick={()=>setConfirm('end')}>End walk</Button><Button className="secondary" disabled={data.busy} onClick={()=>void data.sync()}>Sync now</Button></div>
      <details><summary>Optional stationary reminder</summary><p>Experimental, foreground only: after 10 minutes within approximately 30 m, show a warning. After another 2 minutes of uninterrupted GPS, end at the current time. GPS accuracy must be ≤25 m. Movement, missing GPS, or hiding the app cancels the countdown.</p><label className="walk-check"><input type="checkbox" checked={data.autoEnd} onChange={e=>data.setAutoEnd(e.target.checked)}/>Enable reminder and automatic ending for this session</label><Button className="secondary" onClick={()=>void notifications()}>Enable browser notifications</Button>{notify&&<p role="status">{notify}</p>}</details>
      {data.warning&&<Notice>Still walking? Ending in approximately {Math.max(0,Math.ceil((120000-(data.now-data.warning))/1000))} seconds if GPS stays available.<p><Button onClick={data.keepWalking}>Keep walking</Button></p></Notice>}
      {data.points.length>0&&<RouteMap points={data.points}/>}
     </>}
    </>:<><p>Start a walk to record time and GPS. Your family sees the route after you finish.</p><Button disabled={data.busy} onClick={()=>setConfirm('start')}>Start walk</Button></>}
   </section>
   <section className="card"><div className="walk-heading"><div><p className="eyebrow">LITTLE STEPS ADD UP</p><h2>Walking together</h2></div><select aria-label="Summary period" value={period} onChange={e=>setPeriod(e.target.value as typeof period)}><option value="day">Today</option><option value="week">This week</option><option value="month">This month</option></select></div><div className="walk-metrics"><div><strong>{summary.count}</strong><span>Completed walks</span></div><div><strong>{(summary.meters/1000).toFixed(2)} km</strong><span>Recorded distance</span></div><div><strong>{timeLabel(summary.seconds)}</strong><span>Total time</span></div></div><p className="muted">Calendar periods use {household!.timezone}; weeks start on Monday. A walk belongs to the day it started. No daily target has been set.</p></section>
   <section className="card"><h2>Past adventures</h2>{!history.length?<p className="walk-empty">Your first completed walk will appear here.</p>:<ul className="walk-history">{history.slice(0,historyLimit).map(w=><li key={w.id}><Link to={`/walks/${w.id}`}><span><strong>{new Date(w.started_at).toLocaleString()}</strong><small>{w.walker_id===session!.user.id?'You walked':'Family walk'} · {timeLabel(duration(w))}{w.end_reason==='stationary'?' · Automatically ended':''}</small></span><span>{(w.distance_m/1000).toFixed(2)} km <ArrowUpRight size={16}/></span></Link></li>)}</ul>}{history.length>historyLimit&&<Button className="secondary" onClick={()=>setHistoryLimit(n=>n+20)}>Show more walks</Button>}</section>
   {deleted.length>0&&<section className="card"><h2>Recently deleted by you</h2><p>These walks are excluded from family history and summaries. Open one to restore it.</p><ul>{deleted.map(w=><li key={w.id}><Link to={`/walks/${w.id}`}>{new Date(w.started_at).toLocaleString()}</Link></li>)}</ul></section>}
  </>}
  <section className="card"><h2>A shortcut by the door</h2><p>Write this link to an NFC tag. It opens the Start Walk confirmation for the signed-in user’s selected family. Opening a link never starts a walk automatically.</p><code className="walk-url">{window.location.origin}/walks?action=start</code><p><Button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/walks?action=start`);setCopied('Link copied.')}catch{setCopied('Copy the link shown above manually.')}}}>Copy NFC link</Button></p>{copied&&<p role="status">{copied}</p>}<Link to="/walks/gps-test">Open GPS diagnostics</Link> · <Link to="/walks/learn">Read the walking lesson</Link></section>
  {confirm&&<div className="walk-dialog-backdrop"><div ref={dialog} className="card walk-dialog" role="dialog" aria-modal="true" aria-labelledby="walk-confirm-title" onKeyDown={e=>{if(e.key==='Escape')setConfirm(null);if(e.key==='Tab'){const buttons=dialog.current!.querySelectorAll<HTMLButtonElement>('button');if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons[buttons.length-1].focus()}else if(!e.shiftKey&&document.activeElement===buttons[buttons.length-1]){e.preventDefault();buttons[0].focus()}}}}><h2 id="walk-confirm-title">{confirm==='start'?`Start a walk with ${dog!.name}?`:'Finish this walk?'}</h2><p>{confirm==='start'?`Family: ${household!.name}. GPS points are buffered on this device and saved privately to your family’s database. The family can view the route after you finish. You can still record time if location is denied.`:'GPS recording stops now. All available points will sync before the completed route becomes visible to your family. Offline? Keep this device and retry when connected.'}</p>{confirm==='start'&&active&&<Notice>{mine?'You already have a walk. You can resume its GPS.':'Another family member is already walking your dog. Wait until they finish.'}</Notice>}<div className="walk-actions"><Button className="secondary" onClick={()=>setConfirm(null)}>Cancel</Button><Button disabled={data.busy||!data.ready||(confirm==='start'&&!!active&&!mine)} onClick={()=>{const action=confirm;setConfirm(null);void (action==='start'?(active?data.resume():data.start()):data.finish())}}>{confirm==='start'?(active?'Resume GPS':'Confirm start'):'Confirm end'}</Button></div></div></div>}
 </div>
}
