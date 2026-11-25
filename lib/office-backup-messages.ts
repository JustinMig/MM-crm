import {matchingLegacyClient,smsName,smsPhone} from './office-sms'

// Identity and attachment references come from the authenticated agency bridge.
export async function officeBackupMessages(db:any,agencyId:string,scope:string,identity:any){
 const byClient:Record<string,any[]>={},files:any[]=[],seenFiles=new Set<string>()
 async function read(build:()=>any){
  const rows:any[]=[]
  for(let offset=0;;offset+=250){
   const {data,error}=await build().order('id').range(offset,offset+249)
   if(error)throw Error('Could not read linked communications.')
   rows.push(...data)
   if(data.length<250)return rows
  }
 }
 async function file(client:string,id:string,bucket:string,path:string,name:string){
  const key=client+'/'+id
  if(seenFiles.has(key))return
  const {data,error}=await db.storage.from(bucket).createSignedUrl(path,3600)
  if(error||!data?.signedUrl)throw Error('A saved message attachment could not be opened.')
  files.push({client_id:client,id,url:data.signedUrl,name});seenFiles.add(key)
 }
 async function attachment(client:string,a:any){
  if(!a?.id)return
  const {data,error}=await db.from('crm_text_attachments').select('scope,filename,object_path').eq('id',a.id).maybeSingle()
  if(error||!data||![scope,'office-'+scope,'mm'].includes(data.scope))throw Error('A saved text attachment is unavailable.')
  await file(client,a.id,'crm-text-files',data.object_path,data.filename)
 }
 const agents=await read(()=>db.from('profiles').select('id,full_name').eq('agency_id',agencyId).eq('active',true))
 for(const a of identity.nativeAttachments)await attachment(a.client_id,a.text_attachment)
 const ids=identity.clients.map((c:any)=>c.id)
 const threads=await read(()=>db.from('office_sms_threads').select('*').eq('agency_id',agencyId).eq('scope',scope).in('remote_client_id',ids))
 for(const t of threads)byClient[t.remote_client_id]=await read(()=>db.from('office_sms_messages').select('*').eq('thread_id',t.id))
 const names=[...new Set<string>(identity.clients.map((c:any)=>c.agent_name).filter(Boolean))]
 for(const name of names){
  const agentsWithName=agents.filter(a=>smsName(a.full_name)===smsName(name))
  if(agentsWithName.length!==1)continue
  const candidates=(await read(()=>db.from('clients').select('id,first_name,last_name,phone').eq('agency_id',agencyId).eq('assigned_agent_id',agentsWithName[0].id))).map(c=>({...c,agent_name:name}))
  for(const c of identity.clients.filter((c:any)=>c.agent_name===name)){
   const legacy=matchingLegacyClient(c,name,candidates)
   if(!legacy)continue
   const rows=await read(()=>db.from('client_sms_messages').select('*').eq('client_id',legacy.id))
   for(const row of rows){
    if(smsPhone(row.direction==='inbound'?row.from_number:row.to_number)!==smsPhone(c.phone))continue
    for(const [i,path] of (row.media_paths||[]).entries())await file(c.id,row.id+'-'+i,'sms-photos',path,String(path).split('/').pop()||'photo')
    ;(byClient[c.id]??=[]).push(row)
   }
  }
 }
 for(const [id,rows] of Object.entries(byClient))for(const row of rows)await attachment(id,row.text_attachment)
 return {byClient,files}
}
