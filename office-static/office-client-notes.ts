// @ts-nocheck -- Shared by the authenticated agency Edge bridges.
const uuid=value=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(value||''));
const select='id,client_id,title,body,author_id,created_at,updated_at';
export async function officeClientNotes({sb,actor,scope,agencyActorId,log},action,data){
 const clientId=String(data.client_id||'');if(!uuid(clientId))throw Error('Invalid client');
 const query=async operation=>{const {data,error}=await operation;if(error)throw Error('The client note operation failed. Keep your text and retry.');return data;};
 const client=await query(sb.from('clients').select('id,assigned_agent_id').eq('id',clientId).maybeSingle());if(!client)throw Error('Client not found');
 if(action==='client_notes'){
  const rows=await query(sb.from('client_notes').select(select+(scope==='platinum'?',note':'')).eq('client_id',clientId).order('created_at',{ascending:false}).limit(40));
  return {notes:rows.map(row=>{const note={...row,body:row.body??row.note??''};delete note.note;return note;})};
 }
 if(!actor.permission.can_edit)throw Error('Editing is not authorized');
 const noteId=String(data.note_id||'');if(!uuid(noteId))throw Error('Invalid note');
 const stored=await query(sb.from('client_notes').select(select).eq('id',noteId).maybeSingle());if(stored&&stored.client_id!==clientId)throw Error('Note does not belong to this client');
 if(action==='delete_client_note'){
  if(!stored)return {saved:true};
  await query(sb.from('client_notes').delete().eq('id',noteId).eq('client_id',clientId));await log('delete','client_note',noteId,actor.id);return {saved:true};
 }
 if(action!=='add_client_note')throw Error('Unsupported note operation');
 const title=String(data.title||'').trim(),body=String(data.body||'').trim();if(!title||title.length>160||!body||body.length>10000)throw Error('Enter a note title up to 160 characters and note text up to 10,000 characters');
 if(stored){if(stored.title!==title||stored.body!==body)throw Error('Note ID already belongs to another note');return {saved:true,note:stored};}
 let author=agencyActorId||client.assigned_agent_id;
 if(!author){const owners=await query(sb.from('profiles').select('id').eq('active',true).eq('role','owner').limit(1));author=owners[0]?.id;}
 if(!author&&scope==='platinum')throw Error('An agency agent link is required to save a note');
 const payload={id:noteId,client_id:clientId,author_id:author||null,title,body,...(scope==='platinum'?{note:body}:{})};
 const note=await query(sb.from('client_notes').insert(payload).select(select).single());await log('create','client_note',noteId,actor.id);return {saved:true,note};
}
