// @ts-nocheck -- Shared by the authenticated, agency-specific Office bridges.
export async function deleteOfficeClient({sb,actor,scope,log},data){
 if(!actor.permission.can_edit)throw Error('Deleting is not authorized');
 const id=String(data.client_id||'');
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)||data.confirmed!==true)throw Error('Confirm the client deletion first');
 const read=await sb.from('clients').select('id,assigned_agent_id,first_name,last_name,updated_at').eq('id',id).maybeSingle();
 if(read.error||!read.data)throw Error('Client not found or access denied');
 const client=read.data;
 if((client.assigned_agent_id||null)!==(data.expected_agent_id||null))throw Error('The assigned agent changed. Search again before deleting.');
 if([client.first_name,client.last_name].filter(Boolean).join(' ')!==data.expected_name)throw Error('The client changed. Search again before deleting.');
 const documents=await sb.from('documents').select('storage_path').eq('client_id',id);
 if(documents.error)throw Error('Unable to prepare client file cleanup');
 await log('delete_requested','client',id,actor.id);
 let query=sb.from('clients').delete().eq('id',id);
 query=client.updated_at?query.eq('updated_at',client.updated_at):query.is('updated_at',null);
 query=client.assigned_agent_id?query.eq('assigned_agent_id',client.assigned_agent_id):query.is('assigned_agent_id',null);
 const removed=await query.select('id');
 if(removed.error)throw Error('Unable to delete this client. No deletion was confirmed.');
 if(removed.data?.length!==1)throw Error('The client changed. Search again before deleting.');
 let warning='';
 const paths=(documents.data||[]).map(row=>row.storage_path).filter(Boolean);
 try{if(paths.length){const result=await sb.storage.from(scope==='platinum'?'platinum-client-documents':'mh-client-documents').remove(paths);if(result.error)warning='Some uploaded files could not be cleaned up.';}}catch{warning='Some uploaded files could not be cleaned up.';}
 try{await log('delete','client',id,actor.id);}catch{warning+=' The completion audit could not be recorded.';}
 return {deleted:true,client_id:id,warning:warning.trim()};
}
