import {createClient} from '@supabase/supabase-js'
import {createAdminClient} from '@/lib/supabase/admin'
import {matchingLegacyClient,smsPhone} from '@/lib/office-sms'
import {photoUrls} from '@/lib/sms-media'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const nativeAgent='8099c3d2-dff1-4a34-8c90-06931f64177e'
const mmAgent='b34219da-711a-4f6d-a3c6-087ae96e31c4'
const origins=new Set(['https://pf.mayerig.com','https://platinum-financial-crm.vercel.app','https://platinum-financial-crm-msccv965z2-2421s-projects.vercel.app'])
function responseHeaders(request:Request){const origin=request.headers.get('origin')||'';return {'Cache-Control':'private, no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})}}
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:responseHeaders(request)})}
async function handle(request:Request,write=false){
 const headers=responseHeaders(request)
 try{
  if(request.headers.has('origin')&&!origins.has(request.headers.get('origin')!))return Response.json({error:'CRM origin is not permitted.'},{status:403,headers})
  const authorization=request.headers.get('authorization')||'',token=authorization.match(/^Bearer (.+)$/i)?.[1]
  if(!token)return Response.json({error:'Sign in to Platinum Financial.'},{status:401,headers})
  const native=createClient('https://sggzshbdfgkyyvxbebul.supabase.co','sb_publishable_wLDvDmI4pmIcADkUlc6-LQ_RWMoQU1Y',{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:identity,error:authError}=await native.auth.getUser(token)
  if(authError||!identity.user)return Response.json({error:'Your Platinum session expired.'},{status:401,headers})
  const {data:profile}=await native.from('profiles').select('id,active,role').eq('id',identity.user.id).maybeSingle()
  if(!profile?.active||(!['owner','admin'].includes(profile.role)&&profile.id!==nativeAgent))return Response.json({error:'Isaiah client access is required.'},{status:403,headers})
  const input=write?await request.json():{}
  const clientId=write?String(input.clientId||''):new URL(request.url).searchParams.get('clientId')
  if(write&&!clientId)return Response.json({error:'Choose a client.'},{status:400,headers})
  const clients:any[]=[]
  for(let offset=0;;offset+=1000){
   const query=native.from('clients').select('id,first_name,last_name,phone').eq('assigned_agent_id',nativeAgent).order('id').range(offset,offset+999)
   const {data,error}=await query;if(error)throw Error('Platinum clients could not be verified.')
   clients.push(...(data||[]));if((data||[]).length<1000)break
  }
  const admin=createAdminClient()
  const {data:agent,error:agentError}=await admin.from('profiles').select('agency_id,full_name').eq('id',mmAgent).single()
  if(agentError||!agent?.agency_id)throw Error('Isaiah message history is unavailable.')
  const legacy:any[]=[]
  for(let offset=0;;offset+=1000){
   const {data,error}=await admin.from('clients').select('id,first_name,last_name,phone').eq('agency_id',agent.agency_id).eq('assigned_agent_id',mmAgent).order('id').range(offset,offset+999)
   if(error)throw Error('Isaiah message history could not be matched.')
   legacy.push(...(data||[]).map(c=>({...c,agent_name:agent.full_name})));if((data||[]).length<1000)break
  }
  const matches=new Map<string,string>(),counts=new Map<string,number>()
  for(const c of clients){const phone=smsPhone(c.phone);if(phone)counts.set(phone,(counts.get(phone)||0)+1)}
  for(const client of clients){
   if(clientId&&client.id!==clientId)continue
   const match=matchingLegacyClient(client,agent.full_name,legacy)
   if(match&&counts.get(smsPhone(client.phone))===1)matches.set(match.id,client.id)
  }
  if(write){
   if(!['read','hide'].includes(input.action))return Response.json({error:'Invalid message action.'},{status:400,headers})
   const ids=[...matches.keys()]
   if(ids.length!==1)return Response.json({error:'This client conversation is unavailable.'},{status:404,headers})
   let query=admin.from('client_sms_messages').update(input.action==='read'?{read_at:new Date().toISOString()}:{notification_hidden_at:new Date().toISOString()}).eq('client_id',ids[0])
   if(input.action==='read')query=query.eq('direction','inbound').is('read_at',null)
   else {
    const messageIds=Array.isArray(input.messageIds)?input.messageIds.filter((id:unknown)=>/^[\da-f-]{36}$/i.test(String(id))).slice(0,200):[]
    if(!messageIds.length)return Response.json({error:'Choose messages.'},{status:400,headers})
    query=query.in('id',messageIds)
   }
   const {error}=await query
   if(error)throw Error('The message action could not be saved.')
   return Response.json({saved:true},{headers})
  }
  const messages:any[]=[]
  const ids=[...matches.keys()]
  for(let start=0;start<ids.length;start+=75){
   for(let offset=0;;offset+=1000){
    const {data,error}=await admin.from('client_sms_messages').select('id,client_id,direction,body,from_number,to_number,twilio_message_sid,status,error_code,error_message,read_at,notification_hidden_at,created_at,media_paths,text_attachment').in('client_id',ids.slice(start,start+75)).not('twilio_message_sid','is',null).order('created_at').order('id').range(offset,offset+999)
    if(error)throw Error('Isaiah messages could not be loaded.')
    for(const message of data||[]){
     let attachment=message.text_attachment
     if(!attachment&&message.media_paths?.length){
      const urls=await photoUrls(admin,message.media_paths,86400)
      attachment={id:message.id,name:'Photo',kind:'photo',url:urls[0]}
     }
     messages.push({id:message.id,source:'mm',notification_hidden_at:message.notification_hidden_at,client_id:matches.get(message.client_id),direction:message.direction,body:message.body||'',from_number:message.from_number,to_number:message.to_number,twilio_message_sid:message.twilio_message_sid,status:message.status,error_code:message.error_code,error_message:message.error_message,read_at:message.read_at,created_at:message.created_at,occurred_at:message.created_at,text_attachment:attachment||null})
    }
    if((data||[]).length<1000)break
   }
  }
  return Response.json({messages,matchedClients:matches.size},{headers})
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Message history is unavailable.'},{status:502,headers})}
}

export const GET=(request:Request)=>handle(request)
export const POST=(request:Request)=>handle(request,true)
