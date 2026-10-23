import { NextResponse } from 'next/server'
import { getAuthorizedMhClients, normalizeMhPhone } from '@/lib/mh-ringcentral-bridge'
import { getRingCentralAccessToken, isRingCentralConfigured, ringCentralServer } from '@/lib/ringcentral'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type VoicemailMessage = {
 id?: string | number
 type?: string
 direction?: string
 creationTime?: string
 from?: {phoneNumber?: string}
 readStatus?: string
 attachments?: Array<{id?:string | number;type?:string;vmDuration?:number}>
}

// This is a read-only, client-scoped bridge; it never deletes or marks a
// RingCentral voicemail as read. The JWT alone is not authorization for Arctos.
export async function GET(request: Request) {
 try {
   const {clientByPhone} = await getAuthorizedMhClients(request)
   if (!clientByPhone.size) return NextResponse.json({voicemails:[]},{headers:{'Cache-Control':'private, no-store'}})
   if (!isRingCentralConfigured()) return NextResponse.json({error:'RingCentral voicemail connection is not configured.'},{status:409})
   const token=await getRingCentralAccessToken()
   const after=new Date(Date.now()-90*24*60*60*1000).toISOString()
   const messages:VoicemailMessage[]=[]
   // Bound history scans to avoid rate limits; subsequent syncs are idempotent.
   for(let page=1;page<=5;page++){
     const params=new URLSearchParams({messageType:'VoiceMail',dateFrom:after,perPage:'100',page:String(page)})
     const res=await fetch(`${ringCentralServer()}/restapi/v1.0/account/~/extension/~/message-store?${params}`,{
       headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},
       cache:'no-store',signal:AbortSignal.timeout(20000)
     })
     const payload=await res.json().catch(()=>({})) as {records?:VoicemailMessage[];paging?:{totalPages?:number};message?:string}
     if(!res.ok) return NextResponse.json({error: payload.message||'Unable to retrieve RingCentral voicemail messages. Confirm Read Messages permission.'},{status:res.status})
     const pageRows=(payload.records||[]).filter(m=>m.type==='VoiceMail'&&m.id&&m.creationTime)
     messages.push(...pageRows)
     if(!payload.records?.length || page>=Number(payload.paging?.totalPages || 1))break
   }
   const voicemails=messages.flatMap(m=>{
     const phone=normalizeMhPhone(m.from?.phoneNumber)
     const clientId=phone?clientByPhone.get(phone):undefined
     if(!clientId)return []
     const audio=m.attachments?.find(a=>a.type==='AudioRecording')
     return [{client_id:clientId,source_voicemail_id:String(m.id),received_at:m.creationTime,
       from_phone:m.from?.phoneNumber||null,duration_seconds:Math.max(0,Math.round(Number(audio?.vmDuration||0))),
       audio_attachment_id:audio?.id?String(audio.id):null,read_status:m.readStatus||null}]
   })
   return NextResponse.json({voicemails},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){
   const status=Number((error as {status?:number})?.status)||500
   return NextResponse.json({error:error instanceof Error?error.message:'RingCentral voicemail retrieval failed.'},{status})
 }
}
