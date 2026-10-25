/* Section editors for the Office client record. All writes use the authorized agency bridge. */
(()=>{'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fields={
 medicare_details:[['part_a_date','Part A Date','date'],['part_b_date','Part B Date','date'],['notes','Medicare Notes','textarea']],
 sunfire:[['sunfire_code','Sunfire Code']],
 health_plans:[['carrier','Carrier / Original Medicare'],['plan_name','Plan Name'],['plan_type','Plan Type',['','Supplement','Medicare Advantage','Original Medicare','Prescription Drug Plan']],['plan_id','Plan ID'],['member_id','Member ID'],['effective_date','Effective Date','date'],['termination_date','Termination Date','date'],['premium','Monthly Premium','number'],['status','Status',['active','inactive']],['notes','Health Plan Notes','textarea']],
 life_policies:[['carrier','Carrier'],['product','Product',['','Term','Whole Life','Final Expense','Universal Life','Indexed Universal Life']],['policy_type','Policy Type'],['policy_number','Policy Number'],['face_amount','Face Amount','number'],['premium','Premium','number'],['premium_mode','Premium Frequency',['','Monthly','Quarterly','Semiannual','Annual']],['effective_date','Effective Date','date'],['expiration_date','Expiration Date','date'],['beneficiary_name','Beneficiary Name'],['beneficiary_relationship','Beneficiary Relationship'],['beneficiary_notes','Beneficiary Notes','textarea'],['status','Status',['active','inactive']],['notes','Life Notes','textarea']],
 hospital_indemnity_plans:[['carrier','Carrier'],['plan_name','Plan Name'],['policy_number','Policy Number'],['member_id','Member ID'],['effective_date','Effective Date','date'],['premium','Monthly Premium','number'],['admission_benefit','Hospital Admission Benefit','number'],['daily_benefit','Daily Hospital Benefit','number'],['benefit_days','Benefit Days','number'],['status','Status',['active','inactive']],['notes','Hospital Indemnity Notes','textarea']],
 retirement_accounts:[['carrier','Carrier / Institution'],['product','Product'],['contract_number','Contract Number'],['account_type','Account Type'],['contribution_amount','Contribution','number'],['contribution_frequency','Contribution Frequency'],['account_value','Account Value','number'],['effective_date','Effective Date','date'],['status','Status',['active','inactive']],['notes','Retirement Notes','textarea']],
 client_doctors:[['doctor_name','Doctor Name','required'],['specialty','Specialty',['','Primary Care Physician','Family Medicine','Internal Medicine','Cardiology','Neurology','Urology','Optometry','Ophthalmology','Dentistry','Orthopedics','Pulmonology','Gastroenterology','Endocrinology','Nephrology','Rheumatology','Dermatology','Oncology','Hematology','Psychiatry','Pain Management','ENT / Otolaryngology','Podiatry','General Surgery','Vascular Surgery','Allergy & Immunology','Infectious Disease','OB/GYN','Other / Not Listed']],['practice_name','Practice / Facility'],['phone','Phone','tel'],['fax','Fax','tel'],['address','Address'],['city','City'],['state','State'],['zip_code','ZIP Code'],['notes','Doctor Notes','textarea']],
 client_medications:[['medication_name','Medication','required'],['strength','Strength'],['dosage','Dosage'],['frequency','Frequency'],['prescribing_doctor','Prescribing Doctor'],['purpose','Purpose / Condition'],['status','Status',['active','inactive']],['notes','Medication Notes','textarea']],
 client_pharmacies:[['pharmacy_name','Primary Pharmacy'],['pharmacy_location','Primary Pharmacy Location'],['pharmacy_name_2','Second Pharmacy'],['pharmacy_location_2','Second Pharmacy Location'],['medication_notes','Medication / Pharmacy Notes','textarea']]
};
const labels={health_plans:'Health Plan',life_policies:'Life Policy',hospital_indemnity_plans:'Hospital Indemnity Plan',retirement_accounts:'Retirement Account',client_doctors:'Doctor',client_medications:'Medication'};
const levels=['','None','QMB','QMB+','SLMB','SLMB+','QI','QDWI','FBDE'];
const input=(key,label,type='text',value='')=>{
 value=value??'';
 let control;
 if(Array.isArray(type)){
  const choices=type.map(item=>Array.isArray(item)?item:[item,item||'Select…']);
  if(value&&!choices.some(([v])=>String(v)===String(value)))choices.push([value,value+' (saved)']);
  control='<select name="'+key+'">'+choices.map(([v,l])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(l)+'</option>').join('')+'</select>';
 }else if(type==='textarea')control='<textarea name="'+key+'" rows="4" maxlength="4000">'+esc(value)+'</textarea>';
 else control='<input name="'+key+'" type="'+(type==='required'?'text':type)+'" value="'+esc(value)+'"'+(type==='required'?' required':'')+(type==='number'?' min="0" step="'+(key==='benefit_days'?'1':'0.01')+'"':' maxlength="500"')+'>';
 return '<label class="field oc-client-field"><span>'+esc(label)+'</span>'+control+'</label>';
};
const footer=label=>'<div class="office-section-actions"><span data-section-status role="status" aria-live="polite"></span><button class="primary" type="submit">Save '+esc(label)+'</button></div>';
const group=(title,body,cls='')=>'<details class="field-group parity-subsection '+cls+'"><summary>'+esc(title)+'</summary><div class="form-grid">'+body+'</div></details>';
const tableFor=kind=>kind==='sunfire'||kind==='medicaid'?'medicare_details':kind;
function editor(kind,row={},label,options={}){
 const schema=kind==='medicaid'?[['medicaid_level','Medicaid Level',levels]]:fields[kind];
 let content=schema.map(([key,title,type])=>input(key,title,type,row[key]??(key==='status'?'active':''))).join('');
 if(kind==='client_pharmacies')content=
  group(row.pharmacy_name||'Primary Pharmacy',schema.slice(0,2).map(([k,l,t])=>input(k,l,t,row[k])).join(''))+
  group(row.pharmacy_name_2||'Second Pharmacy',schema.slice(2,4).map(([k,l,t])=>input(k,l,t,row[k])).join(''))+
  group('Medication / Pharmacy Notes',input('medication_notes','Medication / Pharmacy Notes','textarea',row.medication_notes));
 return '<form class="office-record-editor" data-office-record-editor="'+kind+'" data-record-id="'+esc(row.id||(options.fresh?crypto.randomUUID():''))+'" data-record-version="'+esc(row.updated_at||'')+'"'+(options.fresh?' data-new-record="true"':'')+' autocomplete="off"><div class="oc-client-form-grid form-grid">'+content+'</div>'+footer(label||kind)+
  (labels[kind]?'<button type="button" class="outline office-remove-record" data-delete-record>Remove '+esc(labels[kind])+'</button>':'')+'</form>';
}
const title=(kind,row)=>row.doctor_name||row.medication_name||row.carrier||row.plan_name||labels[kind];
const card=(kind,row={},fresh=false)=>'<details class="health-record-card office-record-card"'+(fresh?' open':'')+'><summary><span><strong data-record-title>'+esc(title(kind,row))+'</strong><small>'+esc(row.specialty||row.strength||row.policy_number||row.plan_id||'Click to expand')+'</small></span><b aria-hidden="true">⌄</b></summary><div class="health-record-body">'+editor(kind,row,labels[kind],{fresh})+'</div></details>';
const list=(kind,rows)=>'<div data-office-record-list="'+kind+'">'+rows.map(row=>card(kind,row)).join('')+'</div><div class="office-section-actions"><button type="button" class="outline" data-office-add-record="'+kind+'">+ Add '+esc(labels[kind])+'</button><button type="button" class="primary" data-office-save-list="'+kind+'">Save '+esc(kind==='client_doctors'?'Doctors':kind==='client_medications'?'Medications':labels[kind]+'s')+'</button><span data-list-status role="status"></span></div>';
window.officeClientRecordEnhance=modal=>{
 const api=window.officeCrmClientBridge,current=api?.current?.();
 if(!current||!modal.querySelector('#editClient'))return;
 const root=modal,client=current.client,details=current.details||{},errors=current.errors||{};
 const rows=kind=>Array.isArray(details[kind])?details[kind]:[];
 const initials=new WeakMap();
 const value=el=>el.type==='checkbox'?String(el.checked):el.value;
 const controls=host=>[...host.querySelectorAll('input,textarea,select')].filter(el=>el.type!=='hidden'&&!el.closest('[data-office-arctos-medical-files]'));
 const remember=host=>controls(host).forEach(el=>initials.set(el,value(el)));
 root.officeRememberControl=el=>initials.set(el,value(el));
 const dirty=host=>controls(host).some(el=>initials.has(el)&&initials.get(el)!==value(el));
 const hasUnsaved=()=>dirty(root)||!!root.querySelector('[data-new-record="true"]');
 root.officeHasUnsavedChanges=hasUnsaved;
 const unavailable=(kind,html)=>errors[tableFor(kind)]?'<p class="oc-protected-error" role="alert">This section could not load. Reopen the client before editing it.</p>':html;
 const med=rows('medicare_details')[0]||{};
 if(current.agency==='platinum'){
  fields.hospital_indemnity_plans=fields.hospital_indemnity_plans.filter(([key])=>!['hospital_daily_benefit','ambulance_benefit','outpatient_benefit','cancer_benefit','skilled_nursing_benefit'].includes(key));
  fields.hospital_indemnity_plans.push(['hospital_daily_benefit','Hospital Daily Benefit','number'],['ambulance_benefit','Ambulance Benefit','number'],['outpatient_benefit','Outpatient Benefit','number'],['cancer_benefit','Cancer Benefit','number'],['skilled_nursing_benefit','Skilled Nursing Benefit','number']);
 }else fields.hospital_indemnity_plans=fields.hospital_indemnity_plans.filter(([key])=>!['hospital_daily_benefit','ambulance_benefit','outpatient_benefit','cancer_benefit','skilled_nursing_benefit'].includes(key));
 const medicare=root.querySelector('[data-client-category="medicare"] > .oc-client-category-body');
 if(medicare){
  const groups=[...medicare.querySelectorAll(':scope > details')];
  const body=title=>groups.find(el=>el.querySelector('summary')?.textContent===title)?.querySelector(':scope > .form-grid');
  for(const [name,kind] of [['Medicare Information','medicare_details'],['Medicaid Information','medicaid'],['Sunfire','sunfire']]){
   const host=body(name);if(!host)continue;
   const secure=host.querySelector('.parity-sensitive-editor');
   host.replaceChildren();if(secure)host.append(secure);
   host.insertAdjacentHTML('beforeend',unavailable(kind,editor(kind,med,name)));
  }
  for(const [name,kind] of [['Health Plan Information','health_plans']]){
   const host=body(name);if(host)host.innerHTML=unavailable(kind,list(kind,rows(kind)));
  }
 }
 for(const [category,kind] of [['life','life_policies'],['hospital_indemnity','hospital_indemnity_plans'],['retirement','retirement_accounts']]){
  const host=root.querySelector('[data-client-category="'+category+'"] > .oc-client-category-body');
  if(host)host.innerHTML=unavailable(kind,list(kind,rows(kind)));
 }
 for(const [category,content] of [
  ['doctors',unavailable('client_doctors',list('client_doctors',rows('client_doctors')))],
  ['medications',group('Pharmacy Information',unavailable('client_pharmacies',editor('client_pharmacies',rows('client_pharmacies')[0]||{},'Pharmacies')),'pharmacies')+group('Medications',unavailable('client_medications',list('client_medications',rows('client_medications'))),'medications')]
 ]){
  const host=root.querySelector('[data-client-category="'+category+'"] > .oc-client-category-body');if(host)host.innerHTML=content;
 }
 if(current.agency==='arctos'){
  const doctors=root.querySelector('[data-client-category="doctors"] > .oc-client-category-body');
  if(doctors)doctors.insertAdjacentHTML('afterbegin','<section class="office-doctors-notes">'+input('doctors_section_notes','Doctors Section Notes','textarea',client.doctors_section_notes)+'<div class="office-section-actions"><span data-section-status role="status"></span><button type="button" class="primary" data-save-overview>Save Doctors Notes</button></div></section>');
 }
 const exact=!!root.querySelector('[data-office-exact-overview]');
 let flags=root.querySelector('[data-office-exact-overview] .product-choices');
 const nonDeceasedStatus=client.status&&client.status!=='deceased'?client.status:'active';
 if(!exact){
 const nameGroup=root.querySelector('.intake-section-name');
 if(nameGroup&&current.agency==='platinum')nameGroup.insertAdjacentHTML('beforeend',input('middle_name','Middle Name','text',client.middle_name));
 const household=root.querySelector('.intake-section-household');
 flags=document.createElement('div');flags.className='office-client-flags';flags.setAttribute('role','group');flags.setAttribute('aria-label','Client coverage and status');
 flags.innerHTML=['medicare','life','retirement'].map(product=>'<label class="office-product-choice"><input type="checkbox" data-office-product="'+product+'"'+(client.status!=='deceased'&&client.products?.includes(product)?' checked':'')+'> '+product[0].toUpperCase()+product.slice(1)+'</label>').join('')+'<label class="office-product-choice office-deceased-choice"><input type="checkbox" data-office-deceased'+(client.status==='deceased'?' checked':'')+'> Deceased</label>';
 root.querySelector('.oc-client-modal-header')?.after(flags);
 flags.hidden=!!root.querySelector('[data-oc-client-panel="overview"]')?.hidden;
 flags.addEventListener('change',event=>{
  if(event.target.matches('[data-office-deceased]')&&event.target.checked)flags.querySelectorAll('[data-office-product]').forEach(el=>el.checked=false);
  if(event.target.matches('[data-office-product]')&&event.target.checked)flags.querySelector('[data-office-deceased]').checked=false;
 });
 const glance=root.querySelector('.client-overview-card');
 if(glance){
  const assignment=document.createElement('div');assignment.className='office-assignment-inline';
  assignment.innerHTML=input('assigned_agent_id','Assigned Agent',[[client.assigned_agent_id||'',client.assigned_agent_id?'Loading assigned agent…':'Choose agent…']],client.assigned_agent_id);
  glance.after(assignment);
  const agent=assignment.querySelector('[name="assigned_agent_id"]');agent.disabled=true;
  void api.request(current.agency,'campaign_agents').then(result=>{
   if(!root.isConnected)return;
   const agents=result.agents||[];
   agent.innerHTML='<option value="">Choose agent…</option>'+agents.map(row=>'<option value="'+esc(row.id)+'"'+(row.id===client.assigned_agent_id?' selected':'')+'>'+esc(row.full_name||'Agent')+'</option>').join('');
   if(client.assigned_agent_id&&!agents.some(row=>row.id===client.assigned_agent_id)){const option=document.createElement('option');option.value=client.assigned_agent_id;option.textContent='Current assigned agent';option.selected=true;agent.append(option);}
   agent.disabled=!current.permissions?.edit;initials.set(agent,agent.value);
  }).catch(()=>{agent.closest('label').insertAdjacentHTML('beforeend','<small>Agent list could not load. Reopen the record to change assignment.</small>');});
 }
 const personal=root.querySelector('.arctos-personal-group');
 if(personal){personal.classList.add('office-personal-compact','parity-subsection');personal.querySelector(':scope > summary').textContent='Personal & Contact Information';}
 const license=root.querySelector('.parity-identification .form-grid');
 if(license)license.insertAdjacentHTML('beforeend',input('drivers_license_expiration','License Expiration','date',client.drivers_license_expiration)+input('drivers_license_state','License State','text',client.drivers_license_state));
 const scopedOverview=[...root.querySelectorAll('.intake-section-box,.intake-section-underwriting,.oc-client-note-overview,.parity-identification > details')].filter(el=>!el.parentElement?.closest('.intake-section-box,.intake-section-underwriting'));
 for(const section of scopedOverview){
  const action=document.createElement('div');action.className='office-section-actions';
  action.innerHTML='<span data-section-status role="status" aria-live="polite"></span><button type="button" class="primary" data-save-overview>Save Section</button>';
  (section.querySelector(':scope > .form-grid,:scope > .oc-client-category-body')||section).append(action);
 }
 root.querySelector('#editClient > .oc-client-save-footer')?.remove();
 }
 if(exact)window.officeArctosOverviewBind?.(root);
 const noteForm=root.querySelector('#newClientNote');
 if(noteForm&&!noteForm.querySelector('[data-section-status]'))noteForm.insertAdjacentHTML('beforeend','<span data-section-status role="status" aria-live="polite"></span>');
 root.querySelectorAll('.oc-client-readonly-hint').forEach(el=>{if(el.closest('[data-oc-client-panel="coverage"]'))el.remove();});
 const healthHost=medicare&&[...medicare.querySelectorAll(':scope > details')].find(el=>el.querySelector('summary')?.textContent==='Health Plan Information')?.querySelector(':scope > .form-grid');
 if(healthHost&&current.agency==='arctos')healthHost.insertAdjacentHTML('beforeend',group('Old Plan Details','<section class="office-old-plan-details">'+[['old_plan_carrier','Insurance Company'],['old_plan_id','Plan ID'],['old_plan_member_id','Member ID'],['old_plan_year','Year']].map(([key,label])=>input(key,label,'text',client[key])).join('')+'<div class="office-section-actions"><span data-section-status role="status"></span><button type="button" class="primary" data-save-overview>Save Old Plan Details</button></div></section>'));
 const coreKeys=new Set(['assigned_agent_id','first_name','last_name','middle_name','date_of_birth','gender','phone','email','address1','address2','city','state','zip_code','county','spouse','height_feet','height_inches','weight_lbs','smoker','veteran','notes','status','drivers_license_expiration','drivers_license_state','doctors_section_notes','old_plan_carrier','old_plan_id','old_plan_member_id','old_plan_year']);
 const coreKey=el=>el.dataset.officeCoreKey||el.name;
 const normalize=el=>{
  if(el.value==='')return null;
  if(el.hasAttribute('data-date')){
   const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(el.value);
   if(!m)throw Error('Enter the date as MM/DD/YYYY.');
   const iso=m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'),date=new Date(iso+'T12:00:00Z');
   if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==iso)throw Error('Enter a valid date.');
   return iso;
  }
  return ['height_feet','height_inches','weight_lbs'].includes(el.name)?Number(el.value):['smoker','veteran'].includes(el.name)?el.value==='true':el.value;
 };
 const busy=new WeakSet();
 const run=async(host,task)=>{
  if(busy.has(host))return false;busy.add(host);
  const buttons=[...host.querySelectorAll('button')],status=host.querySelector('[data-section-status]');
  buttons.forEach(button=>button.disabled=true);if(status)status.textContent='Saving…';
  try{await task();if(status)status.textContent='Saved successfully.';return true;}
  catch(error){if(status)status.textContent='Save failed: '+error.message;return false;}
  finally{busy.delete(host);buttons.forEach(button=>button.disabled=false);}
 };
 const saveOverview=async section=>run(section,async()=>{
  const editable=controls(section).filter(el=>coreKeys.has(coreKey(el))&&!el.disabled);
  for(const el of editable)if(!el.checkValidity()){el.closest('details')?.setAttribute('open','');el.reportValidity();throw Error('Complete the highlighted field.');}
  const changes={};for(const el of editable)if(value(el)!==initials.get(el))changes[coreKey(el)]=normalize(el);
  if(section.querySelector('[data-office-product]')){
   const products=[...section.querySelectorAll('[data-office-product]')].filter(el=>el.checked).map(el=>el.dataset.officeProduct);
   if(JSON.stringify(products)!==JSON.stringify(client.products||[]))changes.products=products;
   const deceased=section.querySelector('[data-office-deceased]')?.checked;
   const status=deceased?'deceased':nonDeceasedStatus;
   if(status!==client.status)changes.status=status;
   if(deceased){changes.products=[];section.querySelectorAll('[data-office-product]').forEach(el=>el.checked=false);}
  }
  if(Object.keys(changes).length){await api.request(current.agency,'save_client',{client_id:current.id,changes});Object.assign(client,changes);editable.forEach(el=>initials.set(el,value(el)));section.querySelectorAll('[data-office-product],[data-office-deceased]').forEach(el=>initials.set(el,value(el)));root.dispatchEvent(new CustomEvent('office:client-core-saved',{detail:{changes}}));}
  for(const box of section.querySelectorAll('.parity-sensitive-editor'))if(box.dataset.protectedLoaded==='true'&&box.officeSaveProtected&&await box.officeSaveProtected()===false)throw Error('Protected information was not saved. See the field message.');
  if(section.querySelector('[data-office-exact-overview]'))await root.officeSaveExactProtected?.();
 });
 const saveRecord=async form=>run(form,async()=>{
  const kind=form.dataset.officeRecordEditor,table=tableFor(kind);
  for(const el of controls(form))if(!el.checkValidity()){el.closest('details')?.setAttribute('open','');el.reportValidity();throw Error('Complete the highlighted field.');}
  const changes={};for(const el of controls(form))if(el.name&&(form.dataset.newRecord==='true'||value(el)!==initials.get(el)))changes[el.name]=el.value;
  if(!Object.keys(changes).length)return;
  const result=await api.request(current.agency,'save_record',{client_id:current.id,table,record_id:form.dataset.recordId||null,expected_updated_at:form.dataset.newRecord==='true'?null:form.dataset.recordVersion||null,changes});
  if(!result.saved)throw Error('Save was not confirmed.');
  if(result.record?.id)form.dataset.recordId=result.record.id;
  if(result.record?.updated_at)form.dataset.recordVersion=result.record.updated_at;
  delete form.dataset.newRecord;remember(form);
  const card=form.closest('.office-record-card');if(card){const updated=Object.fromEntries(controls(form).filter(el=>el.name).map(el=>[el.name,el.value]));card.querySelector('[data-record-title]').textContent=title(kind,updated);}
 });
 const saveNote=async form=>run(form,async()=>{
  const field=form.querySelector('[name="note"]');
  if(!field.value.trim())throw Error('Enter a note.');
  const message=field.value.trim();await api.request(current.agency,'add_note',{client_id:current.id,note:message});
  const saved=document.createElement('p');saved.className='office-saved-note';saved.textContent=message;form.before(saved);
  field.value='';remember(form);
 });
 const saveTab=async key=>{
  const panel=root.querySelector('[data-oc-client-panel="'+key+'"]'),footer=panel?.querySelector('[data-tab-save-footer]');
  if(!panel||!footer||footer.dataset.saving==='true')return;
  footer.dataset.saving='true';const button=footer.querySelector('button'),status=footer.querySelector('[data-tab-save-status]');button.disabled=true;status.textContent='Saving…';
  let ok=true;
  try{
   if(key==='overview'){
    if(!exact&&!await saveOverview(flags))ok=false;
    if(!await saveOverview(panel))ok=false;
   }else if(key==='coverage'&&root.officeSaveExactCoverage){
    if(!await root.officeSaveExactCoverage())ok=false;
   }else if(key==='medical'&&root.officeSaveExactMedical){
    if(!await root.officeSaveExactMedical())ok=false;
   }else if(key==='files'&&root.officeSaveExactFiles){
    if(!await root.officeSaveExactFiles())ok=false;
   }else{
    for(const section of panel.querySelectorAll('.office-doctors-notes,.office-old-plan-details'))if(dirty(section)&&!await saveOverview(section))ok=false;
    for(const form of panel.querySelectorAll('[data-office-record-editor]'))if((dirty(form)||form.dataset.newRecord==='true')&&!await saveRecord(form))ok=false;
    for(const box of panel.querySelectorAll('.parity-sensitive-editor'))if(box.dataset.protectedLoaded==='true'&&box.officeSaveProtected&&!await box.officeSaveProtected())ok=false;
    const note=panel.querySelector('#newClientNote');if(note&&note.querySelector('[name="note"]').value&& !await saveNote(note))ok=false;
   }
   if(ok)status.textContent='All changes in this tab are saved.';else if(!status.textContent.startsWith('Save failed:'))status.textContent='Some changes could not save. Open the section with the error and retry.';
  }catch(error){status.textContent='Save failed: '+error.message;}
  finally{footer.dataset.saving='false';button.disabled=!current.permissions?.edit;}
 };
 for(const [key,label] of [['overview','Overview'],['coverage','Coverage'],['medical','Medical'],['files','Notes & Files']]){
  const panel=root.querySelector('[data-oc-client-panel="'+key+'"]');
  if(panel)panel.insertAdjacentHTML('beforeend','<div class="office-tab-save-footer" data-tab-save-footer="'+key+'"><span data-tab-save-status role="status" aria-live="polite"></span><button type="button" class="primary" data-save-tab="'+key+'">Save '+label+'</button></div>');
  if(exact&&key==='overview'||key==='coverage'&&root.officeSaveExactCoverage||['medical','files'].includes(key)&&root.officeSaveExactMedical){const footer=panel.querySelector('[data-tab-save-footer]');footer.classList.add('modal-footer');footer.querySelector('button').classList.add('btn');footer.querySelector('button').textContent='Save Client';}
 }
 root.addEventListener('submit',event=>{
  const form=event.target.closest('[data-office-record-editor]');
  if(form){event.preventDefault();event.stopImmediatePropagation();void saveRecord(form);}
  else if(event.target.id==='editClient'){event.preventDefault();event.stopImmediatePropagation();void saveTab('overview');}
  else if(event.target.id==='newClientNote'){
   event.preventDefault();event.stopImmediatePropagation();
   void saveNote(event.target);
  }
 },true);
 root.addEventListener('click',async event=>{
  const tabSave=event.target.closest('[data-save-tab]');if(tabSave){event.preventDefault();await saveTab(tabSave.dataset.saveTab);return;}
  const save=event.target.closest('[data-save-overview]');if(save){event.preventDefault();await saveOverview(save.closest('.intake-section-box,.intake-section-underwriting,.oc-client-note-overview,.parity-identification > details,.office-doctors-notes,.office-old-plan-details'));return;}
  const add=event.target.closest('[data-office-add-record]');if(add){
   const kind=add.dataset.officeAddRecord,list=root.querySelector('[data-office-record-list="'+kind+'"]');list.insertAdjacentHTML('beforeend',card(kind,{},true));remember(list.lastElementChild);list.lastElementChild.querySelector('input')?.focus();return;
  }
  const all=event.target.closest('[data-office-save-list]');if(all){
   const kind=all.dataset.officeSaveList,list=root.querySelector('[data-office-record-list="'+kind+'"]'),status=all.parentElement.querySelector('[data-list-status]');all.disabled=true;let ok=true;
   for(const form of list.querySelectorAll('[data-office-record-editor]'))if(dirty(form)||form.dataset.newRecord==='true')if(!await saveRecord(form))ok=false;
   status.textContent=ok?'Saved successfully.':'Some records could not save. Open the record to see the error.';all.disabled=false;return;
  }
  const remove=event.target.closest('[data-delete-record]');if(remove){
   const form=remove.closest('form'),kind=form.dataset.officeRecordEditor;
   if(form.dataset.recordId&&form.dataset.newRecord!=='true'&&!confirm('Remove this '+labels[kind].toLowerCase()+' from the client record?'))return;
   if(form.dataset.recordId&&form.dataset.newRecord!=='true'){const ok=await run(form,()=>api.request(current.agency,'delete_record',{client_id:current.id,table:kind,record_id:form.dataset.recordId}));if(!ok)return;}
   form.closest('.office-record-card')?.remove();
  }
 });
 const tracker=new MutationObserver(()=>{for(const el of controls(root))if(!initials.has(el)&&!el.dataset.protectedInput)initials.set(el,value(el));if(!root.isConnected)tracker.disconnect();});
 tracker.observe(root,{subtree:true,childList:true});
 remember(root);
 root.officeHasUnsavedChanges=()=>hasUnsaved()||!!root.officeExactCoverageDirty?.()||!!root.officeExactMedicalFilesDirty?.()||[...root.querySelectorAll('[data-protected-input]')].some(el=>el.dataset.initial!==undefined&&el.value!==el.dataset.initial);
 // The identifiers are loaded after this enhancement; use their secure baseline, not their empty loading state.
 for(const el of root.querySelectorAll('[data-protected-input]'))initials.delete(el);
 root.querySelectorAll('details[open]').forEach(el=>el.open=false);
 if(!current.permissions?.edit)root.querySelectorAll('input,select,textarea,button[data-save-overview],button[data-save-tab],button[type="submit"],button[data-office-add-record],button[data-office-save-list],button[data-delete-record]').forEach(el=>{if(!el.matches('[data-cfh-search]'))el.disabled=true;});
};
})();
