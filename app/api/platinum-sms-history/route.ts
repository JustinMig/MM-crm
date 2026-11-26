import {createClient} from '@supabase/supabase-js'
import {createAdminClient} from '@/lib/supabase/admin'
import {indexLegacyClients,reservedSms,smsPhone} from '@/lib/office-sms'
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
  const mode=write?'':new URL(request.url).searchParams.get('mode')||''
  if(mode&&(clientId||!['unread','summaries'].includes(mode)))return Response.json({error:'Invalid history view.'},{status:400,headers})
  const admin=createAdminClient()
  const {data:agent,error:agentError}=await admin.from('profiles').select('agency_id,full_name').eq('id',mmAgent).single()
  if(agentError||!agent?.agency_id)throw Error('Isaiah message history is unavailable.')
  const fields='id,first_name,last_name,phone'
  const loadDirectory=async(db:any,agentId:string,agency?:string)=>{
   const rows:any[]=[]
   for(let offset=0;;offset+=1000){
    let query=db.from('clients').select(fields).eq('assigned_agent_id',agentId)
    if(agency)query=query.eq('agency_id',agency)
    const {data,error}=await query.order('id').range(offset,offset+999)
    if(error)throw Error('Isaiah message history could not be matched.')
    rows.push(...(data||[]))
    if((data||[]).length<1000)return rows
   }
  }
  const candidates=async(db:any,agentId:string,phones:string[],agency?:string)=>{
   const rows:any[]=[]
   for(let offset=0;phones.length;offset+=1000){
    let query=db.rpc('crm_sms_phone_candidates',{p_agent:agentId,p_phones:phones}).select(fields)
    if(agency)query=query.eq('agency_id',agency)
    const {data,error}=await query.order('id').range(offset,offset+999)
    if(error)throw Error('Platinum clients could not be verified.')
    rows.push(...(data||[]))
    if((data||[]).length<1000)break
   }
   return rows
  }
  let clients:any[],legacy:any[]
  if(clientId){
   const {data:target,error}=await native.from('clients').select(fields).eq('assigned_agent_id',nativeAgent).eq('id',clientId).maybeSingle()
   if(error)throw Error('Platinum clients could not be verified.')
   const phone=smsPhone(target?.phone)
   ;[clients,legacy]=phone?await Promise.all([candidates(native,nativeAgent,[phone]),candidates(admin,mmAgent,[phone],agent.agency_id)]):[[],[]]
  }else if(mode){
   const unreadSids:string[]=[]
   if(mode==='unread'){
    for(let offset=0;;offset+=1000){
     const {data,error}=await native.from('client_sms_messages').select('twilio_message_sid').eq('direction','inbound').is('read_at',null).not('twilio_message_sid','is',null).order('id').range(offset,offset+999)
     if(error)throw Error('Platinum unread messages could not be loaded.')
     unreadSids.push(...(data||[]).map(m=>m.twilio_message_sid))
     if((data||[]).length<1000)break
    }
   }
   const result=await admin.rpc('platinum_sms_digest_input',{p_agency:agent.agency_id,p_agent:mmAgent,p_mode:mode,p_unread_sids:unreadSids})
   if(result.error)throw Error('Isaiah message history could not be summarized.')
   legacy=result.data||[]
   const phones=[...new Set(legacy.map(c=>smsPhone(c.phone)).filter(Boolean))]
   clients=await candidates(native,nativeAgent,phones)
  }else{
   ;[clients,legacy]=await Promise.all([loadDirectory(native,nativeAgent),loadDirectory(admin,mmAgent,agent.agency_id)])
  }
  const matches=new Map<string,string>(),counts=new Map<string,number>(),legacyFor=indexLegacyClients(legacy,agent.full_name)
  for(const c of clients){const phone=smsPhone(c.phone);if(phone)counts.set(phone,(counts.get(phone)||0)+1)}
  for(const client of clients){
   if(clientId&&client.id!==clientId)continue
   const match=legacyFor(client,agent.full_name)
   if(match&&counts.get(smsPhone(client.phone))===1)matches.set(match.id,client.id)
  }
  const suppressed=new Set<string>()
  if(!write){
   const {data,error}=await admin.rpc('platinum_sms_suppressed_sids',{p_agency:agent.agency_id,p_agent:mmAgent})
   if(error)throw Error('Message visibility could not be verified.')
   for(const sid of data||[])suppressed.add(sid)
  }
  if(mode){
   const states=legacy.flatMap(c=>matches.has(c.id)?(c.messages||[]).map((m:any[])=>[matches.get(c.id),...m]).filter((m:any[])=>!suppressed.has(m[2])):[])
   for(const sid of suppressed)states.push([null,null,sid,null,false,true,null])
   const {data:digest,error:digestError}=await native.rpc('platinum_sms_digest',{p_mode:mode,p_shared:states})
   if(digestError||!digest)throw Error('Platinum message history could not be summarized.')
   if(mode==='summaries'){
    const ids=digest.conversations.map((c:any)=>c.latest.shared_id).filter(Boolean)
    const previews=new Map<string,string>()
    for(let offset=0;offset<ids.length;offset+=500){
     const {data,error}=await admin.rpc('platinum_sms_preview',{p_agency:agent.agency_id,p_agent:mmAgent,p_ids:ids.slice(offset,offset+500)})
     if(error)throw Error('Isaiah message previews could not be loaded.')
     for(const row of data||[])previews.set(row.id,row.body)
    }
    for(const c of digest.conversations){
     if(c.latest.shared_id)c.latest.body=previews.get(c.latest.shared_id)||''
     delete c.latest.shared_id
    }
   }
   return Response.json(digest,{headers})
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
  const messages:any[]=[],suppressedSids=new Set<string>()
  // Only echo suppression keys for native rows the caller can already see.
  if(clientId&&suppressed.size){
   const keys=[...suppressed]
   for(let offset=0;offset<keys.length;offset+=75){
    const {data,error}=await native.from('client_sms_messages').select('twilio_message_sid').eq('client_id',clientId).in('twilio_message_sid',keys.slice(offset,offset+75))
    if(error)throw Error('Message visibility could not be verified.')
    for(const m of data||[])suppressedSids.add(m.twilio_message_sid)
   }
  }
  const ids=[...matches.keys()]
  for(let start=0;start<ids.length;start+=75){
   for(let offset=0;;offset+=1000){
    const {data,error}=await admin.from('client_sms_messages').select('id,client_id,direction,body,from_number,to_number,twilio_message_sid,status,error_code,error_message,read_at,notification_hidden_at,created_at,media_paths,text_attachment').in('client_id',ids.slice(start,start+75)).not('twilio_message_sid','is',null).order('created_at').order('id').range(offset,offset+999)
    if(error)throw Error('Isaiah messages could not be loaded.')
    const page=(data||[]).filter(m=>!m.notification_hidden_at&&!reservedSms(m)&&!suppressed.has(m.twilio_message_sid))
    const nativeHidden=new Set<string>()
    if(page.length){
     const {data:keys,error}=await native.rpc('platinum_sms_hidden_shared',{p_shared:page.map(m=>[matches.get(m.client_id),m.id,m.twilio_message_sid])})
     if(error)throw Error('Message visibility could not be verified.')
     for(const key of keys||[])nativeHidden.add(key)
    }
    for(const message of page){
     if(nativeHidden.has(message.twilio_message_sid))continue
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
  return Response.json({messages,suppressedSids:[...suppressedSids],matchedClients:matches.size},{headers})
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Message history is unavailable.'},{status:502,headers})}
}

export const GET=(request:Request)=>handle(request)
export const POST=(request:Request)=>handle(request,true)
