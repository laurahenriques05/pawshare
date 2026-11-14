import webpush from 'npm:web-push@3.6.5'
import { createClient } from 'npm:@supabase/supabase-js@2.50.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const cronSecret = Deno.env.get('PUSH_CRON_SECRET')
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const vapidSubject = Deno.env.get('VAPID_SUBJECT')
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret' }
const trustedPushHosts=['fcm.googleapis.com','web.push.apple.com','updates.push.services.mozilla.com','push.services.mozilla.com']
function trustedEndpoint(endpoint:string){
 try{const url=new URL(endpoint);return url.protocol==='https:'&&trustedPushHosts.includes(url.hostname)}
 catch{return false}
}

Deno.serve(async request => {
 if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
 if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:cors})
 if(!cronSecret||request.headers.get('x-cron-secret')!==cronSecret)return new Response('Unauthorized',{status:401,headers:cors})
 if(!supabaseUrl||!serviceRoleKey||!vapidPublicKey||!vapidPrivateKey||!vapidSubject)return new Response('Push sender is not configured',{status:503,headers:cors})
 try{
  webpush.setVapidDetails(vapidSubject,vapidPublicKey,vapidPrivateKey)
  const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const claimed=await admin.rpc('claim_due_notifications',{p_limit:50})
  if(claimed.error)throw claimed.error
  let sent=0,failed=0
  for(const notice of claimed.data||[]){
   let delivered=0,transient=false;const errors:string[]=[]
   const subs=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',notice.recipient_id)
   if(subs.error){await admin.rpc('finish_notification_delivery',{p_id:notice.id,p_outcome:'retry',p_error:'Could not load device subscriptions'});continue}
   for(const subscription of subs.data||[]){
    try{
     if(!trustedEndpoint(subscription.endpoint))throw Object.assign(new Error('Unsupported push endpoint'),{statusCode:400})
     await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth}},JSON.stringify({id:notice.id,title:notice.title,body:notice.body,route:notice.route}),{TTL:3600})
     delivered++
    }catch(error){
     const failure=error as {statusCode?:number};errors.push(failure.statusCode?`Push service returned HTTP ${failure.statusCode}`:'Push service unavailable')
     if(failure.statusCode===404||failure.statusCode===410){await admin.from('push_subscriptions').delete().eq('id',subscription.id)}
     else if(!failure.statusCode||failure.statusCode===429||failure.statusCode>=500)transient=true
    }
   }
   const outcome=delivered>0?'sent':transient?'retry':'failed'
   const error=delivered>0?'':subs.data?.length?errors.join('; ').slice(0,500):'No registered device for this account'
   const finished=await admin.rpc('finish_notification_delivery',{p_id:notice.id,p_outcome:outcome,p_error:error})
   if(finished.error)throw finished.error
   if(delivered>0)sent++;else if(outcome==='failed')failed++
  }
  return new Response(JSON.stringify({claimed:claimed.data?.length||0,sent,failed}),{status:200,headers:{...cors,'Content-Type':'application/json'}})
 }catch(error){
  console.error('Push delivery batch failed')
  return new Response('Push delivery batch failed',{status:500,headers:cors})
 }
})
