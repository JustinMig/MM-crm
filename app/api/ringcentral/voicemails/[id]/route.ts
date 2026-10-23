import {NextResponse} from 'next/server'
import {getCrmSession} from '@/lib/crm-session'
import {createAdminClient} from '@/lib/supabase/admin'
import {getRingCentralAccessToken,isRingCentralConfigured,ringCentralServer} from '@/lib/ringcentral'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Params=Promise<{id:string}>
const UUID_SIMPLE=/^[0-9a-f-]{36}$/i

async function officeMessage(id:string){
 const {profile}=await getCrmSession()
 if(!profile?.agency_id)return {error:'Not authorized.',status:403} as const
 if(!UUID_SIMPLE.test(id))return {error:'Invalid voicemail ID.',status:400} as const
 const admin=createAdminClient()
 const {data,error}=await admin.from('ringcentral_office_voicemails')
  .select('id,source_message_id,from_phone,audio_attachment_id')
  .eq('agency_id',profile.agency_id).eq('id',id).is('hidden_at',null).maybeSingle()
 if(error)return {error:error.message,status:500} as const
 if(!data)return {error:'Voicemail not found.',status:404} as const
 return {data} as const
}

export async function DELETE(_request:Request,{params}:{params:Params}){
 const {id}=await params
 const {profile}=await getCrmSession()
 if(!profile?.agency_id)return NextResponse.json({error:'Not authorized.'},{status:403})
 if(!UUID_SIMPLE.test(id))return NextResponse.json({error:'Invalid voicemail ID.'},{status:400})
 const {data,error}=await createAdminClient().from('ringcentral_office_voicemails')
  .update({hidden_at:new Date().toISOString(),updated_at:new Date().toISOString()})
  .eq('agency_id',profile.agency_id).eq('id',id).is('hidden_at',null).select('id').maybeSingle()
 if(error)return NextResponse.json({error:error.message},{status:500})
 if(!data)return NextResponse.json({error:'Voicemail not found.'},{status:404})
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}})
}
export async function GET(_request:Request,{params}:{params:Params}){
 try{
  const {id}=await params
  const result=await officeMessage(id)
  if('error' in result)return NextResponse.json({error:result.error},{status:result.status})
  if(!isRingCentralConfigured())return NextResponse.json({error:'RingCentral not configured.'},{status:409})
  const message=result.data
  const token=await getRingCentralAccessToken()
  const meta=await fetch(`${ringCentralServer()}/restapi/v1.0/account/~/extension/~/message-store/${encodeURIComponent(message.source_message_id)}`,{
   headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(18000)
  })
  if(!meta.ok)return NextResponse.json({error:'Voicemail audio unavailable in RingCentral.'},{status:meta.status})
  const payload=await meta.json() as {type?:string;from?:{phoneNumber?:string};attachments?:Array<{id?:string|number;type?:string;uri?:string}>}
  if(payload.type!=='VoiceMail')return NextResponse.json({error:'Not a voicemail recording.'},{status:404})
  const audio=payload.attachments?.find(a=>a.type==='AudioRecording'&&a.uri&&
    (!message.audio_attachment_id||String(a.id)===message.audio_attachment_id))
  if(!audio?.uri)return NextResponse.json({error:'Voicemail audio attachment not found.'},{status:404})
  const source=new URL(audio.uri,ringCentralServer())
  // RingCentral URLs only; never forward a secret token to a user-supplied host.
  if(source.protocol!=='https:'||!(/(^|\.)ringcentral\.com$/i).test(source.hostname))
   return NextResponse.json({error:'Voicemail audio source is not trusted.'},{status:502})
  const body=await fetch(source.href,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(25000)})
  if(!body.ok)return NextResponse.json({error:'RingCentral could not retrieve the voicemail.'},{status:body.status})
  return new Response(body.body,{status:200,headers:{
   'Content-Type':body.headers.get('content-type')||'audio/wav',
   'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="office-voicemail.wav"'
  }})
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Voicemail playback failed.'},{status:500})
 }
}
