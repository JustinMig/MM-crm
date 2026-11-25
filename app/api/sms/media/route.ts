import {NextRequest,NextResponse} from 'next/server'
import {getCrmSession} from '@/lib/crm-session'
import {createAdminClient} from '@/lib/supabase/admin'
import {SMS_MEDIA_BUCKET,photoType,photoUrls} from '@/lib/sms-media'
export const runtime='nodejs'
export async function POST(request:NextRequest){
 const {userId,profile}=await getCrmSession()
 if(!profile?.active||!profile.agency_id)return NextResponse.json({error:'Not authorized.'},{status:403})
 if(Number(request.headers.get('content-length')||0)>4*1024*1024+32768)return NextResponse.json({error:'Choose a photo smaller than 4 MB.'},{status:413})
 try{
  const form=await request.formData(),file=form.get('photo')
  if(!(file instanceof File)||!file.size||file.size>4*1024*1024)return NextResponse.json({error:'Choose a photo smaller than 4 MB.'},{status:400})
  const bytes=new Uint8Array(await file.arrayBuffer()),type=photoType(bytes)
  if(!type)return NextResponse.json({error:'Choose a JPG, PNG or GIF photo.'},{status:400})
  const path=`${profile.agency_id}/${userId}/${crypto.randomUUID()}.${type==='image/jpeg'?'jpg':type==='image/png'?'png':'gif'}`,admin=createAdminClient()
  const {error}=await admin.storage.from(SMS_MEDIA_BUCKET).upload(path,bytes,{contentType:type,upsert:false})
  if(error)throw Error('Photo could not be uploaded. Try again.')
  const [url]=await photoUrls(admin,[path])
  return NextResponse.json({path,url},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to attach photo.'},{status:400})}
}
