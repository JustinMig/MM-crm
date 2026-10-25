// @ts-nocheck -- Shared Supabase Edge implementation; no client-side credentials.
const UUID=value=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(value||''));
const CATEGORIES=new Set(['medicare_card','medicaid_card','health_plan_card','life_policy_document','hospital_indemnity_document','soa']);
const TYPES=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']);
const SELECT='id,client_id,category,file_name,mime_type,file_size,document_date,created_at,life_policy_id,hospital_indemnity_plan_id,compliance_locked,appointment_date,coverage_year,signed_at,retention_until';
const unwrap=async promise=>{const {data,error}=await promise;if(error)throw Error('The agency file operation failed. Please retry.');return data;};
export async function officeCoverageFiles({sb,actor,scope,agencyActorId,log},action,data){
 const clientId=String(data.client_id||'');if(!UUID(clientId))throw Error('Invalid client');
 const client=await unwrap(sb.from('clients').select('id,assigned_agent_id').eq('id',clientId).maybeSingle());if(!client)throw Error('Client not found');
 const bucket=sb.storage.from(scope==='arctos'?'mh-client-documents':'platinum-client-documents');
 if(action==='coverage_documents')return {documents:await unwrap(sb.from('documents').select(SELECT).eq('client_id',clientId).order('created_at',{ascending:false}).limit(1000))};
 if(!actor.permission.can_edit)throw Error('Editing is not authorized');
 const documentId=String(data.document_id||'');if(!UUID(documentId))throw Error('Invalid document');
 const stored=await unwrap(sb.from('documents').select(SELECT+',storage_path').eq('id',documentId).maybeSingle());
 if(stored&&stored.client_id!==clientId)throw Error('Document does not belong to this client');
 if(action==='coverage_remove_document'){
  if(!stored)throw Error('Document not found');
  if(stored.compliance_locked||stored.category==='soa'||!CATEGORIES.has(stored.category))throw Error('This document is retained and cannot be removed here');
  if(!String(stored.storage_path||'').startsWith(clientId+'/'))throw Error('Invalid document location');
  await unwrap(bucket.remove([stored.storage_path]));
  await unwrap(sb.from('documents').delete().eq('id',documentId).eq('client_id',clientId));
  await log('delete','coverage_document',documentId,actor.id);return {saved:true};
 }
 const category=String(data.category||''),fileName=String(data.file_name||'').trim(),mime=String(data.mime_type||''),size=Number(data.file_size);
 if(!CATEGORIES.has(category))throw Error('Invalid document category');
 if(category==='soa'){
  const soa=data.soa||{},date=String(soa.appointment_date||'');
  if(mime!=='image/png'||!/^\d{4}-\d\d-\d\d$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||!Number.isInteger(soa.coverage_year)||soa.coverage_year<2000||soa.coverage_year>2100)throw Error('Confirm the SOA appointment and coverage year before signing');
 }
 if(!fileName||fileName.length>255||!TYPES.has(mime)||!Number.isInteger(size)||size<=0||size>25*1024*1024)throw Error('Choose a supported file of 25 MB or smaller');
 if(['medicare_card','medicaid_card','health_plan_card'].includes(category)&&!['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime))throw Error('Use a PDF or image for this card');
 const parentKey=category==='life_policy_document'?'life_policy_id':category==='hospital_indemnity_document'?'hospital_indemnity_plan_id':null;
 const parentId=parentKey?String(data.parent_id||''):null;
 if(parentKey){
  if(!UUID(parentId))throw Error('Save the policy or plan before attaching a file');
  const table=parentKey==='life_policy_id'?'life_policies':'hospital_indemnity_plans';
  if(!await unwrap(sb.from(table).select('id').eq('id',parentId).eq('client_id',clientId).maybeSingle()))throw Error('Policy or plan does not belong to this client');
 }else if(data.parent_id)throw Error('Invalid document parent');
 const folder=clientId+'/office-coverage/'+documentId,name=fileName.replace(/[^A-Za-z0-9._-]+/g,'-').slice(0,120)||'file',storagePath=folder+'/'+name;
 if(stored){
  if(stored.category!==category||stored.file_name!==fileName||Number(stored.file_size)!==size||stored.mime_type!==mime||parentKey&&stored[parentKey]!==parentId)throw Error('Document ID already belongs to another upload');
  const document={...stored};delete document.storage_path;return {saved:true,document};
 }
 if(action==='coverage_upload_start'){
  // A pending object's exact path is reused after an interrupted browser response.
  const existing=await unwrap(bucket.list(folder,{search:name,limit:2}));
  if(existing.some(file=>file.name===name))return {uploaded:true};
  const result=await unwrap(bucket.createSignedUploadUrl(storagePath,{upsert:false}));
  await log('authorize_upload','coverage_document',documentId,actor.id);return {upload_url:result.signedUrl};
 }
 if(action!=='coverage_upload_complete')throw Error('Unsupported file operation');
 const files=await unwrap(bucket.list(folder,{search:name,limit:2})),file=files.find(file=>file.name===name);
 if(!file||Number(file.metadata?.size)!==size||file.metadata?.mimetype!==mime)throw Error('The uploaded file could not be verified. Select Save Client to retry.');
 let uploader=agencyActorId||client.assigned_agent_id;
 if(!uploader){const owners=await unwrap(sb.from('profiles').select('id').eq('active',true).eq('role','owner').limit(1));uploader=owners[0]?.id;}
 if(!uploader)throw Error('An agency agent link is required to upload documents');
 const signedAt=new Date(),retention=new Date(signedAt);retention.setUTCFullYear(retention.getUTCFullYear()+10);
 const payload={id:documentId,client_id:clientId,uploaded_by:uploader,category,file_name:fileName,storage_path:storagePath,mime_type:mime,file_size:size,notes:'Uploaded through Office CRM',...(parentKey?{[parentKey]:parentId}:{}),...(category==='soa'?{document_date:signedAt.toISOString().slice(0,10),appointment_date:data.soa.appointment_date,coverage_year:data.soa.coverage_year,signed_at:signedAt.toISOString(),retention_until:retention.toISOString(),compliance_locked:true,notes:'Signed on screen through Office CRM'}:{})};
 const document=await unwrap(sb.from('documents').insert(payload).select(SELECT).single());
 await log('upload','coverage_document',documentId,actor.id);return {saved:true,document};
}
