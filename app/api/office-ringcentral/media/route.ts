import {NextResponse} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {fetchRingCentralRecording,getRingCentralAccessToken,isRingCentralConfigured,ringCentralServer} from '@/lib/ringcentral'

export const runtime='nodejs'
export const dynamic='force-dynamic'

const ALLOWED_ORIGINS=new Set([
 'https://office-crm-sand.vercel.app',
 'https://office-crm-msccv965z2-2421s-projects.vercel.app'
])
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const cors=(request:Request)=>{
 const origin=request.headers.get('origin')||''
 return {
  ...(ALLOWED_ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
  'Access-Control-Allow-Methods':'GET, OPTIONS',
  'Access-Control-Allow-Headers':'Authorization, Content-Type',
  'Access-Control-Max-Age':'600',
  'Vary':'Origin',
  'Cache-Control':'private, no-store'
 }
}
const fail=(request:Request,message:string,status:number)=>NextResponse.json({error:message},{status,headers:cors(request)})

export function OPTIONS(request:Request){
 return new Response(null,{status:204,headers:cors(request)})
}

/**
 * Serve RingCentral media solely for a saved, visible agency record. The
 * Office CRM supplies its M&M Supabase access token, never RingCentral secrets.
 * No media content URLs or privileged RingCentral credentials reach the browser.
 */
export async function GET(request:Request){
 try{
  const url=new URL(request.url)
  const kind=url.searchParams.get('kind')
  const id=url.searchParams.get('id')||''
  if(kind!=='call'&&kind!=='voicemail')return fail(request,'Invalid media type.',400)
  if(!UUID.test(id))return fail(request,'Invalid call record ID.',400)
  const access=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||''
  if(!access)return fail(request,'Sign in to Office CRM first.',401)
  const admin=createAdminClient()
  const {data:auth,error:authError}=await admin.auth.getUser(access)
  if(authError||!auth.user?.id)return fail(request,'Office CRM session has expired.',401)
  const {data:profile,error:profileError}=await admin.from('profiles')
   .select('agency_id,active,role').eq('id',auth.user.id).maybeSingle()
  if(profileError||!profile?.active||!profile.agency_id||!['manager','admin'].includes(profile.role))
   return fail(request,'Office CRM access is not permitted.',403)
  if(!isRingCentralConfigured())return fail(request,'RingCentral media is not connected.',409)

  const table=kind==='call'?'ringcentral_calls':'ringcentral_office_voicemails'
  const fields=kind==='call'?'id,recording_id':'id,source_message_id,audio_attachment_id'
  const {data:record,error}=await admin.from(table).select(fields)
   .eq('id',id).eq('agency_id',profile.agency_id).is('hidden_at',null).maybeSingle()
  if(error||!record)return fail(request,'Call or voicemail is not available.',404)

  const token=await getRingCentralAccessToken()
  let recording:Response
  if(kind==='call'){
   const recordingId=String('recording_id' in record?record.recording_id||'':'')
   if(!recordingId)return fail(request,'No recording is attached to this call.',404)
   recording=await fetchRingCentralRecording(recordingId,token)
  }else{
   const messageId=String('source_message_id' in record?record.source_message_id||'':'')
   if(!/^\d{1,30}$/.test(messageId))return fail(request,'Voicemail ID is invalid.',404)
   const metaResponse=await fetch(
    `${ringCentralServer()}/restapi/v1.0/account/~/extension/~/message-store/${encodeURIComponent(messageId)}`,{
     headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(18000)
    })
   if(!metaResponse.ok)return fail(request,'Voicemail is no longer available at RingCentral.',404)
   const meta=await metaResponse.json() as {type?:string;attachments?:Array<{id?:string|number;type?:string;uri?:string}>}
   if(meta.type!=='VoiceMail')return fail(request,'This record is not a voicemail.',404)
   const match=meta.attachments?.find(item=>item.type==='AudioRecording'&&item.uri&&
     (!('audio_attachment_id' in record)||!record.audio_attachment_id||
       String(item.id)===String(record.audio_attachment_id)))
   if(!match?.uri)return fail(request,'No playable voicemail recording is available.',404)
   const mediaUrl=new URL(match.uri,ringCentralServer())
   if(mediaUrl.protocol!=='https:'||!/(^|\.)ringcentral\.com$/i.test(mediaUrl.hostname))
     return fail(request,'Untrusted RingCentral media source.',502)
   recording=await fetch(mediaUrl.href,{headers:{Authorization:`Bearer ${token}`},
     cache:'no-store',signal:AbortSignal.timeout(25000)})
   if(!recording.ok)return fail(request,'RingCentral voicemail recording could not be retrieved.',502)
  }
  const h=new Headers(cors(request))
  h.set('Content-Type',recording.headers.get('content-type')||'audio/mpeg')
  h.set('Content-Disposition',`inline; filename="office-${kind}-recording.mp3"`)
  return new Response(recording.body,{status:200,headers:h})
 }catch(error){
  return fail(request,error instanceof Error?error.message:'Unable to retrieve RingCentral recording.',502)
 }
}
