import { NextResponse } from 'next/server'
import { getAuthorizedMhClients, normalizeMhPhone } from '@/lib/mh-ringcentral-bridge'
import { getRingCentralAccessToken, ringCentralServer } from '@/lib/ringcentral'

export const runtime='nodejs'
export const dynamic='force-dynamic'

// Stream voicemail audio only for a RingCentral caller uniquely assigned to
// a client the active Arctos user is authorized to see.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params
  if(!/^\d{1,30}$/.test(id))return NextResponse.json({error:'Invalid voicemail ID.'},{status:400})
  const {clientByPhone}=await getAuthorizedMhClients(request)
  const token=await getRingCentralAccessToken()
  const base=ringCentralServer()
  const metadata=await fetch(`${base}/restapi/v1.0/account/~/extension/~/message-store/${id}`,{
   headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(18000)
  })
  if(!metadata.ok)return NextResponse.json({error:'Voicemail unavailable.'},{status:404})
  const msg=await metadata.json() as {type?:string;from?:{phoneNumber?:string};attachments?:Array<{type?:string;uri?:string}>}
  const phone=normalizeMhPhone(msg.from?.phoneNumber)
  if(msg.type!=='VoiceMail'||!phone||!clientByPhone.has(phone))return NextResponse.json({error:'Voicemail unavailable.'},{status:404})
  const audio=msg.attachments?.find(a=>a.type==='AudioRecording'&&a.uri)
  if(!audio?.uri)return NextResponse.json({error:'Voicemail audio is not available.'},{status:404})
  const link=new URL(audio.uri)
  if(link.protocol!=='https:'||!(link.hostname==='ringcentral.com'||link.hostname.endsWith('.ringcentral.com')))
    return NextResponse.json({error:'Unsupported voicemail audio source.'},{status:502})
  const sound=await fetch(link.href,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(25000)})
  if(!sound.ok)return NextResponse.json({error:'Unable to retrieve voicemail audio.'},{status:sound.status})
  return new Response(sound.body,{headers:{'Content-Type':sound.headers.get('content-type')||'audio/wav',
   'Cache-Control':'private, no-store','Content-Disposition':'inline; filename="voicemail.wav"'}})
 }catch(error){
  const status=Number((error as {status?:number})?.status)||500
  return NextResponse.json({error:error instanceof Error?error.message:'Voicemail playback unavailable.'},{status})
 }
}
