import {NextResponse} from 'next/server'
import {getCrmSession} from '@/lib/crm-session'
import {createAdminClient} from '@/lib/supabase/admin'

export const runtime='nodejs'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function PATCH(request:Request){
 const {profile}=await getCrmSession()
 if(!profile?.agency_id)return NextResponse.json({error:'Not authorized.'},{status:403})
 const body=await request.json().catch(()=>({})) as {kind?:string;id?:string;note?:string}
 if(!UUID.test(body.id||'')||!['call','voicemail'].includes(body.kind||''))
  return NextResponse.json({error:'Invalid call record.'},{status:400})
 if(typeof body.note!=='string'||body.note.trim().length>4000)
  return NextResponse.json({error:'Note must be 4,000 characters or fewer.'},{status:400})
 const table=body.kind==='call'?'ringcentral_calls':'ringcentral_office_voicemails'
 const {data,error}=await createAdminClient().from(table)
  .update({staff_note:body.note.trim(),updated_at:new Date().toISOString()})
  .eq('agency_id',profile.agency_id).eq('id',body.id).is('hidden_at',null)
  .select('id').maybeSingle()
 if(error)return NextResponse.json({error:error.message},{status:500})
 if(!data)return NextResponse.json({error:'Call record not found.'},{status:404})
 return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}})
}
