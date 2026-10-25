const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,doctorId,sleep}=require('./helpers/office-client-fixture.cjs');
const save=async(f,key)=>{f.q('[data-save-tab="'+key+'"]').click();await until(()=>f.q('[data-tab-save-footer="'+key+'"]').dataset.saving==='false');};
const open=async(f,key)=>{f.q('[data-oc-client-tab="'+key+'"]').click();await until(()=>!f.q('[data-oc-client-panel="'+key+'"]').hidden);};
test('Both copied tabs retain every Arctos field, option, heading and file-hub control',async()=>{
 const f=await fixture('arctos',{},true,{details:{client_doctors:[],client_medications:[]}});try{
  const shape=host=>[...host.querySelectorAll('h3,summary,input,select,textarea,button')].filter(el=>!el.matches('button[data-tab],button[data-save-tab]')).map(el=>[el.tagName,el.name||'',el.type||'',el.matches('h3,summary,button')?el.textContent.replace(/\s+/g,' ').trim():el.closest('label')?.querySelector('span')?.textContent?.trim()||'',el.tagName==='SELECT'?[...el.options].map(o=>[o.value,o.textContent]):null]);
  for(const key of ['medical','files']){const ref=f.w.document.createElement('div');ref.innerHTML=f.w.officeArctosMedicalFilesMarkup[key];assert.deepEqual(shape(f.q('[data-office-arctos-medical-files="'+key+'"]')),shape(ref));}
  assert.equal(f.q('[data-office-arctos-medical-files] .office-record-editor'),null);assert.equal(f.q('[data-office-arctos-medical-files] #newClientNote'),null);
  assert.equal(f.q('[data-save-tab="medical"]').textContent,'Save Info');assert.equal(f.q('[data-save-tab="files"]').textContent,'Save Info');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
for(const agency of ['arctos','platinum'])test(agency+' saves the copied doctor, medication, pharmacy and section-note fields without replacing other records',async()=>{
 const f=await fixture(agency,{},true);try{
  assert.equal(f.q('[data-kind="doctor"] summary small').textContent,'Cardiology');
  f.fill(f.q('[name="doctor_0_phone"]'),'555-updated');f.fill(f.q('[name="doctors_section_notes"]'),'Updated section notes');f.fill(f.q('[name="pharmacy_location_2"]'),'Second Location Updated');
  f.q('[data-add-health-record="medications"]').click();const card=f.q('[data-kind="medication"]');assert.equal(card.open,true);f.fill(card.querySelector('[name$="_medication_name"]'),'Manual drug');f.fill(card.querySelector('[name$="_strength"]'),'10 mg');f.fill(card.querySelector('[name$="_dosage"]'),'One tablet daily');await save(f,'medical');
  assert.equal(f.details.client_doctors[0].phone,'555-updated');assert.equal(f.details.client_doctors[0].specialty,'Cardiology');assert.equal(f.details.client_pharmacies[0].pharmacy_name,'Sample Pharmacy');assert.equal(f.details.client_pharmacies[0].pharmacy_location_2,'Second Location Updated');assert.equal(f.client.doctors_section_notes,'Updated section notes');assert.equal(f.details.client_medications[0].dosage,'One tablet daily');assert.equal(f.details.client_medications[0].status,'active');
  const writes=f.requests.filter(r=>r.action==='save_record');assert.deepEqual(writes.find(r=>r.table==='client_doctors').changes,{phone:'555-updated'});assert.deepEqual(writes.find(r=>r.table==='client_pharmacies').changes,{pharmacy_location_2:'Second Location Updated'});assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Provider removals wait for Save, and a failed new record retries with the same identity',async()=>{
 const f=await fixture();try{
  f.q('[data-kind="doctor"] [data-remove-health-record]').click();assert.equal(f.details.client_doctors.length,1);assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),true);
  f.q('[data-add-health-record="doctors"]').click();f.fill(f.q('[name="doctor_0_doctor_name"]'),'New Provider');f.fail();await save(f,'medical');assert.match(f.q('[data-tab-save-footer="medical"]').textContent,/Synthetic save failure/);assert.equal(f.details.client_doctors.length,1);
  const attempt=f.requests.filter(r=>r.action==='save_record').at(-1);await save(f,'medical');assert.equal(f.requests.filter(r=>r.action==='save_record').at(-1).record_id,attempt.record_id);assert.equal(f.details.client_doctors.length,1);assert.equal(f.details.client_doctors[0].doctor_name,'New Provider');assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),false);
 }finally{f.w.close();}
});
test('General client notes stay synchronized with Overview and either Save keeps the other tab clean',async()=>{
 const f=await fixture('arctos',{},true);try{
  const files=f.q('[data-office-arctos-medical-files="files"] [name="notes"]'),overview=f.q('[data-client-glance-note]');assert.equal(files.value,'Saved overview note');
  f.fill(files,'Shared note from files');assert.equal(overview.value,'Shared note from files');await save(f,'files');assert.equal(f.client.notes,'Shared note from files');assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),false);
  f.fill(overview,'Shared note from overview');assert.equal(files.value,'Shared note from overview');await save(f,'overview');assert.equal(f.client.notes,'Shared note from overview');assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),false);
 }finally{f.w.close();}
});
test('Saved-note history supports titles, complete text, permanent-tab Save, failure recovery and deletion',async()=>{
 const f=await fixture('platinum',{},true);try{
  await open(f,'files');f.fill(f.q('[data-cfh-note-title]'),'Review');f.fill(f.q('[data-cfh-note-body]'),'Full saved note text');f.failAction('add_client_note');await save(f,'files');
  assert.equal(f.q('[data-cfh-note-body]').value,'Full saved note text');assert.match(f.q('[data-tab-save-footer="files"]').textContent,/Synthetic add_client_note failure/);const first=f.requests.filter(r=>r.action==='add_client_note').at(-1);await save(f,'files');
  assert.equal(f.requests.filter(r=>r.action==='add_client_note').at(-1).note_id,first.note_id);assert.equal(f.details.client_notes.length,1);assert.equal(f.q('[data-cfh-note-body]').value,'');assert.match(f.q('[data-cfh-notes-list]').textContent,/Full saved note text/);
  f.q('[data-cfh-delete-note]').click();await until(()=>f.details.client_notes.length===0);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('File hub loads every category across pages, filters and searches locally, and opens the original in-site preview',async()=>{
 const docs=Array.from({length:205},(_,i)=>({id:i===0?doctorId:('00000000-0000-4000-8000-'+String(i).padStart(12,'0')),client_id:id,file_name:i===0?'Medication list.pdf':'Document '+i+'.pdf',category:i===0?'medication_document':i===1?'life_insurance':'extra_document',file_size:1024,mime_type:'application/pdf',file_available:true,created_at:'2026-10-01T12:00:00Z'}));
 const f=await fixture('arctos',{},true,{details:{documents:docs}});try{
  await open(f,'files');await until(()=>f.q('[data-cfh-status]').textContent==='205 files available.');assert.ok(f.requests.some(r=>r.action==='client_documents'&&r.offset===200));
  const before=f.requests.length;f.q('[data-cfh-filter="medical"]').click();assert.equal(f.all('[data-cfh-file]').length,1);f.fill(f.q('[data-cfh-search]'),'Medication');assert.equal(f.all('[data-cfh-file]').length,1);assert.equal(f.requests.length,before);assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),false);
  f.q('[data-cfh-view]').click();await until(()=>f.q('.mh-file-preview-dialog'));assert.equal(f.q('.mh-file-preview-dialog').open,true);assert.match(f.q('.mh-file-preview-dialog iframe').src,/bogusfmvdrlvxscopgaw/);assert.equal(f.requests.filter(r=>r.action==='document_url').at(-1).document_id,doctorId);f.q('[data-cfh-close]').click();assert.equal(f.q('.mh-file-preview-dialog'),null);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Pharmacy and general uploads preserve the selected category, recover failures, and refresh the shared index',async()=>{
 const f=await fixture('platinum',{},true);try{
  await open(f,'medical');const picker=f.q('[data-pharmacy-files]');const file=new f.w.File(['sample'],'Medication list.txt',{type:'text/plain'});Object.defineProperty(picker,'files',{value:[file],configurable:true});f.failAction('coverage_upload_complete');picker.dispatchEvent(new f.w.Event('change',{bubbles:true}));
  await until(()=>f.q('[data-pharmacy-status]').textContent.includes('Synthetic coverage_upload_complete failure'));assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),true);const first=f.requests.filter(r=>r.action==='coverage_upload_complete').at(-1);await save(f,'medical');assert.equal(f.requests.filter(r=>r.action==='coverage_upload_complete').at(-1).document_id,first.document_id);assert.equal(f.details.documents.length,1);assert.equal(f.details.documents[0].category,'medication_document');
  await open(f,'files');await until(()=>f.q('[data-cfh-status]').textContent==='1 file available.');f.fill(f.q('[data-extras-category]'),'application');const general=f.q('[data-extras-files]');Object.defineProperty(general,'files',{value:[new f.w.File(['sample'],'Application.pdf',{type:'application/pdf'})],configurable:true});f.q('[data-extras-upload]').click();await until(()=>f.details.documents.length===2);assert.equal(f.details.documents[1].category,'application');await until(()=>f.q('[data-cfh-status]').textContent==='2 files available.');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Failed medical reads disable the affected Add control without erasing saved fields in other sections',async()=>{
 const f=await fixture('platinum',{client_doctors:'Unavailable'},true);try{
  assert.equal(f.q('[data-add-health-record="doctors"]').disabled,true);f.fill(f.q('[name="pharmacy_location"]'),'Still Editable');await save(f,'medical');assert.equal(f.details.client_pharmacies[0].pharmacy_location,'Still Editable');assert.equal(f.requests.some(r=>r.table==='client_doctors'&&(r.action==='save_record'||r.action==='delete_record')),false);
 }finally{f.w.close();}
});
test('Viewers can search and preview files while all medical, note and upload mutations stay disabled',async()=>{
 const f=await fixture('arctos',{},true,{edit:false,details:{client_notes:[{id:doctorId,title:'Saved note',body:'Read only',created_at:'2026-10-01T12:00:00Z'}]}});try{
  await open(f,'files');await until(()=>f.q('[data-cfh-delete-note]')?.disabled);assert.equal(f.q('[data-cfh-search]').disabled,false);for(const selector of ['[name="doctor_0_phone"]','[name="pharmacy_name"]','[data-add-health-record="medications"]','[data-cfh-note-save]','[data-extras-upload]','[data-save-tab="files"]'])assert.equal(f.q(selector).disabled,true,selector);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Original medication suggestions provide dosage choices and retain manual entry',async()=>{
 const f=await fixture();try{
  f.q('[data-add-health-record="medications"]').click();const name=f.q('[name="medication_0_medication_name"]');f.fill(name,'Sam');await until(()=>f.q('.medication-autocomplete-option'));f.q('.medication-autocomplete-option').click();assert.equal(name.value,'Sample Medication');const strength=f.q('[name="medication_0_strength"]');assert.equal(strength.tagName,'SELECT');assert.deepEqual([...strength.options].map(o=>o.value),['','10 mg tablet','20 mg tablet','__manual__']);strength.value='__manual__';strength.dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.q('[name="medication_0_strength"]').tagName,'INPUT');assert.equal(f.q('[name="medication_0_dosage"]').closest('label').querySelector('span').textContent,'How Taken / Directions');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Suggested dosage selections and replacement manual inputs both reach the saved medication record',async()=>{
 const f=await fixture();try{
  f.q('[data-add-health-record="medications"]').click();f.fill(f.q('[name="medication_0_medication_name"]'),'Sam');await until(()=>f.q('.medication-autocomplete-option'));f.q('.medication-autocomplete-option').click();const select=f.q('[name="medication_0_strength"]');select.value='20 mg tablet';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));await save(f,'medical');assert.equal(f.details.client_medications[0].strength,'20 mg tablet');assert.equal(f.q('[data-kind="medication"] summary small').textContent,'20 mg tablet');
  select.value='__manual__';select.dispatchEvent(new f.w.Event('change',{bubbles:true}));f.fill(f.q('[name="medication_0_strength"]'),'15 mg capsule');await save(f,'medical');assert.equal(f.details.client_medications[0].strength,'15 mg capsule');assert.equal(f.details.client_medications.length,1);assert.equal(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),false);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
