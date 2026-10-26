import {NextResponse} from 'next/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {isRingCentralConfigured} from '@/lib/ringcentral'
import {syncOfficeRingCentral} from '@/lib/office-ringcentral-sync'

export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const ORIGINS=new Set([
 'https://office-crm-sand.vercel.app',
 'https://office-crm-msccv965z2-2421s-projects.vercel.app'
])
const cors=(request:Request)=>({
 ...(ORIGINS.has(request.headers.get('origin')||'')?{'Access-Control-Allow-Origin':request.headers.get('origin')!}:{}),
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type',
 'Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'private, no-store'
})
const fail=(request:Request,error:string,status:number)=>NextResponse.json({error},{status,headers:cors(request)})

export function OPTIONS(request:Request){return new Response(null,{status:204,headers:cors(request)})}

// Office uses a bearer session, not M&M's browser cookies. Validate the same
// active manager/admin boundary as the existing Office recording endpoint.
export async function POST(request:Request){
 try{
  const origin=request.headers.get('origin')
  if(origin&&!ORIGINS.has(origin))return fail(request,'Office CRM origin is not permitted.',403)
  const access=request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if(!access)return fail(request,'Sign in to Office CRM first.',401)
  const admin=createAdminClient()
  const {data:auth,error:authError}=await admin.auth.getUser(access)
  if(authError||!auth.user?.id)return fail(request,'Office CRM session has expired.',401)
  const {data:profile,error}=await admin.from('profiles').select('agency_id,active,role')
   .eq('id',auth.user.id).maybeSingle()
  if(error||!profile?.active||!profile.agency_id||!['manager','admin'].includes(profile.role))
   return fail(request,'Office CRM phone access is not permitted.',403)
  if(!isRingCentralConfigured())return fail(request,'RingCentral is not connected.',409)
  const response=await syncOfficeRingCentral(profile.agency_id)
  const result=await response.json()
  return NextResponse.json(result,{status:response.status,headers:cors(request)})
 }catch{
  return fail(request,'Unable to sync RingCentral. Saved phone records are still available.',502)
 }
}
