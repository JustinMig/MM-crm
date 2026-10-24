// Synthetic records only. Exercises the real scripts, form events, and agency save payloads.
const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../office-static',name),'utf8');
const id='11111111-1111-4111-8111-111111111111',doctorId='22222222-2222-4222-8222-222222222222';
const sleep=()=>new Promise(resolve=>setTimeout(resolve,5));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await sleep();}throw Error('Timed out waiting for UI update');}
async function fixture(agency='arctos',detailErrors={},exact=false){
 const dom=new JSDOM('<div id="office-root"></div>',{url:'https://office.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,requests=[],errors=[];
 const observers=[],NativeObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
 const nativeClose=w.close.bind(w);w.close=()=>{observers.forEach(observer=>observer.disconnect());nativeClose();};
 w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
 w.sessionStorage.setItem('office_login_session',JSON.stringify({access_token:'synthetic-session'}));
 w.confirm=()=>true;
 const client={id,assigned_agent_id:id,first_name:'Sample',last_name:'Client',phone:'555-0100',email:'sample@example.test',status:'active',products:['medicare'],date_of_birth:'1950-01-01',height_feet:6,height_inches:2,weight_lbs:200,veteran:false,smoker:false,drivers_license_state:'MS',drivers_license_expiration:'2030-01-01',notes:'Saved overview note',doctors_section_notes:'Saved doctor notes'};
 const details={medicare_details:[{client_id:id,part_a_date:'2015-01-01',part_b_date:'2015-02-01',medicaid_level:'QMB',sunfire_code:'SAVED-SUNFIRE',notes:'Saved Medicare notes'}],client_doctors:[{id:doctorId,client_id:id,doctor_name:'Sample Doctor',specialty:'Cardiology',phone:'555-0111',notes:'Saved doctor note',updated_at:'2026-01-01T00:00:00Z'}],client_pharmacies:[{client_id:id,pharmacy_name:'Sample Pharmacy',pharmacy_location:'Sample City',pharmacy_name_2:'Second Pharmacy',pharmacy_location_2:'Other City'}],client_medications:[],health_plans:[{id:'33333333-3333-4333-8333-333333333333',carrier:'Sample Health',premium:0,status:'active',notes:'Plan note'}],life_policies:[],hospital_indemnity_plans:[],retirement_accounts:[],client_notes:[],documents:[],athena_medicare_reviews:[]};
 const secure={identifiers:{ssn:'111-22-3333',medicare_number:'TEST-MEDICARE',medicaid_number:'TEST-MEDICAID',drivers_license_number:'TEST-LICENSE'},banking:{bank_name:'Test Bank',account_number:'000111',routing_number:'000222'},medicare_gov:{username:'test-user',password:'test-password'}};
 let failNext=false;
 w.fetch=async(url,options={})=>{
  const data=JSON.parse(options.body||'{}');requests.push(structuredClone(data));let result={};
  if(data.action==='session')result={permissions:{edit:true,sensitive:true},connected:true};
  else if(data.action==='search')result={clients:[client]};
  else if(data.action==='client')result={client:structuredClone(client),details:structuredClone(details),detail_errors:detailErrors};
  else if(data.action==='secure_client')result={kind:data.kind,data:structuredClone(secure[data.kind]||{})};
  else if(data.action==='save_sensitive'){Object.assign(secure[data.kind],data.values);result={saved:true};}
  else if(data.action==='save_client'){Object.assign(client,data.changes);result={saved:true};}
  else if(data.action==='add_note')result={saved:true};
  else if(data.action==='save_review_checkoff'||data.action==='add_client_to_campaign')result={saved:true};
  else if(data.action==='save_record'){
   if(failNext){failNext=false;return new Response(JSON.stringify({error:'Synthetic save failure'}),{status:400});}
   let row=(details[data.table]||[]).find(row=>data.record_id?row.id===data.record_id:row.client_id===id);
   if(!row){row={id:data.record_id||'44444444-4444-4444-8444-444444444444',client_id:id};(details[data.table]??=[]).push(row);}
   Object.assign(row,data.changes);row.updated_at=new Date().toISOString();result={saved:true,record:structuredClone(row)};
  }else if(data.action==='delete_record'){details[data.table]=details[data.table].filter(row=>row.id!==data.record_id);result={saved:true};}
  else if(data.action==='appointments')result={appointments:[]};
  else if(data.action==='campaigns')result={campaigns:[]};
  else if(data.action==='campaign_agents')result={agents:[{id,full_name:'Sample Agent'},{id:doctorId,full_name:'Second Agent'}]};
  return new Response(JSON.stringify(result));
 };
 if(exact){w.eval(source('arctos-overview-template.js'));w.eval(source('office-arctos-overview.js'));}
 w.eval(source('office-live.js'));w.eval(source('office-client-record.js'));w.eval(source('arctos-client-parity.js'));
 const q=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)];
 await until(()=>q('[data-tab="clients"]'));q('[data-tab="clients"]').click();
 q('#clientSearch').value='Sample';q('#clientSearch').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 await until(()=>q('[data-client^="'+agency+':"]'));q('[data-client^="'+agency+':"]').click();
 await until(()=>q('[data-office-record-editor="sunfire"]'));
 await until(()=>q('[data-protected-input="ssn"]')?.value==='111-22-3333');
 const fill=(element,value)=>{element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const submit=form=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return {w,dom,q,all,requests,client,details,secure,errors,fill,submit,fail:()=>failNext=true};
}
test('Actual client scripts load saved values and section saves preserve other edits',async()=>{
 const f=await fixture();try{
  const {q,all,requests,fill}=f;
  assert.equal(all('.oc-arctos-client-dialog details[open]').length,0);
  assert.equal(q('[data-protected-input="ssn"]').value,'111-22-3333');
  for(const section of ['name','demographics','contact','address','household'])assert.ok(q('.intake-section-'+section+' [data-save-overview]'));
  fill(q('.intake-section-name [name="first_name"]'),'Updated');fill(q('.intake-section-contact [name="phone"]'),'555-unsaved');
  q('.intake-section-name [data-save-overview]').click();
  await until(()=>q('.intake-section-name [data-section-status]').textContent==='Saved successfully.');
  assert.deepEqual(requests.filter(x=>x.action==='save_client').at(-1).changes,{first_name:'Updated'});
  assert.equal(q('.intake-section-contact [name="phone"]').value,'555-unsaved');
  assert.equal(q('[data-protected-input="ssn"]').value,'111-22-3333');
  assert.equal(q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),true);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Sunfire and Medicaid load and save independently without changing Medicare dates',async()=>{
 const f=await fixture();try{
  const {q,fill,submit}=f,sunfire=q('[data-office-record-editor="sunfire"]');
  assert.equal(sunfire.querySelector('[name="sunfire_code"]').value,'SAVED-SUNFIRE');
  fill(sunfire.querySelector('[name="sunfire_code"]'),'UPDATED-SUNFIRE');submit(sunfire);
  await until(()=>sunfire.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.deepEqual(f.requests.filter(x=>x.action==='save_record').at(-1).changes,{sunfire_code:'UPDATED-SUNFIRE'});
  assert.equal(f.details.medicare_details[0].part_a_date,'2015-01-01');assert.equal(f.details.medicare_details[0].medicaid_level,'QMB');
  const medicaid=q('[data-office-record-editor="medicaid"]');
  assert.deepEqual([...medicaid.querySelector('select').options].map(x=>x.value),['','None','QMB','QMB+','SLMB','SLMB+','QI','QDWI','FBDE']);
  fill(medicaid.querySelector('select'),'SLMB');submit(medicaid);await until(()=>medicaid.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.equal(f.details.medicare_details[0].sunfire_code,'UPDATED-SUNFIRE');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Doctors, medication and individual pharmacy records collapse; add opens; saves retain other drafts',async()=>{
 const f=await fixture();try{
  const {q,all,fill,submit}=f;
  assert.equal(q('[data-office-record-editor="client_doctors"]').closest('details').open,false);
  const pharmacy=q('[data-office-record-editor="client_pharmacies"]');assert.equal(pharmacy.closest('details').open,false);
  assert.equal(pharmacy.querySelectorAll('details[open]').length,0);
  q('[data-client-category="doctors"]').open=true;
  const doctor=q('[data-office-record-editor="client_doctors"]');doctor.closest('details').open=true;
  fill(doctor.querySelector('[name="phone"]'),'555-edited');submit(doctor);
  await until(()=>doctor.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.equal(f.details.client_doctors[0].phone,'555-edited');assert.equal(q('[data-client-category="doctors"]').open,true);
  fill(pharmacy.querySelector('[name="pharmacy_location"]'),'Updated City');submit(pharmacy);
  await until(()=>pharmacy.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.equal(f.details.client_pharmacies[0].pharmacy_name_2,'Second Pharmacy');
  q('[data-office-add-record="client_doctors"]').click();const added=all('[data-office-record-editor="client_doctors"]').at(-1);
  assert.equal(added.closest('details').open,true);
  fill(added.querySelector('[name="doctor_name"]'),'New Doctor');submit(added);
  await until(()=>!added.dataset.newRecord);assert.equal(f.details.client_doctors.length,2);
  f.fail();fill(added.querySelector('[name="phone"]'),'555-retry');submit(added);
  await until(()=>added.querySelector('[data-section-status]').textContent.includes('Synthetic save failure'));
  assert.equal(added.querySelector('[name="phone"]').value,'555-retry');
  submit(added);await until(()=>added.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.equal(f.details.client_doctors.length,2);
  q('[data-oc-client-tab="coverage"]').click();assert.equal(all('.oc-arctos-client-dialog details[open]').length,0);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Policy sections have real editable records and missing reads do not render blank destructive editors',async()=>{
 const f=await fixture('platinum',{client_doctors:'Unavailable'});try{
  for(const section of ['health_plans','life_policies','hospital_indemnity_plans','retirement_accounts'])assert.ok(f.q('[data-office-add-record="'+section+'"]'));
  assert.equal(f.q('[data-office-record-editor="client_doctors"]'),null);
  assert.match(f.q('[data-client-category="doctors"]').textContent,/could not load/);
  f.q('[data-office-add-record="hospital_indemnity_plans"]').click();
  assert.ok(f.q('[data-office-record-editor="hospital_indemnity_plans"] [name="ambulance_benefit"]'));
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Protected fields are cleared through direct editing, without separate clear checkboxes',async()=>{
 const f=await fixture();try{
  const ssn=f.q('[data-protected-input="ssn"]'),medicare=f.q('[data-protected-input="medicare_number"]');
  assert.equal(f.q('[data-protected-clear]'),null);
  f.fill(ssn,'999-88-7777');f.fill(medicare,'');
  assert.equal(await ssn.closest('.parity-sensitive-editor').officeSaveProtected(),true);
  assert.equal(f.secure.identifiers.ssn,'999-88-7777');assert.equal(medicare.value,'');
  assert.equal(f.secure.identifiers.medicare_number,'TEST-MEDICARE');
  assert.equal(await medicare.closest('.parity-sensitive-editor').officeSaveProtected(),true);
  assert.equal(f.secure.identifiers.medicare_number,'');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('New Client never loads the previously opened client protected values',async()=>{
 const f=await fixture();try{
  const count=f.requests.filter(r=>r.action==='secure_client').length;
  f.q('#officeNewClient').click();await until(()=>f.q('#officeNewClientForm'));
  await sleep();
  assert.equal(f.q('[data-protected-input="ssn"]').value,'');assert.equal(f.q('[data-protected-input="ssn"]').disabled,true);
  assert.equal(f.requests.filter(r=>r.action==='secure_client').length,count);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Saving an office note keeps unsaved medical edits on screen',async()=>{
 const f=await fixture();try{
  const doctor=f.q('[data-office-record-editor="client_doctors"]');f.fill(doctor.querySelector('[name="phone"]'),'unsaved-doctor-phone');
  const note=f.q('#newClientNote');f.fill(note.querySelector('[name="note"]'),'New synthetic note');f.submit(note);
  await until(()=>note.querySelector('[data-section-status]').textContent==='Saved successfully.');
  assert.equal(doctor.querySelector('[name="phone"]').value,'unsaved-doctor-phone');
  assert.equal(note.querySelector('[name="note"]').value,'');assert.equal(f.q('.office-saved-note').textContent,'New synthetic note');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Overview uses M/D/YYYY in the glance, inline agent assignment, compact personal disclosure and header checkboxes',async()=>{
 const f=await fixture();try{
  const {q,fill}=f;
  assert.match(q('[data-office-client-meta]').textContent,/DOB: 1\/1\/1950/);
  fill(q('.intake-section-contact [name="phone"]'),'555-changed');
  assert.match(q('[data-office-client-meta]').textContent,/DOB: 1\/1\/1950/);
  fill(q('[name="date_of_birth"]'),'1955-12-09');
  assert.match(q('[data-office-client-meta]').textContent,/DOB: 12\/9\/1955/);
  assert.equal(q('.client-overview-card').nextElementSibling.className,'office-assignment-inline');
  assert.ok(q('.office-assignment-inline [name="assigned_agent_id"]'));
  assert.equal(q('.arctos-personal-group [name="assigned_agent_id"]'),null);
  assert.equal(q('[data-oc-client-panel="overview"] [name="status"]'),null);
  assert.ok(q('.office-personal-compact'));
  assert.equal(q('.office-personal-compact > summary').textContent,'Personal & Contact Information');
  assert.equal(q('.office-personal-compact > summary small'),null);
  assert.equal(q('.oc-client-modal-header').nextElementSibling.className,'office-client-flags');
  assert.deepEqual(f.all('.office-client-flags label').map(el=>el.textContent.trim()),['Medicare','Life','Retirement','Deceased']);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Deceased immediately clears products and persists with the Overview bottom Save',async()=>{
 const f=await fixture();try{
  const {q}=f,deceased=q('[data-office-deceased]');
  q('[data-office-product="life"]').click();q('[data-office-product="retirement"]').click();
  deceased.click();assert.equal(deceased.checked,true);
  assert.equal(f.all('[data-office-product]').some(el=>el.checked),false);
  q('[data-save-tab="overview"]').click();
  await until(()=>q('[data-tab-save-footer="overview"] [data-tab-save-status]').textContent==='All changes in this tab are saved.');
  assert.equal(f.client.status,'deceased');assert.deepEqual(f.client.products,[]);
  q('[data-office-product="life"]').click();assert.equal(deceased.checked,false);
  q('[data-save-tab="overview"]').click();
  await until(()=>f.client.status==='active'&&q('[data-tab-save-footer="overview"]').dataset.saving==='false');
  assert.deepEqual(f.client.products,['life']);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Permanent tab Save includes closed editors, protected edits, assignment and the office note',async()=>{
 const f=await fixture();try{
  const {q,fill}=f;
  for(const key of ['overview','coverage','medical','files']){
   const footer=q('[data-tab-save-footer="'+key+'"]');
   assert.ok(footer);assert.equal(footer.closest('details'),null);assert.equal(footer.parentElement.dataset.ocClientPanel,key);
  }
  fill(q('.office-assignment-inline select'),doctorId);fill(q('.intake-section-name [name="first_name"]'),'Changed Name');fill(q('[data-protected-input="ssn"]'),'999-88-7777');
  q('[data-save-tab="overview"]').click();
  await until(()=>q('[data-tab-save-footer="overview"]').dataset.saving==='false');
  assert.equal(f.client.first_name,'Changed Name');assert.equal(f.client.assigned_agent_id,doctorId);assert.equal(f.secure.identifiers.ssn,'999-88-7777');
  fill(q('[data-office-record-editor="sunfire"] [name="sunfire_code"]'),'TAB-SAVE-SUNFIRE');fill(q('[data-protected-input="medicare_number"]'),'UPDATED-MEDICARE');
  q('[data-save-tab="coverage"]').click();await until(()=>q('[data-tab-save-footer="coverage"]').dataset.saving==='false');
  assert.equal(f.details.medicare_details[0].sunfire_code,'TAB-SAVE-SUNFIRE');assert.equal(f.secure.identifiers.medicare_number,'UPDATED-MEDICARE');
  fill(q('[data-office-record-editor="client_doctors"] [name="phone"]'),'555-tab-save');fill(q('[data-office-record-editor="client_pharmacies"] [name="pharmacy_location"]'),'Tab Saved City');
  q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-footer="medical"]').dataset.saving==='false');
  assert.equal(f.details.client_doctors[0].phone,'555-tab-save');assert.equal(f.details.client_pharmacies[0].pharmacy_location,'Tab Saved City');
  fill(q('#newClientNote [name="note"]'),'Tab saved note');q('[data-save-tab="files"]').click();await until(()=>q('[data-tab-save-footer="files"]').dataset.saving==='false');
  assert.equal(q('.office-saved-note').textContent,'Tab saved note');assert.equal(q('#newClientNote [name="note"]').value,'');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
for(const agency of ['arctos','platinum'])test(agency+' uses the copied Arctos Overview with secure editable values and typed saves',async()=>{
 const f=await fixture(agency,{},true);try{
  const {q,fill}=f,form=q('[data-office-exact-overview]');
  assert.ok(form);assert.equal(q('.office-client-flags'),null);assert.equal(q('.office-personal-compact'),null);
  assert.deepEqual([...form.querySelectorAll('[data-panel=information] > details > summary')].map(el=>el.textContent),['Personal & Contact Information','Driver’s License Identification','Banking Information']);
  assert.deepEqual([...form.querySelectorAll('.product-choices label')].map(el=>el.textContent.trim()),['Medicare','Life','Retirement','Deceased']);
  assert.match(q('[data-client-summary-meta]').textContent,/DOB: 01\/01\/1950/);
  assert.equal(q('[name=license_number]').value,'TEST-LICENSE');
  assert.equal(q('[name=banking_payment_method]').value,'bank');assert.equal(q('[name=banking_account_number]').value,'000111');
  assert.equal(q('[data-banking-panel=bank]').hidden,false);assert.equal(q('[data-banking-panel=card]').hidden,true);
  assert.equal(q('[data-oc-client-panel=overview] details[open]'),null);
  fill(q('[name=first_name]'),'Copied');fill(q('[name=date_of_birth]'),'12/09/1955');fill(q('[name=address]'),'123 Test St');fill(q('[name=zip]'),'12345');fill(q('[name=license_expiration]'),'12/31/2030');fill(q('[name=ssn]'),'999-88-7777');fill(q('[name=banking_account_number]'),'NEW-ACCOUNT');fill(q('[data-client-glance-note]'),'Updated overview note');
  q('[data-save-tab=overview]').click();await until(()=>q('[data-tab-save-footer=overview]').dataset.saving==='false');
  assert.match(q('[data-tab-save-status]').textContent,/All changes/);
  assert.equal(f.client.date_of_birth,'1955-12-09');assert.equal(f.client.address1,'123 Test St');assert.equal(f.client.zip_code,'12345');assert.equal(f.client.drivers_license_expiration,'2030-12-31');assert.equal(f.client.notes,'Updated overview note');assert.equal(f.secure.identifiers.ssn,'999-88-7777');assert.equal(f.secure.banking.account_number,'NEW-ACCOUNT');
  q('[data-office-deceased]').click();assert.equal(f.all('[data-office-product]').some(el=>el.checked),false);
  q('[data-save-tab=overview]').click();await until(()=>f.client.status==='deceased');assert.deepEqual(f.client.products,[]);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Copied banking saves only selected method changes and never sends CVV or erases a saved card',async()=>{
 const f=await fixture('arctos',{},true);try{
  const {q,fill}=f;fill(q('[name=banking_payment_method]'),'card');q('[name=banking_payment_method]').dispatchEvent(new f.w.Event('change',{bubbles:true}));
  fill(q('[name=banking_card_expiration]'),'12/29');fill(q('[name=banking_cvv]'),'123');
  q('[data-save-tab=overview]').click();await until(()=>q('[data-tab-save-footer=overview]').dataset.saving==='false');
  const saved=f.requests.filter(r=>r.action==='save_sensitive'&&r.kind==='banking').at(-1);
  assert.deepEqual(saved.values,{payment_method:'card',card_expiration:'12/29'});assert.equal(q('[data-banking-panel=card]').hidden,false);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Copied dates reject impossible dates before writing; review checkoff uses the authorized bridge',async()=>{
 const f=await fixture('arctos',{},true);try{
  const {q,fill}=f;fill(q('[name=date_of_birth]'),'02/31/1955');q('[data-save-tab=overview]').click();await until(()=>q('[data-tab-save-footer=overview]').dataset.saving==='false');
  assert.match(q('[data-tab-save-status]').textContent,/could not save/);assert.equal(f.client.date_of_birth,'1950-01-01');
  q('[data-client-review-manual]').click();await until(()=>f.requests.some(r=>r.action==='save_review_checkoff'));
  assert.equal(f.requests.find(r=>r.action==='save_review_checkoff').completed,true);
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Rendered Overview preserves the generated Arctos DOM structure rather than the old Office layout',async()=>{
 const f=await fixture('arctos',{},true);try{
  const reference=f.w.document.createElement('div');reference.innerHTML=f.w.officeArctosOverviewMarkup;
  const shape=node=>{
   if(node.nodeType===3)return node.textContent.trim()||null;
   if(node.nodeType!==1||node.matches('[data-client-athena]'))return null;
   const dynamic=node.matches('[data-client-summary-name],[data-client-summary-meta],[data-client-review-status],[role=status]');
   return {tag:node.tagName,classes:node.className,children:dynamic?[]:[...node.childNodes].map(shape).filter(Boolean)};
  };
  const actual=f.q('[data-office-exact-overview]');
  assert.deepEqual([...actual.childNodes].map(shape).filter(Boolean),[...reference.childNodes].map(shape).filter(Boolean));
 }finally{f.dom.window.close();}
});
