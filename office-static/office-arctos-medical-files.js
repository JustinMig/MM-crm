/* The actual Arctos Medical and Notes & Files UI, connected to authorized Office records. */
(()=>{'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mimeFor=file=>file.type||({pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain'})[file.name.toLowerCase().split('.').pop()]||'';
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/heic','image/heif','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']);
const humanSize=value=>{const n=Number(value||0);return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';};
window.officeArctosMedicalFilesMount=modal=>{
 const api=window.officeCrmClientBridge,current=api?.current?.();if(!current||!window.officeArctosMedicalFilesMarkup||modal.officeSaveExactMedical)return;
 const edit=!!current.permissions?.edit,details=current.details||{},errors=current.errors||{},client=current.client,baseline=new WeakMap(),groups=[],deletions=[],queues=[];
 const identity=()=>modal.isConnected&&api.current()?.id===current.id&&api.current()?.agency===current.agency;
 const request=async(action,data={},options={})=>{if(!identity())throw Error('Reopen this client before continuing.');const value=await api.request(current.agency,action,{client_id:current.id,...data},options);if(!identity())throw Error('The client record was closed. Reopen it to review the result.');return value;};
 const forms={};for(const key of ['medical','files']){
  const panel=modal.querySelector('[data-oc-client-panel="'+key+'"]');if(!panel)continue;
  panel.dataset.officeExactMedicalFilesPanel=key;
  panel.dataset.officeArctosMedicalFiles=key;panel.classList.remove('client-form','client-four-tabs');
  const form=document.createElement('form');form.className='client-form client-four-tabs';form.dataset.officeArctosMedicalFiles=key;form.autocomplete='off';form.noValidate=true;
  form.innerHTML=window.officeArctosMedicalFilesMarkup[key];form.firstElementChild.hidden=false;panel.replaceChildren(form);forms[key]=form;
  form.addEventListener('submit',event=>{event.preventDefault();modal.querySelector('[data-save-tab="'+key+'"]')?.click();});
 }
 const {medical,files}=forms;if(!medical||!files)return;
 modal.dataset.clientId=current.id;
 const status=(key,message,error=false)=>{const box=modal.querySelector('[data-tab-save-footer="'+key+'"] [data-tab-save-status]');if(box){box.textContent=message;box.classList.toggle('error',error);}};
 const controls=host=>[...host.querySelectorAll('input[name],textarea[name],select[name]')].filter(input=>input.type!=='hidden'&&input.type!=='file');
 const remember=input=>baseline.set(input,input.value);
 function register(table,row,pairs,host,fresh=false){
  const group={table,row:{...row},pairs,host,fresh};groups.push(group);
  for(const [input,key]of pairs){
   const value=row[key]??(key==='status'?'active':'');
   if(input.tagName==='SELECT'&&value&&![...input.options].some(option=>option.value===String(value))){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
   input.value=value;remember(input);if(!edit||errors[table])input.disabled=true;
  }
  if(errors[table]){const warning=document.createElement('p');warning.className='health-tab-empty';warning.setAttribute('role','alert');warning.textContent='This section could not load. Reopen the client before editing it.';host.prepend(warning);}
  return group;
 }
 const doctorNotes=medical.querySelector('[name="doctors_section_notes"]');doctorNotes.maxLength=4000;register('clients',client,[[doctorNotes,'doctors_section_notes']],doctorNotes.closest('label'));
 const pharmacy=medical.querySelector('[data-pharmacy-panel]');register('client_pharmacies',details.client_pharmacies?.[0]||{},controls(pharmacy).map(input=>[input,input.name]),pharmacy);
 const clientNote=files.querySelector('[name="notes"]');clientNote.maxLength=2000;register('clients',client,[[clientNote,'notes']],clientNote.closest('label'));
 function addCard(kind,row={},fresh=false){
  const table=kind==='doctor'?'client_doctors':'client_medications',list=medical.querySelector('[data-health-list="'+(kind==='doctor'?'doctors':'medications')+'"]');
  const index=Math.max(-1,...[...list.children].map(el=>Number(el.dataset.index)))+1,template=document.createElement('template');template.innerHTML=window.officeArctosMedicalCards[kind].replace(new RegExp(kind+'_\\d+_','g'),kind+'_'+index+'_');
  const card=template.content.firstElementChild;card.dataset.index=index;card.open=fresh;list.append(card);
  const group=register(table,row,controls(card).map(input=>[input,input.name.slice((kind+'_'+index+'_').length)]),card,fresh);group.kind=kind;group.row.id||=(fresh?crypto.randomUUID():null);card.querySelector('input[type="hidden"]').value=group.row.id||'';
  const title=()=>{card.querySelector('[data-health-title]').textContent=card.querySelector('[name$="_'+(kind==='doctor'?'doctor_name':'medication_name')+'"]').value.trim()||(kind==='doctor'?'Doctor ':'Medication ')+(index+1);};title();card.addEventListener('input',title);
  group.refresh=()=>{title();card.querySelector('summary small').textContent=kind==='doctor'?(group.row.specialty||'Doctor information'):([group.row.strength,group.row.frequency].filter(Boolean).join(' • ')||'Medication information');};group.refresh();
  if(!edit||errors[table])card.querySelectorAll('button').forEach(button=>button.disabled=true);
  if(kind==='medication')medicationUi?.prepare(card);
  refreshEmpty();return card;
 }
 let medicationUi=window.officeArctosMedicationUi({root:medical,search:async(query,signal)=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');const result=await request('medication_search',{query},{signal});if(signal?.aborted)throw new DOMException('Aborted','AbortError');return result.suggestions||[];}});
 function refreshEmpty(){for(const kind of ['doctors','medications']){const list=medical.querySelector('[data-health-list="'+kind+'"]'),empty=medical.querySelector('[data-health-empty="'+kind+'"]');empty.hidden=!!list.children.length;}}
 for(const [kind,table]of [['doctor','client_doctors'],['medication','client_medications']]){
  for(const row of details[table]||[])addCard(kind,row);
  const button=medical.querySelector('[data-add-health-record="'+(kind==='doctor'?'doctors':'medications')+'"]');button.disabled=!edit||!!errors[table];
  if(errors[table]){const empty=medical.querySelector('[data-health-empty="'+(kind==='doctor'?'doctors':'medications')+'"]');empty.textContent='This section could not load. Reopen the client before editing it.';}
 }
 medical.addEventListener('click',event=>{
  const add=event.target.closest('[data-add-health-record]'),remove=event.target.closest('[data-remove-health-record]');
  if(!edit||saving.medical)return;
  if(add&&!add.disabled){const card=addCard(add.dataset.addHealthRecord==='doctors'?'doctor':'medication',{},true);card.querySelector('input:not([type="hidden"])')?.focus();}
  if(remove&&!remove.disabled){const card=remove.closest('[data-health-card]'),group=groups.find(group=>group.host===card);if(!group)return;if(!group.fresh)deletions.push(group);card.remove();refreshEmpty();}
 });
 const notesFields=()=>[clientNote,...modal.querySelectorAll('[data-office-exact-overview] [name="notes"]')];
 modal.addEventListener('input',event=>{if(!notesFields().includes(event.target))return;for(const input of notesFields())if(input!==event.target)input.value=event.target.value;});
 modal.addEventListener('office:client-core-saved',event=>{for(const group of groups.filter(group=>group.table==='clients'))for(const [input,key]of group.pairs)if(key in event.detail.changes&&input.value===String(event.detail.changes[key]??''))remember(input);});
 const activePairs=group=>{group.pairs=group.pairs.map(([input,key])=>{const live=group.host.querySelector('[name="'+input.name+'"]');if(live&&live!==input){if(!baseline.has(live))baseline.set(live,baseline.get(input));return [live,key];}return [input,key];});return group.pairs;};
 const changed=group=>activePairs(group).some(([input])=>!input.disabled&&input.value!==baseline.get(input));
 const meaningful=group=>activePairs(group).some(([input,key])=>key!=='status'&&input.value.trim());
 const saving={medical:false,files:false};
 async function save(key){
  if(!edit||saving[key])return false;saving[key]=true;const form=forms[key];
  try{
   for(const group of groups){
    if(!group.host.isConnected||!form.contains(group.host)||!changed(group)&&!(group.fresh&&meaningful(group)))continue;
    if(errors[group.table])throw Error('Reopen the section that could not load before saving.');
    const changes={};for(const [input,field]of group.pairs)if(!input.disabled&&(group.fresh||input.value!==baseline.get(input)))changes[field]=input.value||null;
    if(!Object.keys(changes).length)continue;
    if(group.kind){const name=group.pairs.find(([,field])=>field===(group.kind==='doctor'?'doctor_name':'medication_name'))[0];if(!name.value.trim()){group.host.open=true;name.focus();throw Error('Enter the '+(group.kind==='doctor'?'doctor':'medication')+' name.');}}
    const result=await request(group.table==='clients'?'save_client':'save_record',group.table==='clients'?{changes}:{table:group.table,record_id:group.row.id||null,expected_updated_at:group.row.updated_at||null,changes});
    if(!result.saved)throw Error('Save was not confirmed. Keep the record open and retry.');
    Object.assign(group.row,changes,result.record||{});group.fresh=false;group.pairs.forEach(([input])=>remember(input));
    group.refresh?.();
    if(group.table==='clients'){Object.assign(client,changes);if('notes' in changes)for(const input of notesFields())modal.officeRememberControl?.(input);}
    else{const rows=details[group.table]||=([]),index=rows.findIndex(row=>row.id===group.row.id||group.table==='client_pharmacies'&&row.client_id===current.id);if(index<0)rows.push(group.row);else rows[index]=group.row;}
   }
   if(key==='medical')for(const group of deletions.slice()){await request('delete_record',{table:group.table,record_id:group.row.id});details[group.table]=(details[group.table]||[]).filter(row=>row.id!==group.row.id);deletions.splice(deletions.indexOf(group),1);}
   if(key==='files'&&(files.querySelector('[data-cfh-note-title]').value.trim()||files.querySelector('[data-cfh-note-body]').value.trim()))await savePendingNote();
   for(const queue of queues.filter(queue=>form.contains(queue.host)))await flush(queue);
   return true;
  }catch(error){status(key,'Save failed: '+error.message,true);return false;}
  finally{saving[key]=false;}
 }
 modal.officeSaveExactMedical=()=>save('medical');modal.officeSaveExactFiles=()=>save('files');
 modal.officeExactMedicalFilesDirty=()=>deletions.length>0||groups.some(group=>group.host.isConnected&&(changed(group)||group.fresh&&meaningful(group)))||queues.some(queue=>queue.items.length>0)||!!files.querySelector('[data-cfh-note-title]')?.value.trim()||!!files.querySelector('[data-cfh-note-body]')?.value.trim();
 // The original hub's read and note operations are explicitly adapted, never exposed as arbitrary queries.
 const noteRequests=new Map();let noteFailure=null,notePending=null;
 const asResult=task=>Promise.resolve().then(task).then(data=>({data,error:null}),error=>({data:null,error}));
 const supabase={from(table){let payload=null,removing=false,recordId=null,offset=0,limit=200;const q={select(){return q;},eq(key,value){if(key==='id')recordId=value;if(key==='client_id'&&value!==current.id)throw Error('Client scope mismatch.');return q;},order(){return q;},range(start,end){offset=start;limit=end-start+1;return q;},limit(value){limit=value;return q;},insert(value){payload=value;return q;},delete(){removing=true;return q;},then(resolve,reject){return asResult(async()=>{
  if(table==='documents'){const result=await request('client_documents',{offset,limit});return (result.documents||[]).map(row=>({...row,storage_path:row.file_available?'office-doc:'+row.id:null}));}
  if(table!=='client_notes')throw Error('Unsupported client operation.');
  if(payload){if(!edit)throw Error('Editing is not authorized');noteFailure=null;const key=JSON.stringify([payload.title,payload.body]),noteId=noteRequests.get(key)||crypto.randomUUID();noteRequests.set(key,noteId);notePending=request('add_client_note',{note_id:noteId,title:payload.title,body:payload.body}).then(result=>{if(!result.saved)throw Error('Note save was not confirmed.');noteRequests.delete(key);return result.note;}).catch(error=>{noteFailure=error;throw error;}).finally(()=>{notePending=null;});return await notePending;}
  if(removing){if(!edit)throw Error('Editing is not authorized');await request('delete_client_note',{note_id:recordId});return null;}
  const result=await request('client_notes');return result.notes||[];
 }).then(resolve,reject);}};return q;},storage:{from:()=>({createSignedUrl:path=>asResult(async()=>{if(!String(path).startsWith('office-doc:'))throw Error('Unknown client document.');const result=await request('document_url',{document_id:path.slice(11)});return {signedUrl:secureUrl(result.url)};})})}};
 files.querySelector('[data-client-files-hub]')?.remove();
 const hub=window.officeArctosFilesUi({supabase,repository:{user:{id:'office-session'}},onPreview:dialog=>previews.add(dialog)});hub.bind(modal);
 const noteButton=files.querySelector('[data-cfh-note-save]'),sourceNoteSave=noteButton.onclick;let activeNoteSave=null;
 noteButton.onclick=()=>activeNoteSave||=(Promise.resolve(sourceNoteSave()).finally(()=>{activeNoteSave=null;}));
 async function savePendingNote(){await (activeNoteSave||noteButton.onclick());if(noteFailure)throw noteFailure;if(files.querySelector('[data-cfh-note-title]').value.trim()||files.querySelector('[data-cfh-note-body]').value.trim())throw Error(files.querySelector('[data-cfh-note-message]').textContent||'Complete the note title and text.');}
 for(const tab of modal.querySelectorAll('[data-oc-client-tab]'))tab.dataset.clientGroupTab=tab.dataset.ocClientTab;
 const legacy=document.createElement('div');legacy.hidden=true;for(const category of ['medicare','life','hospital_indemnity','medications']){const button=document.createElement('button');button.type='button';button.dataset.tab=category;button.onclick=()=>{const tab=['medicare','life','hospital_indemnity'].includes(category)?'coverage':'medical';modal.querySelector('[data-oc-client-tab="'+tab+'"]').click();const section=modal.querySelector('[data-client-category="'+category+'"]');if(section){section.open=true;section.scrollIntoView?.({block:'nearest'});}};legacy.append(button);}files.append(legacy);
 function secureUrl(raw){const url=new URL(raw),origin=current.agency==='arctos'?'https://bogusfmvdrlvxscopgaw.supabase.co':'https://sggzshbdfgkyyvxbebul.supabase.co';if(url.origin!==origin||!url.pathname.startsWith('/storage/v1/object/sign/'))throw Error('Secure file destination was not recognized.');return url.href;}
 let documents=[],documentLoad=null;const previews=new Set();
 const excluded=new Set(['medicare_card','medicaid_card','health_plan_card','soa','scope_of_appointment','medicare_photo','card_information','life_policy_document','medication_document']);
 function wireFiles(host,medicalFiles){
  const queue={host,medicalFiles,items:[],busy:false};queues.push(queue);
  const picker=host.querySelector(medicalFiles?'[data-pharmacy-files]':'[data-extras-files]'),camera=host.querySelector(medicalFiles?'[data-pharmacy-camera]':'[data-extras-camera]');
  const choose=async selection=>{if(!edit||queue.busy)return;const chosen=[...selection],problems=[];for(const file of chosen){if(!allowed.has(mimeFor(file)))problems.push(file.name+': file type not allowed.');else if(file.size<=0||file.size>25*1024*1024)problems.push(file.name+': choose a nonempty file of 25 MB or smaller.');else queue.items.push({id:crypto.randomUUID(),file,category:medicalFiles?'medication_document':host.querySelector('[data-extras-category]').value});}picker.value='';camera.value='';render(queue);try{await flush(queue);if(problems.length)throw Error(problems.join(' '));}catch(error){fileStatus(queue,error.message,true);}};
  if(medicalFiles)picker.addEventListener('change',()=>void choose(picker.files));else host.querySelector('[data-extras-upload]').onclick=()=>void choose(picker.files);
  camera.addEventListener('change',()=>void choose(camera.files));
  if(!edit)host.querySelectorAll('input[type="file"],button[data-extras-upload],select').forEach(input=>input.disabled=true);
  render(queue);
 }
 function fileStatus(queue,message,error=false){const status=queue.host.querySelector(queue.medicalFiles?'[data-pharmacy-status]':'[data-extras-status]');status.textContent=message;status.classList.toggle('error',error);}
 function render(queue){
  const list=queue.host.querySelector(queue.medicalFiles?'[data-pharmacy-file-list]':'[data-extras-list]'),saved=documents.filter(doc=>queue.medicalFiles?doc.category==='medication_document':!excluded.has(String(doc.category||'').toLowerCase()));
  list.innerHTML=saved.map(doc=>'<article class="'+(queue.medicalFiles?'pharmacy-file-row':'document-row')+'"><div class="document-row-main"><strong>'+esc(doc.file_name)+'</strong><span>'+esc((queue.medicalFiles?'':String(doc.category||'extra_document').replaceAll('_',' ')+' • ')+humanSize(doc.file_size))+' • '+esc(doc.created_at?new Date(doc.created_at).toLocaleDateString():'')+'</span></div><div class="document-row-actions"><button type="button" class="btn secondary" data-office-file-view="'+esc(doc.id)+'"'+(!doc.file_available?' disabled':'')+'>View</button><button type="button" class="btn danger" data-office-file-remove="'+esc(doc.id)+'"'+(!edit||doc.compliance_locked||['soa','scope_of_appointment'].includes(doc.category)||new Date(doc.retention_until)>new Date()?' disabled':'')+'>'+(queue.medicalFiles?'Remove':'Delete')+'</button></div></article>').join('')+queue.items.map(item=>'<article class="'+(queue.medicalFiles?'pharmacy-file-row':'document-row')+' queued"><div class="document-row-main"><strong>'+esc(item.file.name)+'</strong><span>'+esc(humanSize(item.file.size))+' • ready to attach after Save Client</span></div><div class="document-row-actions"><button type="button" class="btn secondary" data-office-file-preview="'+item.id+'">View</button><button type="button" class="btn danger" data-office-file-unqueue="'+item.id+'">Remove</button></div></article>').join('');
  if(!list.children.length)list.innerHTML=queue.medicalFiles?'<div class="pharmacy-file-empty">No medication or pharmacy files uploaded yet.</div>':'<div class="document-empty"><strong>No extra documents uploaded yet.</strong><span>You can add one file or several at a time.</span></div>';
 }
 async function flush(queue){
  if(!queue.items.length)return;if(queue.busy)throw Error('A file upload is still running. Wait for it to finish, then save again.');queue.busy=true;
  try{for(const item of queue.items.slice()){
   fileStatus(queue,'Uploading '+item.file.name+'…');const data={document_id:item.id,category:item.category,file_name:item.file.name,mime_type:mimeFor(item.file),file_size:item.file.size},start=await request('coverage_upload_start',data);
   if(start.upload_url){const url=new URL(start.upload_url),origin=current.agency==='arctos'?'https://bogusfmvdrlvxscopgaw.supabase.co':'https://sggzshbdfgkyyvxbebul.supabase.co';if(url.origin!==origin||!url.pathname.startsWith('/storage/v1/object/upload/sign/'))throw Error('Secure upload destination was not recognized.');const response=await fetch(url.href,{method:'PUT',headers:{'Content-Type':data.mime_type,'Cache-Control':'3600'},body:item.file});if(!response.ok)throw Error('Upload failed. Keep this record open and select Save Client to retry.');}
   const result=start.saved?start:await request('coverage_upload_complete',data);if(!result.saved)throw Error('The file upload was not confirmed. Select Save Client to retry.');queue.items.splice(queue.items.indexOf(item),1);const record={...result.document,file_available:true};documents=documents.filter(doc=>doc.id!==record.id);documents.push(record);queues.forEach(render);modal.dispatchEvent(new CustomEvent('arctos:client-file-change'));
  }fileStatus(queue,'Files saved securely.');}finally{queue.busy=false;}
 }
 async function loadDocuments(force=false){if(documentLoad){if(force)documentsRefreshPending=true;return documentLoad;}if(documentsLoaded&&!force)return;documentLoad=(async()=>{const rows=[];for(let offset=0;offset<4000;offset+=200){const result=await request('client_documents',{offset,limit:200});rows.push(...(result.documents||[]));if(!result.documents||result.documents.length<200)break;}documents=rows;documentsLoaded=true;queues.forEach(render);})().catch(error=>{queues.forEach(queue=>fileStatus(queue,'Files could not load: '+error.message,true));}).finally(()=>{documentLoad=null;if(documentsRefreshPending){documentsRefreshPending=false;void loadDocuments(true);}});return documentLoad;}
 let documentsLoaded=false,documentsRefreshPending=false;wireFiles(pharmacy,true);wireFiles(files.querySelector('[data-notes-extras-documents]'),false);
 for(const form of [medical,files])form.addEventListener('click',async event=>{
  const view=event.target.closest('[data-office-file-view]'),remove=event.target.closest('[data-office-file-remove]'),unqueue=event.target.closest('[data-office-file-unqueue]'),preview=event.target.closest('[data-office-file-preview]');
  const queue=queues.find(queue=>queue.host.contains(event.target));if(!queue)return;
  try{
   if(view){const record=documents.find(row=>row.id===view.dataset.officeFileView),result=await request('document_url',{document_id:record.id});showPreview(record,secureUrl(result.url));}
   if(remove&&edit){const record=documents.find(row=>row.id===remove.dataset.officeFileRemove);if(!record||!confirm('Delete '+record.file_name+'? This cannot be undone.'))return;await request('client_remove_document',{document_id:record.id});documents=documents.filter(row=>row.id!==record.id);queues.forEach(render);modal.dispatchEvent(new CustomEvent('arctos:client-file-change'));}
   if(unqueue&&edit){queue.items=queue.items.filter(item=>item.id!==unqueue.dataset.officeFileUnqueue);render(queue);}
   if(preview){const item=queue.items.find(item=>item.id===preview.dataset.officeFilePreview);if(item){const url=URL.createObjectURL(item.file),dialog=showPreview({file_name:item.file.name,mime_type:mimeFor(item.file)},url);dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}}
  }catch(error){fileStatus(queue,error.message,true);}
 });
 function showPreview(record,url){hub.openFileModal(record,url);const dialog=[...document.querySelectorAll('.mh-file-preview-dialog')].at(-1);if(dialog){dialog.classList.add('office-file-preview');previews.add(dialog);}return dialog;}
 modal.addEventListener('click',event=>{if(event.target.closest('[data-oc-client-tab="files"],[data-oc-client-tab="medical"]'))void loadDocuments();});
 modal.addEventListener('arctos:client-file-change',()=>{void loadDocuments(true);});
 const readonly=()=>{if(edit)return;medical.querySelectorAll('input,textarea,select,button').forEach(input=>input.disabled=true);files.querySelectorAll('[data-cfh-note-title],[data-cfh-note-body],[data-cfh-note-save],[data-cfh-delete-note],[data-extras-files],[data-extras-camera],[data-extras-upload],[data-extras-category],[name="notes"]').forEach(input=>input.disabled=true);};
 const cleanup=new MutationObserver(()=>{if(!modal.isConnected){for(const dialog of previews){if(dialog.open)dialog.close();dialog.remove();}queues.forEach(queue=>queue.items.length=0);cleanup.disconnect();}else readonly();});cleanup.observe(document.body,{subtree:true,childList:true});readonly();
};
})();
