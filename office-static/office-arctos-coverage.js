/* Agency data bindings for the exact rendered Arctos Coverage templates. */
(()=>{'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=value=>/^\d{4}-\d\d-\d\d/.test(value||'')?value.slice(5,7)+'/'+value.slice(8,10)+'/'+value.slice(0,4):String(value??'');
const dateISO=value=>{const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value||'').trim())||/^(\d{2})(\d{2})(\d{4})$/.exec(String(value||'').trim());if(!m)throw Error('Enter a valid date as MM/DD/YYYY.');const iso=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');if(+m[3]<1900||+m[3]>2200||!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,10)!==iso)throw Error('Enter a valid date.');return iso;};
window.officeArctosCoverageMount=modal=>{
 const panel=modal.querySelector('[data-oc-client-panel="coverage"]'),api=window.officeCrmClientBridge,current=api?.current();
 if(!panel||!current||panel.hasAttribute('data-office-exact-coverage-panel'))return;
 panel.dataset.officeArctosCoverage='';panel.dataset.officeExactCoveragePanel='';panel.classList.remove('client-form','client-four-tabs');
 panel.innerHTML='<form class="client-form client-four-tabs" data-office-exact-coverage autocomplete="off" novalidate>'+window.officeArctosCoverageMarkup+'</form>';
 const form=panel.querySelector('form'),client=current.client,details=current.details||{},errors=current.errors||{},canEdit=!!current.permissions?.edit;
 const field=name=>form.elements.namedItem(name),rows=table=>Array.isArray(details[table])?details[table]:[];
 const latest=table=>rows(table).slice().sort((a,b)=>String(b.created_at||b.updated_at||'').localeCompare(String(a.created_at||a.updated_at||'')))[0]||{};
 const groups=[],deleted=[],protectedGroups=[],baseline=new WeakMap();let removed=false,saving=false;
 const set=(input,value)=>{
  if(!input)return;
  if(input instanceof HTMLSelectElement&&value&&!Array.from(input.options).some(option=>option.value===String(value))){const option=document.createElement('option');option.value=String(value);option.textContent=String(value)+' (Existing)';input.append(option);}
  input.value=input.hasAttribute('data-date')?dateText(value):String(value??'');
 };
 const read=input=>input.value===''?null:input.hasAttribute('data-date')?dateISO(input.value):input.value;
 const identity=()=>api.current()?.id===current.id&&api.current()?.agency===current.agency&&!removed&&modal.isConnected;
 const status=(text,error=false)=>{const target=panel.querySelector('[data-tab-save-status]')||modal.querySelector('[data-office-client-error]');if(target){target.textContent=text;target.classList.toggle('error',error);}};
 function register(table,row,pairs,host){
  const group={table,row:{...row},host,pairs:pairs.map(([name,key])=>({input:typeof name==='string'?field(name):name,key})).filter(pair=>pair.input),fresh:!row.id&&!['clients','medicare_details'].includes(table)};
  for(const {input,key}of group.pairs){set(input,row[key]);baseline.set(input,input.value);if(errors[table]){input.disabled=true;input.title='This section could not load. Reopen the client before editing.';}}
  groups.push(group);return group;
 }
 const med=latest('medicare_details');
 register('medicare_details',med,[['part_a_date','part_a_date'],['part_b_date','part_b_date'],['medicaid_level','medicaid_level'],['sunfire_code','sunfire_code'],['medicare_notes','notes']],form.querySelector('[data-panel="medicare"]'));
 const health=latest('health_plans');register('health_plans',health,[['health_carrier','carrier'],['health_plan_type','plan_type'],['health_plan_id','plan_id'],['health_member_id','member_id'],['health_effective_date','effective_date'],['health_premium','premium']],field('health_carrier').closest('details'));
 const oldPairs=[['old_plan_carrier','old_plan_carrier'],['old_plan_id','old_plan_id'],['old_plan_member_id','old_plan_member_id'],['old_plan_year','old_plan_year']];
 if(current.agency==='arctos')register('clients',client,oldPairs,form.querySelector('.old-plan-details'));
 else{
  register('medicare_details',{...med,current_plan_name:med.current_plan_name||'',current_plan_member_id:med.current_plan_member_id||'',current_plan_year:med.current_plan_year||''},[['old_plan_carrier','current_plan_name'],['old_plan_member_id','current_plan_member_id'],['old_plan_year','current_plan_year']],form.querySelector('.old-plan-details'));
  field('old_plan_id').disabled=true;field('old_plan_id').title='No previous-plan ID is stored in this agency.';
 }
 const retirement=latest('retirement_accounts');register('retirement_accounts',retirement,[['retirement_carrier','carrier'],['retirement_product','product'],['retirement_contract','contract_number'],['retirement_effective_date','effective_date'],['retirement_contribution','contribution_amount'],['retirement_value','account_value'],['retirement_notes','notes']],form.querySelector('[data-panel="retirement"]'));
 function wireCard(kind,row={},index=0,fresh=false){
  const life=kind==='life',prefix=life?'life_policy':'indemnity',template=document.createElement('template');
  const templateKey=life?fresh?'lifeNew':!row.id?'lifeEmpty':index===0?'life':'lifeExtra':fresh?'indemnityNew':'indemnity';
  template.innerHTML=window.officeArctosCoverageCards[templateKey].replace(new RegExp(prefix+'_\\d+_','g'),prefix+'_'+index+'_');
  if(life)row={...row,product:row.product||row.policy_type||'',beneficiary_name:row.beneficiary_name||row.beneficiary_notes||''};
  const card=template.content.firstElementChild;card.open=fresh;card.removeAttribute('data-indemnity-document-key');
  if(life)card.dataset.policyIndex=String(index);else card.dataset.index=String(index);
  const list=form.querySelector(life?'[data-life-policy-list]':'[data-health-list="hospital_indemnity"]');list.append(card);
  const names=[...card.querySelectorAll('[name]')];
  const pairs=names.filter(input=>!input.name.endsWith('_id')&&!input.name.endsWith('_carrier_other')).map(input=>[input,input.name.slice((prefix+'_'+index+'_').length).replace(/^frequency$/,'premium_mode')]);
  const group=register(life?'life_policies':'hospital_indemnity_plans',row,pairs,card);group.fresh=!row.id;group.kind=kind;
  const idInput=card.querySelector('[name$="_id"]');idInput.value=row.id||'';
  const select=card.querySelector('select[name$="_carrier"]'),other=card.querySelector('[name$="_carrier_other"]');
  if(select&&other){
   const known=[...select.options].some(option=>option.value===row.carrier&&option.value!=='Other'&&!option.textContent.endsWith('(Existing)'));
   if(row.carrier&&!known){select.value='Other';other.value=row.carrier;}
   baseline.set(select,select.value);baseline.set(other,other.value);
  }
  const refresh=()=>{
   if(select&&other){const show=select.value==='Other';other.closest('label').style.display=show?'':'none';other.required=show;}
   const carrier=select?.value==='Other'?other?.value:card.querySelector('[name$="_carrier"]')?.value;
   const name=carrier||card.querySelector('[name$="_plan_name"]')?.value||card.querySelector('[name$="_product"]')?.value||((life?'Life Policy ':'Hospital Indemnity Plan ')+(index+1));
   card.querySelector(life?'[data-policy-title]':'[data-health-title]').textContent=name;
   const policy=card.querySelector('[name$="_policy_number"]')?.value;
   card.querySelector(life?'[data-policy-subtitle]':'summary small').textContent=policy?'Policy '+policy:life?'Click to view policy information':'Hospital indemnity plan';
  };
  card.addEventListener('input',refresh);card.addEventListener('change',refresh);refresh();
  if(errors[group.table])card.querySelectorAll('input,select,textarea,button').forEach(input=>input.disabled=true);
  if(!canEdit)card.querySelectorAll('input,select,textarea,button').forEach(input=>input.disabled=true);
  wireDocuments(card,life?'life_policy_document':'hospital_indemnity_document',()=>group.row.id||null);
  return card;
 }
 form.querySelector('[data-life-policy-list]').replaceChildren();
 const lifeRows=rows('life_policies');(lifeRows.length?lifeRows:[{}]).forEach((row,index)=>wireCard('life',row,index,false));
 form.querySelector('.life-policy-status').textContent=lifeRows.length?lifeRows.length+' saved polic'+(lifeRows.length===1?'y':'ies'):'No saved life policies yet.';
 form.querySelector('[data-health-list="hospital_indemnity"]').replaceChildren();
 rows('hospital_indemnity_plans').forEach((row,index)=>wireCard('indemnity',row,index,false));
 for(const [table,selector]of [['life_policies','[data-add-life-policy]'],['hospital_indemnity_plans','[data-add-health-record="hospital_indemnity"]']])if(errors[table])form.querySelector(selector).disabled=true;
 const syncEmpty=()=>{form.querySelector('[data-health-empty="hospital_indemnity"]').hidden=!!form.querySelector('[data-health-list="hospital_indemnity"]').children.length;};syncEmpty();
 const verification=()=>{const type=field('medicare_gov_verification_type').value;form.querySelectorAll('[data-verification-field]').forEach(el=>el.hidden=el.dataset.verificationField!==type);};
 const credentialMapping={medicare_gov_username:'username',medicare_gov_password:'password',medicare_gov_verification_type:'verification_type',medicare_gov_security_answer:'security_answer',medicare_gov_verification_phone:'verification_destination',medicare_gov_verification_email:'verification_destination'};
 for(const [kind,mapping]of [['identifiers',{medicare_number:'medicare_number',medicaid_number:'medicaid_number'}],['medicare_gov',credentialMapping]]){
  const state={kind,mapping,loaded:false,hidden:false,inputs:Object.keys(mapping).map(name=>field(name))};protectedGroups.push(state);
  state.inputs.forEach(input=>{input.disabled=true;input.dataset.protectedInput=mapping[input.name];input.value='';});
  state.load=async()=>{
   state.loaded=false;state.inputs.forEach(input=>input.disabled=true);
   try{
    if(!current.permissions?.sensitive)throw Error('Protected information is not authorized for this Office account.');
    const result=await api.request(current.agency,'secure_client',{client_id:current.id,kind});
    if(!identity()||state.hidden)return;
    const data=result.data||{};
    for(const input of state.inputs){
     const inactive=input.name.endsWith('_phone')&&data.verification_type!=='text'||input.name.endsWith('_email')&&data.verification_type!=='email';
     if(!baseline.has(input)||input.value===baseline.get(input)){set(input,inactive?'':data[mapping[input.name]]);baseline.set(input,input.value);input.dataset.initial=input.value;}
     input.disabled=!canEdit;
    }
    state.loaded=true;verification();
    if(kind==='medicare_gov')form.querySelector('[data-medicare-gov-status]').textContent='Encrypted client identifiers and Medicare.gov credentials loaded securely.';
   }catch(error){status(error.message,true);if(kind==='medicare_gov')form.querySelector('[data-medicare-gov-status]').textContent=error.message;}
  };void state.load();
 }
 form.addEventListener('change',event=>{if(event.target.name==='medicare_gov_verification_type')verification();});
 form.addEventListener('blur',event=>{if(event.target.matches('[data-date]')&&event.target.value){try{event.target.value=dateText(dateISO(event.target.value));}catch{}}},true);
 const isChanged=group=>group.pairs.some(({input})=>input.value!==baseline.get(input))||!!group.host.querySelector('[name$="_carrier_other"]')&&group.host.querySelector('[name$="_carrier_other"]').value!==baseline.get(group.host.querySelector('[name$="_carrier_other"]'));
 const meaningful=group=>group.pairs.some(({input,key})=>key!=='status'&&String(input.value||'').trim()!==''&& !input.disabled);
 async function saveGroup(group){
  if(!isChanged(group)&&!(group.fresh&&meaningful(group)))return;
  if(errors[group.table])throw Error('This section could not load. Reopen the client before editing.');
  const changes={};
  for(const {input,key}of group.pairs){
   if(input.disabled)continue;
   if(!input.checkValidity()){input.closest('details')?.setAttribute('open','');input.reportValidity();throw Error('Complete the highlighted field.');}
   if(group.fresh||input.value!==baseline.get(input))changes[key]=read(input);
  }
  const other=group.host.querySelector('[name$="_carrier_other"]');
  if(other&&group.host.querySelector('select[name$="_carrier"]').value==='Other'){
   if(!other.value.trim())throw Error('Enter the carrier name.');
   if(other.value!==baseline.get(other)||'carrier'in changes)changes.carrier=other.value.trim();
  }
  if(group.kind==='life'&&('beneficiary_name'in changes||'beneficiary_relationship'in changes)){
   const name=group.host.querySelector('[name$="_beneficiary_name"]').value,relationship=group.host.querySelector('[name$="_beneficiary_relationship"]').value;
   changes.beneficiary_notes=[name,relationship?'('+relationship+')':''].filter(Boolean).join(' ')||null;
  }
  if(!Object.keys(changes).length)return;
  if(group.table==='clients'){
   const result=await api.request(current.agency,'save_client',{client_id:current.id,changes});if(!result.saved)throw Error('Save was not confirmed.');Object.assign(client,changes);
  }else{
   if(group.fresh&&!group.row.id)group.row.id=crypto.randomUUID();
   const result=await api.request(current.agency,'save_record',{client_id:current.id,table:group.table,record_id:group.row.id||null,expected_updated_at:group.fresh?null:group.row.updated_at||null,changes});
   if(!result.saved)throw Error('Save was not confirmed.');
   Object.assign(group.row,changes,result.record||{});group.fresh=false;
   const idInput=group.host.querySelector('input[type="hidden"][name$="_id"]');if(idInput)idInput.value=group.row.id||'';
  }
  for(const {input}of group.pairs)baseline.set(input,input.value);if(other)baseline.set(other,other.value);
 }
 async function saveProtected(state){
  if(!state.loaded)return;
  const values={};const type=field('medicare_gov_verification_type').value;
  for(const input of state.inputs){
   if(input.disabled||input.value===baseline.get(input))continue;
   if(input.name.endsWith('_phone')&&type!=='text'||input.name.endsWith('_email')&&type!=='email')continue;
   if(!input.checkValidity())throw Error('Enter valid protected information.');
   values[state.mapping[input.name]]=input.value;
  }
  if(state.kind==='medicare_gov'&&'verification_type'in values)values.verification_destination=type==='text'?field('medicare_gov_verification_phone').value:type==='email'?field('medicare_gov_verification_email').value:'';
  if(Object.keys(values).length){const result=await api.request(current.agency,'save_sensitive',{client_id:current.id,kind:state.kind,values});if(!result.saved)throw Error('Protected save was not confirmed.');for(const input of state.inputs){baseline.set(input,input.value);input.dataset.initial=input.value;}}
 }
 modal.officeSaveExactCoverage=async()=>{
  if(saving)return false;if(!identity()||!canEdit)throw Error('Editing is not authorized for this client.');
  saving=true;form.inert=true;
  try{
   const lifeChanged=groups.some(group=>group.kind==='life'&&group.host.isConnected&&(isChanged(group)||group.fresh&&meaningful(group)))||deleted.some(group=>group.kind==='life');
   for(const group of groups)if(group.host.isConnected)await saveGroup(group);
   for(const item of deleted.slice()){
    const result=await api.request(current.agency,'delete_record',{client_id:current.id,table:item.table,record_id:item.row.id});if(!result.saved)throw Error('Removal was not confirmed.');deleted.splice(deleted.indexOf(item),1);
   }
   for(const state of protectedGroups)await saveProtected(state);
   await flushFiles();
   if(lifeChanged){
    const saved=groups.filter(group=>group.kind==='life'&&group.host.isConnected&&!group.fresh&&group.row.id).map(group=>group.row);
    form.querySelector('[data-life-policy-list]').replaceChildren();
    (saved.length?saved:[{}]).forEach((row,index)=>wireCard('life',row,index,false));
    form.querySelector('.life-policy-status').textContent=saved.length?saved.length+' saved polic'+(saved.length===1?'y':'ies'):'No saved life policies yet.';
   }
   return true;
  }finally{saving=false;form.inert=false;}
 };
 modal.officeExactCoverageDirty=()=>deleted.length>0||groups.some(group=>group.host.isConnected&&(isChanged(group)||group.fresh&&meaningful(group)))||protectedGroups.some(state=>state.loaded&&state.inputs.some(input=>input.value!==baseline.get(input)))||fileQueues.some(queue=>queue.host.isConnected&&queue.items.length>0);
 form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();panel.querySelector('[data-save-tab="coverage"]')?.click();});
 form.addEventListener('click',event=>{
  const addLife=event.target.closest('[data-add-life-policy]'),addHip=event.target.closest('[data-add-health-record="hospital_indemnity"]');
  if(addLife||addHip){event.preventDefault();if(!canEdit||saving)return;const life=!!addLife,index=Math.max(-1,...[...form.querySelectorAll(life?'[data-life-policy-card]':'[data-health-card]')].map(card=>Number(life?card.dataset.policyIndex:card.dataset.index)))+1;wireCard(life?'life':'indemnity',{},index,true);syncEmpty();return;}
  const remove=event.target.closest('[data-remove-life-policy],[data-remove-health-record]');
  if(remove){event.preventDefault();if(!canEdit||saving)return;const card=remove.closest('[data-life-policy-card],[data-health-card]'),group=groups.find(group=>group.host===card);if(group?.row.id&&!group.fresh&&!confirm('Remove this '+(group.kind==='life'?'life policy':'hospital indemnity plan')+' when you save the client?'))return;if(group?.row.id&&!group.fresh)deleted.push(group);card.remove();syncEmpty();}
 });
 modal.addEventListener('click',event=>{if(event.target.closest('[data-oc-client-tab]'))panel.querySelectorAll('details').forEach(el=>el.open=false);});
 const visibility=()=>{
  for(const state of protectedGroups){
   state.hidden=document.visibilityState==='hidden';
   if(state.hidden){state.inputs.forEach(input=>{input.value='';baseline.delete(input);delete input.dataset.initial;input.disabled=true;});state.loaded=false;}
   else if(identity())void state.load();
  }
 };
 document.addEventListener('visibilitychange',visibility);
 const observer=new MutationObserver(()=>{if(!modal.isConnected){removed=true;document.removeEventListener('visibilitychange',visibility);protectedGroups.forEach(state=>state.inputs.forEach(input=>{input.value='';delete input.dataset.initial;}));fileQueues.forEach(queue=>queue.items.length=0);observer.disconnect();}});observer.observe(document.body,{subtree:true,childList:true});
 form.querySelectorAll('details[open]').forEach(el=>el.open=false);
 if(!canEdit)form.querySelectorAll('input,textarea,select,button').forEach(input=>input.disabled=true);
 // Exact document controls use the agency bridge; no signed URL is cached.
 var documents=rows('documents').slice(),fileQueues=[];
 function wireDocuments(host,category,parentId=()=>null){
  const queue={host,category,parentId,items:[]};
  // Cards are built before fileQueues initializes; defer registration to the mount microtask.
  queueMicrotask(()=>{if(!removed){fileQueues.push(queue);renderFiles(queue);}});
  const pickers=host.querySelectorAll('[data-multi-files],[data-multi-camera],[data-life-policy-files],[data-life-policy-camera],[data-indemnity-files],[data-indemnity-camera]');
  for(const picker of pickers)picker.addEventListener('change',()=>{
   if(!canEdit||saving)return;
   for(const file of picker.files||[]){if(file.size>25*1024*1024){status('Files must be 25 MB or smaller.',true);continue;}queue.items.push({id:crypto.randomUUID(),file});}
   picker.value='';renderFiles(queue);
  });
 }
 function renderFiles(queue){
  const life=queue.category==='life_policy_document',hip=queue.category==='hospital_indemnity_document';
  const host=queue.host,list=host.querySelector(life?'[data-life-policy-document-list]':hip?'[data-indemnity-doc-list]':'[data-multi-list]');if(!list)return;
  const parent=queue.parentId(),saved=documents.filter(doc=>doc.category===queue.category&&(!life&&!hip||doc[life?'life_policy_id':'hospital_indemnity_plan_id']===parent));
  const rowClass=life?'life-policy-document-row':hip?'indemnity-doc-row':'multi-file-row';
  list.innerHTML=saved.map(doc=>'<article class="'+rowClass+'"><div><strong>'+esc(doc.file_name)+'</strong></div><div><button type="button" class="btn secondary" data-office-coverage-view="'+esc(doc.id)+'">View</button><button type="button" class="btn danger" data-office-coverage-remove="'+esc(doc.id)+'"'+(!canEdit?' disabled':'')+'>Remove</button></div></article>').join('')+queue.items.map(item=>'<article class="'+rowClass+' queued"><div><strong>'+esc(item.file.name)+'</strong><small>Ready to attach</small></div><button type="button" class="btn danger" data-office-coverage-unqueue="'+item.id+'">Remove</button></article>').join('');
  if(!list.children.length)list.innerHTML='<div class="'+(life?'life-policy-document-empty':hip?'indemnity-doc-empty':'multi-file-empty')+'">'+(life?parent?'No policy documents uploaded yet.':'No policy documents selected yet.':hip?'No plan documents uploaded yet.':'No files uploaded yet.')+'</div>';
  const count=host.querySelector('[data-multi-summary]');if(count)count.textContent=saved.length?saved.length+' file'+(saved.length===1?'':'s')+' saved':'No files saved';
  const message=host.querySelector('[data-life-policy-document-status],[data-indemnity-status],[data-multi-status]');
  if(message&&!queue.items.length)message.textContent=life?parent?saved.length+' policy document'+(saved.length===1?'':'s')+' stored.':'':hip?parent?saved.length+' plan document'+(saved.length===1?'':'s')+' stored.':'Files selected now will attach when this plan is saved.':saved.length+' files stored securely.';
 }
 async function flushFiles(){
  for(const queue of fileQueues){
   if(!queue.host.isConnected)continue;
   if(queue.items.length&&(queue.category==='life_policy_document'||queue.category==='hospital_indemnity_document')&&!queue.parentId())throw Error('Enter policy or plan details before attaching its files.');
   for(const item of queue.items.slice()){
    const types={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',txt:'text/plain'};
    const mime=item.file.type||types[item.file.name.toLowerCase().split('.').pop()]||'';
    const data={client_id:current.id,document_id:item.id,category:queue.category,parent_id:queue.parentId(),file_name:item.file.name,mime_type:mime,file_size:item.file.size};
    const start=await api.request(current.agency,'coverage_upload_start',data);
    if(start.upload_url){
     const url=new URL(start.upload_url),origin=current.agency==='arctos'?'https://bogusfmvdrlvxscopgaw.supabase.co':'https://sggzshbdfgkyyvxbebul.supabase.co';
     if(url.origin!==origin||!url.pathname.startsWith('/storage/v1/object/upload/sign/'))throw Error('The secure upload destination was not recognized.');
     const response=await fetch(url.href,{method:'PUT',headers:{'Content-Type':mime,'Cache-Control':'3600'},body:item.file});
     if(!response.ok)throw Error('File upload failed. Keep this record open and select Save Info to retry.');
    }
    const result=start.saved?start:await api.request(current.agency,'coverage_upload_complete',data);
    if(!result.saved)throw Error('File upload was not confirmed.');documents.push(result.document);queue.items.splice(queue.items.indexOf(item),1);renderFiles(queue);
   }
  }
 }
 for(const host of form.querySelectorAll('[data-card-manager]'))wireDocuments(host,host.dataset.cardManager);
 const removedFiles=new Set();
 void api.request(current.agency,'coverage_documents',{client_id:current.id}).then(result=>{if(identity()&&Array.isArray(result.documents)){const byId=new Map(documents.map(doc=>[doc.id,doc]));for(const doc of result.documents)byId.set(doc.id,{...byId.get(doc.id),...doc});documents=[...byId.values()].filter(doc=>!removedFiles.has(doc.id));fileQueues.forEach(renderFiles);}}).catch(error=>status('Files could not load: '+error.message,true));
 form.addEventListener('click',async event=>{
  const view=event.target.closest('[data-office-coverage-view]'),remove=event.target.closest('[data-office-coverage-remove]'),unqueue=event.target.closest('[data-office-coverage-unqueue]');
  try{
   if(view){const opened=window.open('about:blank','_blank');const result=await api.request(current.agency,'document_url',{client_id:current.id,document_id:view.dataset.officeCoverageView});if(!result.url){opened?.close();throw Error('Secure file link was not returned.');}if(opened)opened.location.replace(result.url);return;}
   if(remove&&canEdit){if(!confirm('Remove this document?'))return;const id=remove.dataset.officeCoverageRemove;await api.request(current.agency,'coverage_remove_document',{client_id:current.id,document_id:id});removedFiles.add(id);documents=documents.filter(doc=>doc.id!==id);fileQueues.forEach(renderFiles);}
   if(unqueue&&canEdit){for(const queue of fileQueues){queue.items=queue.items.filter(item=>item.id!==unqueue.dataset.officeCoverageUnqueue);renderFiles(queue);}}
  }catch(error){status(error.message,true);}
 });
 const soaDocs=documents.filter(doc=>['soa','scope_of_appointment'].includes(doc.category)),soa=soaDocs[0];
 if(soa){form.querySelector('[data-soa-summary]').textContent=soa.file_name;form.querySelector('[data-view-soa]').hidden=false;}
 window.officeArctosCoverageSoaBind?.(modal,form);
};
})();
