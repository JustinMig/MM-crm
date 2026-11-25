// @ts-nocheck -- Runs inside the authenticated agency bridge.
const idPattern=/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const common='appointments athena_medicare_reviews calendar_event_client_links campaign_members client_completed_appointments client_doctors client_medications client_notes client_pharmacies client_review_manual client_sensitive client_sms_messages commissions communications documents health_plans hospital_indemnity_plans life_policies medicare_commission_events medicare_details medicare_intakes retirement_accounts ringcentral_calls soa_signature_requests workspace_leads';
const platinum='client_banking_vault client_contact_details client_measurements client_medicare_gov_vault medicare_reviews platinum_client_complete_import';
async function pages(build,order){
 const rows=[];
 for(let offset=0;;offset+=200){
  let query=build();
  for(const column of order.split(','))query=query.order(column);
  const {data,error}=await query.range(offset,offset+199);
  if(error)throw Error('Client backup could not read a record group.');
  rows.push(...data);
  if(data.length<200)return rows;
 }
}
export async function backupAgency({sb,scope,actor,log,officeProtected},action,data){
 if(!actor.permission.can_edit||!actor.permission.can_view_sensitive)throw Error('Full Office client access is required for backups.');
 if(action==='backup_index'){
  await log('backup','client_directory',null,actor.id);
  return {clients:await pages(()=>sb.from('clients').select('id,updated_at'),'id')};
 }
 const ids=data.ids;
 if(!Array.isArray(ids)||!ids.length||ids.length>5||!ids.every(id=>idPattern.test(id))||new Set(ids).size!==ids.length)throw Error('Invalid client backup batch.');
 if(action==='backup_identity'){
  const clients=await pages(()=>sb.from('clients').select('id,first_name,last_name,phone,assigned_agent_id').in('id',ids),'id');
  if(clients.length!==ids.length)throw Error('A client record is unavailable.');
  const agents=await pages(()=>sb.from('profiles').select('id,full_name'),'id');
  const nativeAttachments=await pages(()=>sb.from('client_sms_messages').select('id,client_id,text_attachment').in('client_id',ids).not('text_attachment','is',null),'id');
  return {clients:clients.map(c=>({...c,agent_name:agents.find(a=>a.id===c.assigned_agent_id)?.full_name})),nativeAttachments};
 }
 const clients=await pages(()=>sb.from('clients').select('*').in('id',ids),'id');
 if(clients.length!==ids.length)throw Error('The client directory changed. Start a new backup.');
 const records=Object.fromEntries(clients.map(client=>[client.id,{client,related:{},protected:{}}]));
 const orders={client_sensitive:'client_id',medicare_details:'client_id',calendar_event_client_links:'event_id',client_completed_appointments:'event_id',client_review_manual:'client_id,review_year',client_pharmacies:scope==='arctos'?'client_id':'id',client_banking_vault:'client_id',client_medicare_gov_vault:'client_id',platinum_client_complete_import:'client_id',client_contact_details:'client_id',client_import_map:'source_system,source_client_id'};
 const names=(common+' '+(scope==='platinum'?platinum+' client_import_map':'ringcentral_voicemails')).split(' ');
 for(let start=0;start<names.length;start+=6){
  await Promise.all(names.slice(start,start+6).map(async table=>{
   const key=table==='client_import_map'?'destination_client_id':'client_id';
   const rows=await pages(()=>sb.from(table).select('*').in(key,ids),orders[table]||'id');
   for(const row of rows)(records[row[key]].related[table]??=[]).push(row);
  }));
 }
 for(const record of Object.values(records)){
  const {client,related}=record;
  async function linked(table,key,values,order){
   const unique=[...new Set(values.filter(Boolean))],rows=[];
   for(let i=0;i<unique.length;i+=60)rows.push(...await pages(()=>sb.from(table).select('*').in(key,unique.slice(i,i+60)),order));
   if(rows.length)related[table]=rows;
  }
  const members=related.campaign_members||[];
  await linked('campaign_contact_log','member_id',members.map(m=>m.id),'id');
  await linked('campaigns','id',members.map(m=>m.campaign_id),'id');
  const events=[...(related.calendar_event_client_links||[]),...(related.client_completed_appointments||[])].map(e=>e.event_id);
  await linked('calendar_event_details','event_id',[...events,...(related.appointments||[]).map(e=>e.id)],'event_id');
  for(const kind of ['identifiers','banking','medicare_gov']){
   record.protected[kind]=(await officeProtected(sb,kind,client.id,actor)).data;
  }
 }
 const files=[];
 const bucket=sb.storage.from(scope==='arctos'?'mh-client-documents':'platinum-client-documents');
 for(const record of Object.values(records)){
  const docs=record.related.documents||[];
  for(let i=0;i<docs.length;i+=50){
   const chunk=docs.slice(i,i+50);
   if(chunk.some(d=>!d.storage_path?.startsWith(record.client.id+'/')))throw Error('A client document location could not be verified.');
   const {data:links,error}=await bucket.createSignedUrls(chunk.map(d=>d.storage_path),3600);
   if(error||links?.length!==chunk.length)throw Error('A client document could not be backed up.');
   chunk.forEach((d,j)=>{
    if(!links[j]?.signedUrl||links[j].error)throw Error('A client document could not be opened.');
    files.push({client_id:d.client_id,id:d.id,name:d.file_name,url:links[j].signedUrl});
   });
  }
 }
 return {records:Object.values(records),files};
}
