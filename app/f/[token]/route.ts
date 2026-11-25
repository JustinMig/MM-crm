import {createAdminClient} from '@/lib/supabase/admin'
import {fileBucket} from '@/lib/crm-text-attachments'
export const dynamic='force-dynamic'
export async function GET(_request:Request, {params}:{params:Promise<{token:string}>}){
  const {token}=await params
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}
  const unavailable=()=>new Response('This file link has expired or is unavailable.',{status:404,headers})
  if(!/^[\w-]{24}$/.test(token))return unavailable()
  const db=createAdminClient(), {data}=await db.from('crm_text_attachments').select('object_path,filename').eq('share_token',token).eq('published',true).gt('expires_at',new Date().toISOString()).maybeSingle()
  if(!data)return unavailable()
  const signed=await db.storage.from(fileBucket).createSignedUrl(data.object_path,60,{download:data.filename})
  if(!signed.data?.signedUrl)return unavailable()
  return new Response(null,{status:302,headers:{...headers,Location:signed.data.signedUrl}})
}
