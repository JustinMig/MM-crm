import {officeBackupMessages} from '@/lib/office-backup-messages'
import {prepareAttachment} from '@/lib/crm-text-attachments'
import {NextResponse} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {normalizeUsPhone,sendTwilioSms} from '@/lib/twilio'
import {OFFICE_SMS_ORIGINS,OFFICE_SMS_BRIDGES,smsPhone,indexLegacyClients,reservedSms,mergeSmsMessages,smsName} from '@/lib/office-sms'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60
const uuid=(v:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''))
const cors=(r:Request)=>({'Cache-Control':'private, no-store','Vary':'Origin',...(OFFICE_SMS_ORIGINS.has(r.headers.get('origin')||'')?{'Access-Control-Allow-Origin':r.headers.get('origin')!}:{}),'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'})
export function OPTIONS(r:Request){return new Response(null,{status:204,headers:cors(r)})}
async function checked(p:any){const {data,error}=await p;if(error)throw Error('Text message data could not be saved or loaded.');return data}
export async function POST(request:Request){
 try{
  if(request.headers.get('origin')&&!OFFICE_SMS_ORIGINS.has(request.headers.get('origin')!))return NextResponse.json({error:'Office origin is not permitted.'},{status:403,headers:cors(request)})
  const bearer=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if(!bearer)return NextResponse.json({error:'Sign in to Office CRM.'},{status:401,headers:cors(request)})
  const admin=createAdminClient(),{data:identity,error:authError}=await admin.auth.getUser(bearer)
  if(authError||!identity.user)return NextResponse.json({error:'Office session expired.'},{status:401,headers:cors(request)})
  const actor=identity.user.id
  const [profile,acl]=await Promise.all([checked(admin.from('profiles').select('agency_id,active,role').eq('id',actor).maybeSingle()),checked(admin.from('office_crm_access').select('active,arctos_access,platinum_access,can_edit,can_view_sensitive').eq('user_id',actor).maybeSingle())])
  const input=await request.json(),scope=input.agency as keyof typeof OFFICE_SMS_BRIDGES,command=String(input.command||'')
  if(!Object.hasOwn(OFFICE_SMS_BRIDGES,scope)||!profile?.active||!['manager','admin'].includes(profile.role)||!profile.agency_id||!acl?.active||!(scope==='arctos'?acl.arctos_access:acl.platinum_access))return NextResponse.json({error:'Office texting access is not permitted for this agency.'},{status:403,headers:cors(request)})
  if(['send','read','hide'].includes(command)&&!acl.can_edit)return NextResponse.json({error:'Text editing is not permitted.'},{status:403,headers:cors(request)})
  const bridge=async(action:string,data:any={})=>{const response=await fetch(OFFICE_SMS_BRIDGES[scope],{method:'POST',headers:{Authorization:'Bearer '+bearer,'Content-Type':'application/json'},body:JSON.stringify({action,...data}),cache:'no-store',signal:AbortSignal.timeout(20000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Agency texting connection failed.');return result}
  if(command==='backup_messages'){
   if(!acl.can_edit||!acl.can_view_sensitive)return NextResponse.json({error:'Full Office access required.'},{status:403,headers:cors(request)})
   const verified=await bridge('backup_identity',{ids:input.ids})
   return NextResponse.json(await officeBackupMessages(admin,profile.agency_id,scope,verified),{headers:cors(request)})
  }
  if(command==='agents')return NextResponse.json(await bridge('campaign_agents'),{headers:cors(request)})
  if(!['directory','conversations','thread','send','read','hide'].includes(command))return NextResponse.json({error:'Invalid texting operation.'},{status:400,headers:cors(request)})
  const remote=await bridge('sms_context',{client_id:input.client_id||null,agent_id:input.agent_id||null,...(command==='conversations'?{agent_only:true}:{})})
  const agent=remote.agent,clients:any[]=remote.clients||[remote.client]
  if(!agent?.id)return NextResponse.json({error:'Choose an agent.'},{status:400,headers:cors(request)})
  if(command==='directory')return NextResponse.json({clients,agent,can_send:!!acl.can_edit},{headers:cors(request)})
  // Only an exact, unique phone/name/agent match may reuse Sheena's existing M&M conversation.
  async function legacyAgent(){
   const rows=await checked(admin.from('profiles').select('id,full_name').eq('agency_id',profile.agency_id).eq('active',true))
   const sameName=(rows||[]).filter((p:any)=>smsName(p.full_name)===smsName(agent.full_name))
   return sameName.length===1?sameName[0]:null
  }
  if(command==='conversations'){
   const mmAgent=await legacyAgent()
   const byRemote=new Map<string,any>(),byLegacy=new Map<string,any>()
   const phones=new Set<string>(),legacyPhones=new Set<string>()
   for(let offset=0;;offset+=1000){
    const page=await checked(admin.rpc('office_sms_inbox_sources',{p_agency:profile.agency_id,p_scope:scope,p_legacy_agent:mmAgent?.id||null})
     .order('source').order('source_id').range(offset,offset+999))
    for(const {source,source_id,summary} of page){
     const phone=smsPhone(summary.phone)
     if(!phone||phone==='+16627504626')continue
     phones.add(phone)
     if(source==='office')byRemote.set(source_id,summary)
     if(source==='legacy'){byLegacy.set(source_id,summary);legacyPhones.add(phone)}
    }
    if(page.length<1000)break
   }
   const remoteClients=new Map<string,any>(),legacyClients=new Map<string,any>()
   async function collectMatches(batch:string[]){
    const legacyBatch=batch.filter(phone=>legacyPhones.has(phone))
    async function collectLegacy(){
     if(!mmAgent||!legacyBatch.length)return
     for(let offset=0;;offset+=1000){
      const page=await checked(admin.rpc('crm_sms_phone_candidates',{p_agent:mmAgent.id,p_phones:legacyBatch})
       .select('id,first_name,last_name,phone').eq('agency_id',profile.agency_id).order('id').range(offset,offset+999))
      for(const client of page)legacyClients.set(client.id,client)
      if(page.length<1000)return
     }
    }
    const [agencyMatches]=await Promise.all([bridge('sms_context',{agent_id:agent.id,candidate_phones:batch}),collectLegacy()])
    for(const client of agencyMatches.clients)remoteClients.set(client.id,client)
   }
   const numbers=[...phones]
   // RPC arguments use JSON POST. A thousand U.S. numbers fit in about 16 KB.
   for(let start=0;start<numbers.length;start+=3000){
    const work=[]
    for(let i=start;i<Math.min(start+3000,numbers.length);i+=1000)work.push(collectMatches(numbers.slice(i,i+1000)))
    await Promise.all(work)
   }
   // Include same-name/same-phone M&M clients without messages in the ambiguity check.
   const legacyFor=indexLegacyClients([...legacyClients.values()],mmAgent?.full_name)
   const conversations=[...remoteClients.values()].flatMap((client:any)=>{
    const old=legacyFor(client,agent.full_name),source=byRemote.get(client.id)||(old&&byLegacy.get(old.id))
    if(!source||smsPhone(source.phone)!==smsPhone(client.phone))return []
    return [{...source,client_id:client.id,client_name:[client.first_name,client.last_name].filter(Boolean).join(' '),phone:client.phone,
     agent_id:agent.id,agent_name:agent.full_name,unread_count:Number(source.unread_count||0)}]
   }).sort((a:any,b:any)=>String(b.latest_at).localeCompare(String(a.latest_at))||a.client_id.localeCompare(b.client_id))
   return NextResponse.json({conversations,can_send:!!acl.can_edit},{headers:cors(request)})
  }
  const client=remote.client
  if(!client||!uuid(client.id))throw Error('Client not found in this agency.')
  if(smsPhone(client.phone)==='+16627504626')return NextResponse.json({error:'This number is reserved for Arctos.'},{status:403,headers:cors(request)})
  const phone=smsPhone(client.phone),name=[client.first_name,client.last_name].filter(Boolean).join(' ')
  if(!phone)return NextResponse.json({error:'This client needs a valid U.S. phone number.'},{status:400,headers:cors(request)})
  let thread=await checked(admin.from('office_sms_threads').select('id,remote_agent_id,phone,client_name,agent_name').eq('agency_id',profile.agency_id).eq('scope',scope).eq('remote_client_id',client.id).maybeSingle())
  let legacy=null
  if(!thread){
   const mmAgent=await legacyAgent()
   if(mmAgent){
    const candidates=await checked(admin.rpc('crm_sms_phone_candidates',{p_agent:mmAgent.id,p_phones:[phone]}).select('id,first_name,last_name,phone').eq('agency_id',profile.agency_id))
    legacy=indexLegacyClients(candidates||[],mmAgent.full_name)(client,agent.full_name)
   }
  }
  if(!legacy&&(!thread||thread.remote_agent_id!==agent.id||thread.phone!==phone||thread.client_name!==name||thread.agent_name!==agent.full_name)){
   thread=await checked(admin.from('office_sms_threads').upsert({agency_id:profile.agency_id,scope,remote_client_id:client.id,remote_agent_id:agent.id,phone,client_name:name,agent_name:agent.full_name,updated_at:new Date().toISOString()},{onConflict:'agency_id,scope,remote_client_id'}).select('id').single())
  }
  const table=legacy?'client_sms_messages':'office_sms_messages',column=legacy?'client_id':'thread_id',threadId=legacy?legacy.id:thread.id
  const threadQuery=(fields:string)=>admin.from(table).select(fields).eq(column,threadId)
  if(command==='thread'){
   const offset=Number(input.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>50000)throw Error('Invalid message page.')
   const rows=await checked(threadQuery('id,direction,body,text_attachment,from_number,to_number,twilio_message_sid,status,error_code,error_message,read_at,created_at').is('notification_hidden_at',null).order('created_at',{ascending:false}).order('id').range(offset,offset+99))
   return NextResponse.json({client,agent,messages:mergeSmsMessages((rows||[]).filter((row:any)=>!reservedSms(row)),phone),has_more:rows.length===100,next_offset:offset+rows.length,can_send:!!acl.can_edit&&client.status!=='deceased'},{headers:cors(request)})
  }
  if(command==='read'||command==='hide'){
   const now=new Date().toISOString()
   if(command==='read')await checked(admin.from(table).update({read_at:now,updated_at:now}).eq(column,threadId).eq('direction','inbound').eq('from_number',phone).is('read_at',null))
   else{const ids=Array.isArray(input.message_ids)?input.message_ids.filter(uuid).slice(0,200):[];if(!ids.length)throw Error('Choose messages to remove from the inbox.');await checked(admin.from(table).update({notification_hidden_at:now,updated_at:now}).eq(column,threadId).in('id',ids))}
   return NextResponse.json({saved:true},{headers:cors(request)})
  }
  const caption=String(input.body||'').trim(),operation=String(input.operation_id||'')
  const media=input.attachment_id?await prepareAttachment('office-'+scope,actor,String(input.attachment_id)):{attachment:null,mediaUrl:''}
  const body=media.attachment?.kind==='file'?[caption,media.attachment.url].filter(Boolean).join('\n'):caption
  const latest=await checked(threadQuery('direction,body').order('created_at',{ascending:false}).limit(100))
  const optout=(latest||[]).find((m:any)=>m.direction==='inbound'&&/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|START|UNSTOP)$/i.test(String(m.body||'').trim()))
  if(optout&&!/^(START|UNSTOP)$/i.test(optout.body.trim()))return NextResponse.json({error:'This client has opted out of texts.'},{status:400,headers:cors(request)})
  if(!uuid(operation)||(!body&&!media.mediaUrl)||caption.length>1500||client.status==='deceased')return NextResponse.json({error:'Enter a message of 1–1500 characters for an active client.'},{status:400,headers:cors(request)})
  const existing=await checked(admin.from(table).select('id,body,text_attachment,status,twilio_message_sid,'+column).eq('id',operation).maybeSingle())
  if(existing){if(existing[column]!==threadId||existing.body!==body||(existing.text_attachment?.id||'')!==(media.attachment?.id||''))throw Error('Message identifier is already in use.');return NextResponse.json({id:existing.id,status:existing.status,already_saved:true},{headers:cors(request)})}
  // Claim the identifier before contacting Twilio. A double click or network retry cannot send twice.
  const pending=await admin.from(table).insert({id:operation,[column]:threadId,user_id:actor,direction:'outbound',body,text_attachment:media.attachment,to_number:phone,status:'sending',read_at:new Date().toISOString()})
  if(pending.error)return NextResponse.json({error:'Message is already being processed. Refresh the conversation before retrying.'},{status:409,headers:cors(request)})
  try{
   const sent=await sendTwilioSms(normalizeUsPhone(phone),body,media.mediaUrl?[media.mediaUrl]:[])
   const saved=await admin.from(table).update({twilio_message_sid:String(sent.sid||'')||null,status:String(sent.status||'queued'),from_number:String(sent.from||'')||null,updated_at:new Date().toISOString()}).eq('id',operation)
   if(saved.error)return NextResponse.json({id:operation,status:'sending',warning:'The message was submitted. Delivery status is still updating; do not send it again.'},{headers:cors(request)})
   return NextResponse.json({id:operation,status:String(sent.status||'queued')},{headers:cors(request)})
  }catch(error){await admin.from(table).update({status:'failed',error_message:error instanceof Error?error.message:'Text could not be sent.',updated_at:new Date().toISOString()}).eq('id',operation);return NextResponse.json({error:error instanceof Error?error.message:'Text could not be sent.',id:operation},{status:502,headers:cors(request)})}
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Office texting is unavailable.'},{status:500,headers:cors(request)})}
}
