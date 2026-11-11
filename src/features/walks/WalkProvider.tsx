import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../../lib/supabase/client'
import type { Walk } from '../../lib/supabase/database.types'
import { errorMessage } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../household/HouseholdProvider'
import { getPoints, getWalks } from './api'
import { acceptable, stationaryFix, stationaryTick, type Point, type Stationary } from './gps'

import { mergeBuffer, parseBuffer, type WalkBuffer as Buffer } from './buffer'
type Value = {
 walks: Walk[]; ready: boolean; loading: boolean; error: string; busy: boolean; tracking: boolean; points: Point[]; pending: number; ending: boolean; now: number; warning: number | null; autoEnd: boolean; gpsMessage: string;
 reload: () => Promise<void>; start: () => Promise<void>; resume: () => Promise<void>; finish: () => Promise<void>; sync: () => Promise<void>; keepWalking: () => void; setAutoEnd: (value:boolean)=>void;
}
const Context=createContext<Value>(null!)
export const useWalks=()=>useContext(Context)
export function WalkProvider({children}:{children:ReactNode}) {
 const {session}=useAuth(); const {household,dog}=useHousehold()
 return <Tracker key={`${session!.user.id}:${household!.id}`} user={session!.user.id} household={household!.id} dog={dog!.id}>{children}</Tracker>
}
function Tracker({user,household,dog,children}:{user:string;household:string;dog:string;children:ReactNode}) {
 const key=`pawshare.walk-buffer.v1.${user}.${household}`
 const [ready,setReady]=useState(false)
 const [walks,setWalks]=useState<Walk[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [tracking,setTracking]=useState(false),[points,setPoints]=useState<Point[]>([]),[pending,setPending]=useState(0),[ending,setEnding]=useState(false),[loadError,setLoadError]=useState(''),[storageError,setStorageError]=useState(''),[now,setNow]=useState(Date.now())
 const [warning,setWarning]=useState<number|null>(null),[autoEnd,setAutoEndState]=useState(false),[gpsMessage,setGpsMessage]=useState('GPS is not recording.')
 const active=useRef<Walk|null>(null),buffer=useRef<Buffer|null>(null),route=useRef<Point[]>([]),watch=useRef<number|null>(null)
 const alive=useRef(true),operation=useRef(false),syncing=useRef<Promise<void>|null>(null),stationary=useRef<Stationary|null>(null),auto=useRef(false)
 const loadVersion=useRef(0)
 const lockRelease=useRef<(()=>void)|null>(null),booted=useRef(false)
 const takeLock=useCallback(async(id:string)=>{
  if(lockRelease.current)return
  if(!navigator.locks)throw new Error('This browser cannot safely lock recording to one tab. Use a current browser with Web Locks support.')
  const locked=await new Promise<boolean>(resolve=>{
   void navigator.locks.request(`pawshare.walk.${id}`,{ifAvailable:true},async lock=>{
    if(!lock){resolve(false);return}
    await new Promise<void>(release=>{lockRelease.current=release;resolve(true)})
   }).catch(()=>resolve(false))
  })
  if(!locked)throw new Error('This walk is recording or saving in another tab. Use that tab or stop GPS there before resuming here.')
 },[])
 const readLatestBuffer=useCallback(()=>{
  try{
   if(buffer.current)buffer.current=mergeBuffer(buffer.current,parseBuffer(localStorage.getItem(key),buffer.current.walk))
  }catch{/* Keep the in-memory queue if storage cannot be read. */}
 },[key])
 const stop=useCallback(()=>{if(watch.current!==null) navigator.geolocation.clearWatch(watch.current);watch.current=null;setTracking(false);stationary.current=null;setWarning(null);lockRelease.current?.();lockRelease.current=null},[])
 const persist=useCallback(()=>{
  if(!buffer.current) return
  setPending(buffer.current.points.length);setEnding(!!buffer.current.ending)
  try {localStorage.setItem(key,JSON.stringify(buffer.current));setStorageError('')} catch {setStorageError('Device storage is unavailable or full. Keep this page open and reconnect to save GPS points. Reloading may lose unsaved points.')}
 },[key])
 const upsert=useCallback((walk:Walk)=>setWalks(previous=>[walk,...previous.filter(w=>w.id!==walk.id)].sort((a,b)=>b.started_at.localeCompare(a.started_at))),[])
 const sync=useCallback(async()=>{
  if(syncing.current) return syncing.current
  const save=async()=>{
   if(!lockRelease.current)readLatestBuffer()
   const draft=buffer.current
   if(!draft || !navigator.onLine) return
   try {
    let attempted=false
    while(draft.points.length) {
     attempted=true
     const batch=draft.points.slice(0,500)
     const result=await db().rpc('append_walk_points',{p_walk:draft.walk,p_points:batch})
     if(result.error) throw result.error
     if(!alive.current) return
     draft.points.splice(0,batch.length);persist()
    }
    if(draft.ending) {
     attempted=true
     const result=await db().rpc('finish_walk',{p_walk:draft.walk,p_ended_at:draft.ending.at,p_reason:draft.ending.reason})
     if(result.error) throw result.error
     if(!alive.current) return
     loadVersion.current++;upsert(result.data);active.current=null;buffer.current=null;setPending(0);setEnding(false)
     try {localStorage.removeItem(key)} catch { /* Server has the completed walk. */ }
    }
    if(alive.current&&attempted)setError('')
   } catch(e) {if(alive.current) setError(`Could not save walk: ${errorMessage(e)}. Your unsaved points remain on this device. Reconnect and retry; use the original recording device if there is a sequence conflict.`)}
  }
  // A passive tab must never flush or overwrite the recording tab's device buffer.
  const job=buffer.current&&navigator.locks&&!lockRelease.current
   ? navigator.locks.request(`pawshare.walk.${buffer.current.walk}`,{ifAvailable:true},async lock=>{if(lock)await save()})
   : save()
  syncing.current=job
  try {await job} finally {syncing.current=null}
 },[key,persist,upsert,readLatestBuffer])
 const recovered=useRef<string|null>(null)
 const reload=useCallback(async()=>{
  if(operation.current||syncing.current)return
  const request=++loadVersion.current
  try {
   const data=await getWalks(household)
   if(!alive.current||request!==loadVersion.current)return
   setWalks(data)
   const own=data.find(w=>w.walker_id===user&&!w.ended_at&&!w.deleted_at)
   if(own && recovered.current!==own.id){
    active.current=own
    if(buffer.current?.walk!==own.id){
     let saved:Buffer|null=null
     try {
      saved=parseBuffer(localStorage.getItem(key),own.id)
     }catch{setError('Could not recover the local GPS buffer. Check the saved route before continuing.')}
     buffer.current=saved||{walk:own.id,points:[],ending:null}
    }
    const remote=await getPoints(own.id)
    if(!alive.current||request!==loadVersion.current)return
    const bySeq=new Map(remote.map(p=>[p.seq,p as Point]))
    for(const point of buffer.current!.points)bySeq.set(point.seq,point)
    route.current=[...bySeq.values()].sort((a,b)=>a.seq-b.seq);setPoints(route.current);setPending(buffer.current!.points.length);setEnding(!!buffer.current!.ending)
    setGpsMessage(buffer.current!.ending?'End requested. Reconnect and retry saving.':'An unfinished walk was recovered. Press Resume GPS to record again. Missing GPS cannot be recovered.')
    recovered.current=own.id
   } else if(!own && active.current){
    stop();active.current=null
    if(buffer.current?.points.length)setError('This walk ended on another device. Unsaved points remain on this device but cannot be appended to a completed walk. Use one recording device per walk.')
    else {buffer.current=null;setPending(0);setEnding(false);try{localStorage.removeItem(key)}catch{/* No unsaved route. */}}
   } else if(!own && !buffer.current){try{localStorage.removeItem(key)}catch{/* No recovery needed. */}}
   booted.current=true;setReady(true);setLoadError('')
  }catch(e){if(alive.current&&request===loadVersion.current)setLoadError(/schema cache|does not exist/i.test(errorMessage(e))?'Walks is still being set up. Ask your family administrator to complete setup, then retry.':`Walks could not load. ${errorMessage(e)}`)}
  finally{if(alive.current&&request===loadVersion.current)setLoading(false)}
 },[household,key,user,persist,stop])
 useEffect(()=>{
  alive.current=true
  void reload()
  return()=>{alive.current=false;loadVersion.current++;stop()}
 },[reload,stop])
 useEffect(()=>{
  const timer=setInterval(()=>{setNow(Date.now());if(booted.current)void sync()},5000)
  const poll=setInterval(()=>{if(!document.hidden&&booted.current)void reload()},30000)
  const online=()=>{void sync()}
  const visibility=()=>{stationary.current=null;setWarning(null);if(document.hidden)setGpsMessage('App hidden. GPS may pause; automatic ending is suspended.');else if(watch.current!==null)setGpsMessage('App visible. Waiting for fresh GPS; any interruption remains a gap.')}
  const unload=(event:BeforeUnloadEvent)=>{if(active.current){event.preventDefault();event.returnValue=''}}
  window.addEventListener('online',online);document.addEventListener('visibilitychange',visibility);window.addEventListener('beforeunload',unload)
  return()=>{clearInterval(timer);clearInterval(poll);window.removeEventListener('online',online);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('beforeunload',unload)}
 },[reload,sync])
 const end=useCallback(async(reason:'manual'|'stationary'='manual')=>{
  if(!buffer.current || !active.current || operation.current)return
  operation.current=true;loadVersion.current++;setBusy(true)
  try{
   const owned=!!lockRelease.current
   await takeLock(active.current.id)
   if(!alive.current){lockRelease.current?.();return}
   if(!owned)readLatestBuffer()
   stop()
   const latest=route.current.at(-1)
   buffer.current!.ending={at:new Date(Math.max(Date.now(),latest?Date.parse(latest.recorded_at):0,Date.parse(active.current.started_at))).toISOString(),reason}
   persist();setGpsMessage('GPS stopped. Saving the completed walk…')
   await sync()
  }catch(e){if(alive.current)setError(errorMessage(e))}
  finally{operation.current=false;if(alive.current)setBusy(false)}
 },[persist,stop,sync,takeLock,readLatestBuffer])
 useEffect(()=>{
  const timer=setInterval(()=>{
   const decision=stationaryTick(stationary.current,Date.now(),auto.current,!document.hidden,watch.current!==null)
   stationary.current=decision.state
   if(decision.action==='warn')setWarning(decision.state!.warnedAt)
   else if(!decision.state?.warnedAt)setWarning(null)
   if(decision.action==='end')void end('stationary')
  },1000)
  return()=>clearInterval(timer)
 },[end])
 async function record() {
  if(watch.current!==null||!active.current||buffer.current?.ending)return
  if(!window.isSecureContext||!navigator.geolocation)throw new Error('GPS requires HTTPS (or localhost) and browser location support.')
  await takeLock(active.current.id)
  readLatestBuffer()
  if(!alive.current){lockRelease.current?.();return}
  try {
   // Fetch the server tail on each resume to prevent an old device reusing sequence numbers.
   const remote=await getPoints(active.current!.id)
   if(!alive.current){lockRelease.current?.();return}
   const merged=new Map(remote.map(p=>[p.seq,p as Point]));for(const p of buffer.current!.points)merged.set(p.seq,p)
   route.current=[...merged.values()].sort((a,b)=>a.seq-b.seq);setPoints(route.current);recovered.current=active.current!.id
   setGpsMessage('Waiting for location permission and a fresh GPS position…')
   watch.current=navigator.geolocation.watchPosition(position=>{
    if(!alive.current||!active.current||buffer.current?.ending)return
    const point:Point={seq:(route.current.at(-1)?.seq??-1)+1,recorded_at:new Date(position.timestamp).toISOString(),latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy}
    if(Date.parse(point.recorded_at)<Date.parse(active.current.started_at)||!acceptable(point,route.current.at(-1))) {setGpsMessage('Waiting for a fresh, accurate GPS position (accuracy ≤50 m); noisy points are ignored.');return}
    route.current=[...route.current,point];buffer.current!.points.push(point);setPoints(route.current);setPending(buffer.current!.points.length);setEnding(!!buffer.current!.ending)
    setGpsMessage(`GPS recording · accuracy ±${Math.round(point.accuracy)} m`)
    const next=stationaryFix(stationary.current,point);stationary.current=next
    if(!next?.warnedAt)setWarning(null)
   },failure=>{
    stationary.current=null;setWarning(null)
    setGpsMessage(failure.code===1?'Location denied. Enable it in browser settings, then Resume GPS.':failure.code===2?'Location unavailable. Move outside and check device location settings.':'GPS timed out. Waiting for fresh positions; no stationary assumption is made.')
    if(failure.code===1)stop()
   },{enableHighAccuracy:true,maximumAge:0,timeout:20000})
   setTracking(true)
  } catch(e){stop();throw e}
 }
 async function resume(){if(operation.current)return;operation.current=true;loadVersion.current++;setBusy(true);setError('');try{await record()}catch(e){setError(errorMessage(e))}finally{operation.current=false;if(alive.current)setBusy(false)}}
 async function start(){
  if(operation.current)return;operation.current=true;loadVersion.current++;setBusy(true);setError('')
  try {
   const result=await db().rpc('start_walk',{p_dog:dog});if(result.error)throw result.error
   if(!alive.current)return
   const walk=result.data;active.current=walk;recovered.current=walk.id;upsert(walk)
   if(buffer.current?.walk!==walk.id){buffer.current={walk:walk.id,points:[],ending:null};route.current=[];setPoints([]);setPending(0);setEnding(false)}
   booted.current=true;setReady(true);await record()
  }catch(e){if(alive.current)setError(errorMessage(e))}finally{operation.current=false;if(alive.current)setBusy(false)}
 }
 function keepWalking(){stationary.current=null;setWarning(null)}
 function setAutoEnd(value:boolean){auto.current=value;setAutoEndState(value);keepWalking()}
 return <Context.Provider value={{walks,ready,loading,error:loadError||storageError||error,busy,tracking,points,pending,ending,now,warning,autoEnd,gpsMessage,reload,start,resume,finish:()=>end(),sync,keepWalking,setAutoEnd}}>{children}</Context.Provider>
}
