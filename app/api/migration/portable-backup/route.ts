import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { decryptValue } from '@/lib/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RELATED = [
  'medicare_info','client_care_info','client_specialists','client_medications',
  'client_life_insurance','client_health_plan_info','client_hospital_indemnity',
  'client_banking_info','documents','client_sms_messages','crm_call_attempts',
  'crm_call_list_items','crm_outreach_campaign_members','crm_outreach_interactions',
  'medicare_commission_events','soa_signature_requests','workspace_calendar_events',
  'workspace_leads','ringcentral_calls','audit_log','audit_log_archive'
] as const
const SENSITIVE = [
 'ssn_ciphertext','drivers_license_ciphertext','medicare_number_ciphertext',
 'medicaid_number_ciphertext','medicare_gov_username_ciphertext',
 'medicare_gov_password_ciphertext','medicare_gov_secret_answer_ciphertext',
 'medicare_gov_security_code_destination_ciphertext','routing_number_ciphertext',
 'account_number_ciphertext','debit_card_number_ciphertext','member_id_ciphertext'
]
const reply = (body:unknown,status=200) => NextResponse.json(body,{status,headers:{
 'Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff'
}})
const isUuid = (x:unknown) => typeof x==='string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)
function restoreValues(rows:Record<string,unknown>[]) {
 return rows.map(item=>{
  const value={...item}
  for(const key of SENSITIVE) if(typeof value[key]==='string' && value[key]){
   value[key.replace('_ciphertext','_plaintext')]=decryptValue(value[key] as string)
   delete value[key] // Never export unusable ciphertext in place of the actual value.
  }
  return value
 })
}
function lock(data:unknown,passphrase:string){
 const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12)
 const key=crypto.pbkdf2Sync(passphrase,salt,310000,32,'sha256')
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv)
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final(),cipher.getAuthTag()])
 return {format:'mig-portable-box-v1',kdf:'pbkdf2-sha256',iterations:310000,
  salt:salt.toString('base64'),iv:iv.toString('base64'),data:encrypted.toString('base64')}
}
async function fetchRelated(admin:ReturnType<typeof createAdminClient>,table:string,ids:string[]){
 const rows:Record<string,unknown>[]=[]
 let page=0
 while(true){
  const {data,error}=await admin.from(table).select('*').in('client_id',ids)
   .order('client_id').order('id').range(page*500,page*500+499)
  if(error)throw Error('Related-table export failed: '+table)
  rows.push(...(data||[]))
  if(!data||data.length<500)break
  if(++page>=100)throw Error('Related-table page limit: '+table)
 }
 return restoreValues(rows)
}
export async function POST(req:NextRequest){
 try{
  const supabase=await createClient()
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)return reply({error:'Sign in to M&M first'},401)
  const admin=createAdminClient()
  const p=await admin.from('profiles').select('role,agency_id,active').eq('id',user.id).single()
  if(p.error||!p.data||!['owner','admin'].includes(p.data.role)||p.data.active===false||!p.data.agency_id)
   return reply({error:'Active agency owner or administrator required'},403)
  const params=await req.json(),action=String(params?.action||'')
  const agency=p.data.agency_id
  if(action==='manifest'){
   // A stable UUID inventory prevents inserts during export from shifting offsets.
   const ids:string[]=[]
   for(let offset=0;offset<100000;offset+=500){
    const page=await admin.from('clients').select('id').eq('agency_id',agency)
      .order('id').range(offset,offset+499)
    if(page.error)throw Error('Could not enumerate agency clients')
    ids.push(...(page.data||[]).map(x=>String(x.id)))
    if(!page.data||page.data.length<500)break
   }
   const d=await admin.from('documents').select('id',{head:true,count:'exact'}).eq('agency_id',agency)
   if(d.error)throw Error('Could not count agency documents')
   return reply({format:'mig-portable-v1',clients:ids.length,client_ids:ids,documents:d.count||0,
     tables:['clients',...RELATED],created_at:new Date().toISOString()})
  }
  if(action==='batch'){
   const offset=Number(params?.offset),passphrase=params?.passphrase,requested=params?.client_ids
   if(!Number.isSafeInteger(offset)||offset<0||offset>100000||
      !Array.isArray(requested)||requested.length<1||requested.length>5||
      requested.some(x=>!isUuid(x))||new Set(requested).size!==requested.length||
     typeof passphrase!=='string'||passphrase.length<16||passphrase.length>512)
    return reply({error:'Invalid client inventory or backup passphrase (16–512 characters required)'},400)
   const result=await admin.from('clients').select('*').eq('agency_id',agency)
     .in('id',requested).order('id')
   if(result.error||result.data?.length!==requested.length)
    throw Error('A source client has changed or disappeared during backup')
   const clients=restoreValues(result.data||[])
   const ids=clients.map(x=>String(x.id))
   const related:Record<string,unknown>={}
   if(ids.length)for(const table of RELATED)related[table]=await fetchRelated(admin,table,ids)
   const bundle={format:'mig-portable-data-v1',offset,clients,related}
   return reply({offset,count:clients.length,done:false,encrypted_batch:lock(bundle,passphrase),
      document_ids:(related.documents as Array<{id:string}>||[]).map(x=>x.id)})
  }
  if(action==='file-url'){
   const documentId=params?.document_id
   if(!isUuid(documentId))return reply({error:'Invalid document ID'},400)
   const d=await admin.from('documents').select('id,client_id,storage_path,file_name,mime_type')
     .eq('id',documentId).eq('agency_id',agency).maybeSingle()
   if(d.error||!d.data)return reply({error:'File does not belong to this agency'},404)
   const u=await admin.storage.from('client-documents').createSignedUrl(d.data.storage_path,120)
   if(u.error||!u.data?.signedUrl)throw Error('Could not authorize original attachment download')
   return reply({document_id:d.data.id,url:u.data.signedUrl,
     mime_type:d.data.mime_type||'application/octet-stream'})
  }
  return reply({error:'Unsupported action'},400)
 }catch(e){
  // Never put sensitive values, API keys, or decrypted payloads in an error.
  console.error('Portable backup request failed:',(e as Error)?.name||'error')
  return reply({error:'Secure export could not finish. No source records were changed.'},500)
 }
}
