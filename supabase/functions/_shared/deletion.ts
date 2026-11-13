import { createClient } from 'npm:@supabase/supabase-js@2'
export async function handleDeletion(req:Request,kind:'account'|'household'){
 const origin=Deno.env.get('APP_ORIGIN');const headers={'Access-Control-Allow-Origin':origin||'', 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'}
 if(!origin||req.headers.get('origin')!==origin)return new Response(JSON.stringify({error:'Origin denied'}),{status:403,headers})
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return new Response(JSON.stringify({error:'POST required'}),{status:405,headers})
 try{
 const token=req.headers.get('authorization');if(!token)throw new Error('Authentication required')
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
 const client=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false}})
 const identity=await client.auth.getUser();if(identity.error||!identity.data.user)throw new Error('Authentication required')
 const user=identity.data.user.id;const body=await req.json()
 const admin=createClient(url,secret,{auth:{persistSession:false}})
 if(kind==='household'){
  if(typeof body.household!=='string'||typeof body.confirmation!=='string')throw new Error('Explicit confirmation required')
  const begin=await client.rpc('begin_household_deletion',{p_household:body.household,p_confirmation:body.confirmation});if(begin.error)throw begin.error
  // Delete via Storage API, never SQL metadata deletes. Repeatable after partial failure.
  for(const bucketName of ['dog-photos','health-documents']){
   const bucket=admin.storage.from(bucketName)
   async function clear(prefix:string){for(;;){const result=await bucket.list(prefix,{limit:100});if(result.error)throw result.error;if(!result.data.length)break;for(const item of result.data){const path=prefix+'/'+item.name;if(item.id){const deleted=await bucket.remove([path]);if(deleted.error)throw deleted.error}else await clear(path)}}}
   await clear(body.household)
  }
  const result=await admin.rpc('finalize_household_deletion',{p_household:body.household,p_user:user});if(result.error)throw result.error
 }else{
  const begin=await client.rpc('begin_account_deletion',{p_confirmation:body.confirmation});if(begin.error)throw begin.error
  const prepare=await admin.rpc('prepare_auth_deletion',{p_user:user});if(prepare.error)throw prepare.error
  const result=await admin.auth.admin.deleteUser(user);if(result.error)throw result.error
 }
 return new Response(JSON.stringify({success:true}),{headers})
 }catch(error){return new Response(JSON.stringify({error:error&&typeof error==='object'&&'message' in error?String(error.message):'Deletion failed. Retry the same request.'}),{status:400,headers})}
}
