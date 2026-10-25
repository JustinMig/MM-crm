// Synthetic records; real Office scripts and agency bridge payloads.
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,until,id,doctorId,sleep,source}=require('./helpers/office-client-fixture.cjs');
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
  const {q,fill}=f,sunfire=q('[name="sunfire_code"]');
  assert.equal(sunfire.value,'SAVED-SUNFIRE');
  fill(sunfire,'UPDATED-SUNFIRE');q('[data-save-tab="coverage"]').click();
  await until(()=>q('[data-tab-save-footer="coverage"]').dataset.saving==='false');
  assert.deepEqual(f.requests.filter(x=>x.action==='save_record').at(-1).changes,{sunfire_code:'UPDATED-SUNFIRE'});
  assert.equal(f.details.medicare_details[0].part_a_date,'2015-01-01');assert.equal(f.details.medicare_details[0].medicaid_level,'QMB');
  const medicaid=q('[name="medicaid_level"]');
  assert.deepEqual([...medicaid.options].map(x=>x.value),['','None','QMB','QMB+','SLMB','SLMB+','QI','QDWI','FBDE']);
  fill(medicaid,'SLMB');q('[data-save-tab="coverage"]').click();await until(()=>q('[data-tab-save-footer="coverage"]').dataset.saving==='false');
  assert.equal(f.details.medicare_details[0].sunfire_code,'UPDATED-SUNFIRE');
  assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Copied doctors and pharmacies collapse; Add opens; tab saves retain other drafts and retry identities',async()=>{
 const f=await fixture();try{
  const {q,all,fill}=f,doctor=q('[data-kind="doctor"]'),pharmacy=q('[data-pharmacy-panel]');
  assert.equal(doctor.open,false);assert.equal(pharmacy.closest('details').open,false);
  q('[data-client-category="doctors"]').open=true;doctor.open=true;
  fill(doctor.querySelector('[name$="_phone"]'),'555-edited');fill(pharmacy.querySelector('[name="pharmacy_location"]'),'Updated City');
  q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-footer="medical"]').dataset.saving==='false');
  assert.equal(f.details.client_doctors[0].phone,'555-edited');assert.equal(f.details.client_pharmacies[0].pharmacy_location,'Updated City');assert.equal(f.details.client_pharmacies[0].pharmacy_name_2,'Second Pharmacy');
  q('[data-add-health-record="doctors"]').click();const added=all('[data-kind="doctor"]').at(-1);assert.equal(added.open,true);
  fill(added.querySelector('[name$="_doctor_name"]'),'New Doctor');q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-footer="medical"]').dataset.saving==='false');assert.equal(f.details.client_doctors.length,2);
  f.fail();fill(added.querySelector('[name$="_phone"]'),'555-retry');q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-status]').closest('[data-tab-save-footer]')&&q('[data-tab-save-footer="medical"]').dataset.saving==='false');
  assert.match(q('[data-tab-save-footer="medical"]').textContent,/Synthetic save failure/);assert.equal(added.querySelector('[name$="_phone"]').value,'555-retry');
  q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-footer="medical"]').dataset.saving==='false');assert.equal(f.details.client_doctors.length,2);
  q('[data-oc-client-tab="coverage"]').click();assert.equal(all('.oc-arctos-client-dialog details[open]').length,0);assert.deepEqual(f.errors,[]);
 }finally{f.dom.window.close();}
});
test('Policy sections have real editable records and missing reads do not render blank destructive editors',async()=>{
 const f=await fixture('platinum',{client_doctors:'Unavailable'});try{
  for(const selector of ['[name="health_carrier"]','[data-add-life-policy]','[data-add-health-record="hospital_indemnity"]','[name="retirement_carrier"]'])assert.ok(f.q(selector));
  assert.equal(f.q('[data-office-record-editor="client_doctors"]'),null);
  assert.match(f.q('[data-client-category="doctors"]').textContent,/could not load/);
  f.q('[data-add-health-record="hospital_indemnity"]').click();
  assert.ok(f.q('[name="indemnity_0_admission_benefit"]'));
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
  f.q('[data-save-tab="coverage"]').click();await until(()=>f.q('[data-tab-save-footer="coverage"]').dataset.saving==='false');
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
test('Saving an Arctos client-history note keeps unsaved medical edits on screen',async()=>{
 const f=await fixture();try{
  const {q,fill}=f,phone=q('[data-kind="doctor"] [name$="_phone"]');fill(phone,'555-draft');
  fill(q('[data-cfh-note-title]'),'Follow up');fill(q('[data-cfh-note-body]'),'Saved client note');q('[data-cfh-note-save]').click();
  await until(()=>q('[data-cfh-note-message]').textContent==='Client note saved.');assert.equal(f.details.client_notes[0].body,'Saved client note');assert.equal(phone.value,'555-draft');assert.equal(f.requests.some(x=>x.action==='save_record'),false);assert.deepEqual(f.errors,[]);
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
  fill(q('[name="sunfire_code"]'),'TAB-SAVE-SUNFIRE');fill(q('[data-protected-input="medicare_number"]'),'UPDATED-MEDICARE');
  q('[data-save-tab="coverage"]').click();await until(()=>q('[data-tab-save-footer="coverage"]').dataset.saving==='false');
  assert.equal(f.details.medicare_details[0].sunfire_code,'TAB-SAVE-SUNFIRE');assert.equal(f.secure.identifiers.medicare_number,'UPDATED-MEDICARE');
  fill(q('[data-kind="doctor"] [name$="_phone"]'),'555-tab-save');fill(q('[data-pharmacy-panel] [name="pharmacy_location"]'),'Tab Saved City');
  q('[data-save-tab="medical"]').click();await until(()=>q('[data-tab-save-footer="medical"]').dataset.saving==='false');
  assert.equal(f.details.client_doctors[0].phone,'555-tab-save');assert.equal(f.details.client_pharmacies[0].pharmacy_location,'Tab Saved City');
  fill(q('[data-cfh-note-title]'),'Follow up');fill(q('[data-cfh-note-body]'),'Tab saved note');q('[data-save-tab="files"]').click();await until(()=>q('[data-tab-save-footer="files"]').dataset.saving==='false');
  assert.equal(f.details.client_notes[0].body,'Tab saved note');assert.equal(q('[data-cfh-note-body]').value,'');
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
test('Coverage copies the Arctos category headers and retains the agency-bound editors',async()=>{
 const f=await fixture();try{
  const template=f.dom.window.document.createElement('template');template.innerHTML=f.dom.window.officeArctosCoverageMarkup;
  const panel=f.q('[data-office-arctos-coverage]');assert.ok(panel);
  for(const category of template.content.querySelectorAll('[data-client-category]')){
   const actual=panel.querySelector('[data-client-category="'+category.dataset.clientCategory+'"]');
   assert.equal(actual.querySelector(':scope > summary').outerHTML,category.querySelector(':scope > summary').outerHTML);
   assert.equal(actual.open,false);
  }
  assert.ok(panel.querySelector('[name="sunfire_code"]'));
  assert.ok(panel.querySelector('[data-health-list="hospital_indemnity"]'));
  assert.ok(panel.querySelector('[data-save-tab="coverage"]'));
 }finally{f.dom.window.close();}
});
test('Every Coverage field, option, section and document control follows the rendered Arctos template',async()=>{
 const f=await fixture('arctos',{},true,{details:{medicare_details:[],health_plans:[],life_policies:[],hospital_indemnity_plans:[],retirement_accounts:[],documents:[]}});try{
  const reference=f.w.document.createElement('div');reference.innerHTML=f.w.officeArctosCoverageMarkup;
  const shape=node=>{
   if(node.nodeType===3)return node.textContent.trim()||null;
   if(node.nodeType!==1)return null;
   return {tag:node.tagName,classes:node.className,name:node.getAttribute('name'),type:node.getAttribute('type'),placeholder:node.getAttribute('placeholder'),children:node.matches('[role=status],[data-indemnity-status]')?[]:[...node.childNodes].map(shape).filter(Boolean)};
  };
  const form=f.q('[data-office-exact-coverage]');
  assert.deepEqual([...form.childNodes].map(shape).filter(Boolean),[...reference.childNodes].map(shape).filter(Boolean));
  assert.equal(form.querySelector('.office-record-editor'),null);
  assert.equal(form.querySelector('.parity-sensitive-editor'),null);
  assert.equal(form.querySelector('input[type=date]'),null);
  assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
for(const agency of ['arctos','platinum'])test(agency+' copied Coverage saves real policy fields and preserves hidden history and other agency fields',async()=>{
 const f=await fixture(agency,{},true,{details:{hospital_indemnity_plans:[{id:doctorId,client_id:id,carrier:'Old HIP',premium:10,status:'active',ambulance_benefit:500}],retirement_accounts:[{id:'44444444-4444-4444-8444-444444444444',client_id:id,carrier:'Annuity',account_value:1000,account_type:'Existing type'}]}});try{
  const {q,fill}=f;
  fill(q('[name=part_a_date]'),'03/01/2015');fill(q('[name=health_plan_type]'),'Supplement');fill(q('[name=health_premium]'),'15');fill(q('[name=medicare_notes]'),'Updated Medicare note');fill(q('[name=indemnity_0_daily_benefit]'),'125');fill(q('[name=retirement_value]'),'2500');
  q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');
  assert.match(q('[data-tab-save-footer=coverage]').textContent,/All changes/);
  assert.equal(f.details.medicare_details[0].part_a_date,'2015-03-01');assert.equal(f.details.medicare_details[0].notes,'Updated Medicare note');
  assert.equal(f.details.health_plans[0].plan_type,'Supplement');assert.equal(f.details.health_plans[0].premium,'15');assert.equal(f.details.health_plans[0].notes,'Plan note');
  assert.equal(f.details.hospital_indemnity_plans[0].daily_benefit,'125');assert.equal(f.details.hospital_indemnity_plans[0].ambulance_benefit,500);
  assert.equal(f.details.retirement_accounts[0].account_value,'2500');assert.equal(f.details.retirement_accounts[0].account_type,'Existing type');
  assert.equal(q('[name=ssn]').value,'111-22-3333');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Copied life and HIP Add/Remove controls keep identities through failures and repeated saves',async()=>{
 const f=await fixture();try{
  const {q,fill}=f;q('[data-add-life-policy]').click();q('[data-add-health-record=hospital_indemnity]').click();
  fill(q('[name=life_policy_1_carrier]'),'Other');q('[name=life_policy_1_carrier]').dispatchEvent(new f.w.Event('change',{bubbles:true}));fill(q('[name=life_policy_1_carrier_other]'),'Custom Insurer');fill(q('[name=life_policy_1_policy_number]'),'TEST-POLICY');fill(q('[name=life_policy_1_premium]'),'42');fill(q('[name=indemnity_0_carrier]'),'HIP Insurer');
  f.fail();q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');
  assert.match(q('[data-tab-save-footer=coverage]').textContent,/Synthetic save failure/);assert.equal(q('[name=life_policy_1_premium]').value,'42');
  q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');
  assert.equal(f.details.life_policies.length,1);assert.equal(f.details.life_policies[0].carrier,'Custom Insurer');assert.ok(q('[name=life_policy_0_id]').value);assert.equal(f.details.hospital_indemnity_plans.length,1);
  q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');assert.equal(f.details.life_policies.length,1);
  q('[data-add-life-policy]').click();fill(q('[name=life_policy_1_policy_number]'),'SECOND');
  q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');assert.equal(f.details.life_policies.length,2);
  q('[data-life-policy-card][data-policy-index="1"] [data-remove-life-policy]').click();q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');assert.equal(f.details.life_policies.length,1);
  assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Coverage uses Arctos manual dates and rejects impossible dates without erasing protected identifiers',async()=>{
 const f=await fixture();try{
  f.fill(f.q('[name=part_b_date]'),'02/31/2027');f.fill(f.q('[name=medicare_number]'),'NEW-MEDICARE');f.q('[data-save-tab=coverage]').click();await until(()=>f.q('[data-tab-save-footer=coverage]').dataset.saving==='false');
  assert.match(f.q('[data-tab-save-footer=coverage]').textContent,/valid date/);assert.equal(f.details.medicare_details[0].part_b_date,'2015-02-01');assert.equal(f.secure.identifiers.medicare_number,'TEST-MEDICARE');
  f.fill(f.q('[name=part_b_date]'),'03/01/2027');f.fill(f.q('[name=medicare_gov_verification_type]'),'text');f.q('[name=medicare_gov_verification_type]').dispatchEvent(new f.w.Event('change',{bubbles:true}));f.fill(f.q('[name=medicare_gov_verification_phone]'),'555-0123');
  f.q('[data-save-tab=coverage]').click();await until(()=>f.q('[data-tab-save-footer=coverage]').dataset.saving==='false');assert.equal(f.secure.identifiers.medicare_number,'NEW-MEDICARE');assert.equal(f.secure.identifiers.medicaid_number,'TEST-MEDICAID');assert.equal(f.secure.identifiers.drivers_license_number,'TEST-LICENSE');assert.equal(f.secure.medicare_gov.verification_destination,'555-0123');
  assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Copied card uploads and existing policy files use the authorized agency file bridge',async()=>{
 const documentId='99999999-9999-4999-8999-999999999999';
 const f=await fixture('arctos',{},true,{details:{documents:[{id:documentId,client_id:id,category:'medicare_card',file_name:'Saved Card.pdf'}]}});try{
  const {q,w}=f;await until(()=>q('[data-office-coverage-view]'));q('[data-office-coverage-view]').click();await until(()=>f.opened.some(url=>url.includes('storage/v1/object/sign/')));
  const picker=q('[data-card-manager=medicare_card] [data-multi-files]');Object.defineProperty(picker,'files',{configurable:true,value:[new w.File(['synthetic PDF'],'New Card.pdf',{type:'application/pdf'})]});picker.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(q('.oc-arctos-client-dialog').officeHasUnsavedChanges(),true);
  q('[data-save-tab=coverage]').click();await until(()=>q('[data-tab-save-footer=coverage]').dataset.saving==='false');assert.equal(f.details.documents.length,2);assert.ok(f.requests.some(request=>request.action==='coverage_upload_start'));assert.ok(f.requests.some(request=>request.action==='coverage_upload_complete'));assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Coverage cannot save unloaded data and does not enable editing for a viewer',async()=>{
 const f=await fixture('arctos',{medicare_details:'Unavailable'},true,{edit:false});try{
  for(const input of f.all('[data-office-exact-coverage] input,[data-office-exact-coverage] select,[data-office-exact-coverage] textarea'))assert.equal(input.disabled,true);
  assert.equal(f.q('[data-save-tab=coverage]').disabled,true);
  await assert.rejects(f.q('.oc-arctos-client-dialog').officeSaveExactCoverage(),/not authorized/);
  assert.equal(f.requests.some(request=>request.action==='save_record'||request.action==='save_sensitive'),false);
  assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('SOA actions open the actual Arctos signing dialogs inside Office instead of redirecting to another CRM',async()=>{
 const f=await fixture('arctos',{},true);try{
  f.q('[data-text-soa]').click();await until(()=>f.q('.mh-soa-dialog'));
  assert.equal(f.q('.mh-soa-dialog h2').textContent,'Text Scope of Appointment');
  assert.ok(f.q('.mh-soa-dialog [data-appointment]'));assert.ok(f.q('.mh-soa-dialog [data-year]'));assert.equal(f.all('.mh-soa-dialog [data-product]').length,6);
  assert.equal(f.opened.length,0);assert.equal(f.requests.some(request=>request.action==='coverage_soa_request'),false);
  f.q('.mh-soa-dialog [data-cancel]').click();
  f.q('[data-sign-soa]').click();await until(()=>f.q('.mh-soa-dialog canvas'));
  assert.equal(f.q('.mh-soa-dialog h2').textContent,'Scope of Appointment');assert.ok(f.q('.mh-soa-dialog [data-soa-ack]'));
  f.q('.mh-soa-dialog [data-save]').click();
  await until(()=>f.q('.mh-soa-dialog [data-status]').textContent.length>0);
  assert.match(f.q('.mh-soa-dialog [data-status]').textContent,/acknowledgement|sign before/);
  assert.equal(f.requests.some(request=>request.action==='coverage_upload_start'),false);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('A failed identifier load cannot clear saved Medicare/Medicaid values during a Coverage save',async()=>{
 const f=await fixture('arctos',{},true,{failSecure:'identifiers'});try{
  assert.equal(f.q('[name=medicare_number]').disabled,true);assert.equal(f.q('[name=medicaid_number]').disabled,true);
  f.fill(f.q('[name=sunfire_code]'),'SAVE-OTHER-FIELD');f.q('[data-save-tab=coverage]').click();await until(()=>f.q('[data-tab-save-footer=coverage]').dataset.saving==='false');
  assert.equal(f.details.medicare_details[0].sunfire_code,'SAVE-OTHER-FIELD');assert.equal(f.secure.identifiers.medicare_number,'TEST-MEDICARE');assert.equal(f.secure.identifiers.medicaid_number,'TEST-MEDICAID');
  assert.equal(f.requests.some(request=>request.action==='save_sensitive'),false);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
