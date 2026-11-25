import 'server-only'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
export const fileBucket = 'crm-text-files'
export const maxFileSize = 4 * 1024 * 1024
const agencies = {
  arctos: ['https://bogusfmvdrlvxscopgaw.supabase.co','sb_publishable_0g4-uBS_I8wJnBdLbtbriA_vFngXi46'],
  platinum: ['https://sggzshbdfgkyyvxbebul.supabase.co','sb_publishable_wLDvDmI4pmIcADkUlc6-LQ_RWMoQU1Y']
} as const
export const problem = (message:string,status:number) => Object.assign(new Error(message),{status})
export async function attachmentActor(scope:string, authorization:string) {
  const token=authorization.match(/^Bearer (.+)$/i)?.[1]
  if(!token) throw problem('Sign in to your CRM.',401)
  if(scope==='office-arctos'||scope==='office-platinum'){
    const db=createAdminClient(), {data,error}=await db.auth.getUser(token)
    if(error||!data.user) throw problem('Your Office session expired.',401)
    const id=data.user.id
    const [profile,acl]=await Promise.all([db.from('profiles').select('active,role,agency_id').eq('id',id).maybeSingle(),db.from('office_crm_access').select('active,can_edit,arctos_access,platinum_access').eq('user_id',id).maybeSingle()])
    const p=profile.data,a=acl.data
    if(!p?.active||!p.agency_id||!['manager','admin'].includes(p.role)||!a?.active||!a.can_edit||!(scope==='office-arctos'?a.arctos_access:a.platinum_access)) throw problem('Office texting access is required.',403)
    return id
  }
  if(scope!=='arctos'&&scope!=='platinum') throw problem('Choose a CRM.',400)
  const [url,key]=agencies[scope]
  const db=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:user,error}=await db.auth.getUser(token)
  if(error||!user.user) throw problem('Your CRM session expired.',401)
  const {data:p}=await db.from('profiles').select('id,active,role').eq('id',user.user.id).maybeSingle()
  if(!p?.active||(!['owner','admin'].includes(p.role)&&scope==='platinum'&&p.id!=='8099c3d2-dff1-4a34-8c90-06931f64177e')) throw problem('Texting access is required.',403)
  return user.user.id
}
const formats:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}
// Read only ZIP directory names. No untrusted document content is decompressed.
function officeFile(bytes:Buffer,main:string){
  const end=bytes.lastIndexOf(Buffer.from([80,75,5,6]))
  if(end<0||end+22>bytes.length)return false
  let pos=bytes.readUInt32LE(end+16)
  const entries=new Set<string>()
  while(pos+46<=end&&bytes.readUInt32LE(pos)===0x02014b50){
    const size=bytes.readUInt16LE(pos+28),next=pos+46+size+bytes.readUInt16LE(pos+30)+bytes.readUInt16LE(pos+32)
    if(next>end)return false
    entries.add(bytes.toString('utf8',pos+46,pos+46+size))
    pos=next
  }
  return entries.has('[Content_Types].xml')&&entries.has(main)&&![...entries].some(n=>n.toLowerCase().endsWith('vbaproject.bin'))
}
export function fileType(bytes:Buffer,name:string){
  const ext=name.split('.').pop()?.toLowerCase()||'', mime=formats[ext]
  const prefix=bytes.subarray(0,12).toString('hex')
  let valid=false
  if(mime==='image/jpeg')valid=prefix.startsWith('ffd8ff')
  else if(ext==='png')valid=prefix.startsWith('89504e470d0a1a0a')
  else if(ext==='gif')valid=['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))
  else if(ext==='pdf')valid=bytes.toString('ascii',0,5)==='%PDF-'
  else if(ext==='docx'||ext==='xlsx')valid=officeFile(bytes,ext==='docx'?'word/document.xml':'xl/workbook.xml')
  else if(ext==='txt'||ext==='csv'){try{valid=!new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\0')}catch{}}
  if(!valid)throw problem('Choose a JPG, PNG, GIF, PDF, DOCX, XLSX, TXT or CSV file.',400)
  return mime
}
export async function saveAttachment(scope:string,owner:string,name:string,bytes:Buffer){
  if(!bytes.length||bytes.length>maxFileSize)throw problem('Choose a file up to 4 MB.',413)
  const filename=name.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g,'').slice(0,150), mime=fileType(bytes,filename)
  const id=randomUUID(), path=scope+'/'+owner+'/'+id, db=createAdminClient(),bucket=db.storage.from(fileBucket)
  const upload=await bucket.upload(path,bytes,{contentType:mime,upsert:false})
  if(upload.error)throw problem('The attachment could not be uploaded.',502)
  const {error}=await db.from('crm_text_attachments').insert({id,owner_id:owner,scope,filename,mime,object_path:path,share_token:randomBytes(18).toString('base64url')})
  if(error){await bucket.remove([path]); throw problem('The attachment could not be saved.',502)}
  return {id}
}
export async function prepareAttachment(scope:string,owner:string,id:string){
  if(!/^[\da-f]{8}-[\da-f-]{27}$/i.test(id))throw problem('Invalid attachment.',400)
  const db=createAdminClient()
  const {data,error}=await db.from('crm_text_attachments').update({published:true}).eq('id',id).eq('owner_id',owner).eq('scope',scope).gt('expires_at',new Date().toISOString()).select('id,filename,mime,object_path,share_token').maybeSingle()
  if(error||!data)throw problem('This attachment has expired or is unavailable. Choose it again.',404)
  const kind=data.mime.startsWith('image/')?'photo':'file'
  const attachment={id:data.id,name:data.filename,kind,url:'https://crm.mayerig.com/f/'+data.share_token}
  let mediaUrl=''
  if(kind==='photo'){
    const signed=await db.storage.from(fileBucket).createSignedUrl(data.object_path,2*86400)
    if(!signed.data?.signedUrl)throw problem('The photo could not be prepared.',502)
    mediaUrl=signed.data.signedUrl
  }
  return {attachment,mediaUrl}
}
