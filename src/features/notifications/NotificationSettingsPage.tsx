import { useCallback,useEffect,useState } from 'react'
import { Bell,BellOff,Smartphone } from 'lucide-react'
import { Button,Notice,PageTitle,errorMessage,isSchemaUnavailable } from '../../components/ui'
import { db } from '../../lib/supabase/client'
import type { NotificationPreference,PushSubscription } from '../../lib/supabase/database.types'
import { useAuth } from '../auth/AuthProvider'

const categories:{id:NotificationPreference['category'];label:string;description:string}[]=[
 {id:'task',label:'Family tasks',description:'One hour before due; assigned tasks escalate to the household one hour after becoming overdue.'},
 {id:'feeding',label:'Food restocking',description:'Restocking reminders when Feeding connects to shared push.'},
 {id:'health',label:'Health',description:'Appointment and medication reminders when Health connects to shared push.'},
 {id:'walk',label:'Walks',description:'Walk alerts when Walks connects to shared push.'},
 {id:'academy',label:'Academy',description:'Family learning and practice reminders when enabled.'},
]
function decodePublicKey(value:string){const pad='='.repeat((4-value.length%4)%4);const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,char=>char.charCodeAt(0))}
function installedAsApp(){const standalone=(navigator as Navigator & {standalone?:boolean}).standalone;return !!standalone||window.matchMedia('(display-mode: standalone)').matches}

export function NotificationSettingsPage(){
 const {session}=useAuth();const user=session!.user;const publicKey=import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY||''
 const supported=typeof window!=='undefined'&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window
 const [permission,setPermission]=useState<NotificationPermission>(()=>supported?Notification.permission:'default')
 const [subscriptions,setSubscriptions]=useState<Array<Pick<PushSubscription,'id'|'endpoint'>>>([]),[preferences,setPreferences]=useState<Record<NotificationPreference['category'],boolean>>({task:true,feeding:true,health:true,walk:true,academy:true})
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[retry,setRetry]=useState(0)
 const schemaUnavailable=isSchemaUnavailable(error)
 const load=useCallback(async()=>{setLoading(true);setError('');try{const [devices,prefs]=await Promise.all([db().from('push_subscriptions').select('id,endpoint').eq('user_id',user.id),db().from('notification_preferences').select('category,enabled').eq('user_id',user.id)]);if(devices.error)throw devices.error;if(prefs.error)throw prefs.error;setSubscriptions(devices.data||[]);setPreferences(current=>{const next={...current};for(const pref of prefs.data||[])next[pref.category]=pref.enabled;return next})}catch(e){setError(errorMessage(e))}finally{setLoading(false)}},[user.id])
 useEffect(()=>{void load()},[load,retry])
 async function enable(){setBusy(true);setError('');setMessage('')
  try{
   if(!supported)throw new Error('This browser does not support web push notifications.')
   if(!publicKey)throw new Error('Phone push is not configured for this project yet. The team needs to add the public VAPID key to the app and the private key to the server.')
   const granted=await Notification.requestPermission();setPermission(granted);if(granted!=='granted')throw new Error(granted==='denied'?'Notifications are blocked in this browser. Allow them in the browser or phone settings, then try again.':'Allow notifications to continue.')
   const registration=await navigator.serviceWorker.register('/service-worker.js');await navigator.serviceWorker.ready
   let subscription=await registration.pushManager.getSubscription()
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodePublicKey(publicKey)})
   const json=subscription.toJSON();if(!json.keys?.p256dh||!json.keys.auth)throw new Error('The browser returned an incomplete push subscription.')
   const saved=await db().from('push_subscriptions').upsert({user_id:user.id,endpoint:subscription.endpoint,p256dh:json.keys.p256dh,auth:json.keys.auth},{onConflict:'endpoint'});if(saved.error)throw saved.error
   setMessage('This device is registered for PawShare notifications. Delivery will begin once the team configures the server sender.');await load()
  }catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function removeDevice(){setBusy(true);setError('');setMessage('')
  try{const registration=await navigator.serviceWorker.getRegistration('/');const subscription=await registration?.pushManager.getSubscription();if(subscription){const result=await db().from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',subscription.endpoint);if(result.error)throw result.error;await subscription.unsubscribe()}setMessage('Notifications are disabled on this device.');await load()}
  catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 async function setCategory(category:NotificationPreference['category'],enabled:boolean){setBusy(true);setError('');setMessage('')
  try{const result=await db().from('notification_preferences').upsert({user_id:user.id,category,enabled},{onConflict:'user_id,category'});if(result.error)throw result.error;setPreferences(current=>({...current,[category]:enabled}))}
  catch(e){setError(errorMessage(e))}finally{setBusy(false)}
 }
 return <div className="notification-settings"><PageTitle eyebrow="YOUR ACCOUNT" title="Phone notifications">Choose what PawShare may send to this account. Each family member controls their own preferences.</PageTitle>
  {error&&<Notice error>{error}</Notice>}{message&&<Notice>{message}</Notice>}
  <section className="card notification-device"><div className="notification-device-heading"><span className="icon-tile peach"><Smartphone size={20}/></span><div><h2>This device</h2><p className="muted">{supported?permission==='granted'?'Browser permission is allowed.':permission==='denied'?'Browser permission is blocked.':'Notifications need your permission.':'Web push is not supported in this browser.'}</p></div></div>
   {supported&&!publicKey&&<Notice>Push delivery needs the project VAPID keys configured. No notification is reported as delivered until the server sender is installed.</Notice>}
   {supported&&publicKey&&permission!=='denied'&&<Button disabled={busy||loading||schemaUnavailable} onClick={()=>void enable()}><Bell size={16}/>{busy?'Please wait…':'Enable notifications on this device'}</Button>}
   {permission==='denied'&&<p className="photo-hint">Change notification permission in your browser or phone settings; this page cannot override a blocked permission.</p>}
   {subscriptions.length>0&&<div className="notification-device-list"><p>{subscriptions.length} device {subscriptions.length===1?'registered':'devices registered'} for this account.</p><Button className="secondary" disabled={busy||schemaUnavailable} onClick={()=>void removeDevice()}><BellOff size={15}/>Disable this device</Button></div>}
   {supported&&/iPhone|iPad|iPod/i.test(navigator.userAgent)&&!installedAsApp()&&<p className="photo-hint">On iPhone or iPad, add PawShare to the Home Screen and open it there before enabling push notifications.</p>}
   {loading&&<p role="status" className="muted">Loading notification settings…</p>}
  </section>
  <section className="card notification-preferences"><h2>Your preferences</h2><p className="muted">Turning a category off cancels future reminders for you, not for other family members.</p>
   {categories.map(category=><label className="notification-preference-row" key={category.id}><span><strong>{category.label}</strong><small>{category.description}</small></span><input type="checkbox" checked={preferences[category.id]} disabled={busy||loading||schemaUnavailable} onChange={event=>void setCategory(category.id,event.target.checked)} aria-label={`${category.label} notifications`}/></label>)}
  </section>
  {!error&&loading&&<Button className="secondary" onClick={()=>setRetry(value=>value+1)}>Retry settings</Button>}
 </div>
}
