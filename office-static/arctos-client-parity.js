(()=>{'use strict';
const currentDialog=()=>document.getElementById('dialog');
const mk=(tag,cls='',html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n};
const addGroup=(title,type)=>{const s=mk('section','intake-section-box intake-section-'+type+' span-all',
'<div class="intake-section-title span-all"><strong>'+title+'</strong></div>');return s};
// Protected information is editable for Office staff who have both agency edit
// and sensitive-data permissions. Reads and writes still go through the audited
// agency bridge, and values are cleared whenever the record leaves the screen.
const identifierKey=field=>({ssn:'ssn',license:'drivers_license_number',medicare:'medicare_number',medicaid:'medicaid_number'}[field]||field);
const protectedFields=(kind,field,title)=>{
 if(kind==='identifiers')return [[identifierKey(field),title]];
 if(kind==='banking')return [
  ['payment_method','Payment Method'],['bank_name','Bank Name'],['account_name','Account Holder'],
  ['routing_number','Routing Number'],['account_number','Account Number'],['payment_notes','Payment Notes'],
  ['card_number','Card Number / Last Four'],['card_expiration','Card Expiration'],['card_notes','Card Notes']
 ];
 if(kind==='medicare_gov')return [
  ['username','Medicare.gov Username'],['password','Medicare.gov Password'],
  ['verification_type','Verification Method'],['verification_destination','Verification Phone / Email'],
  ['security_answer','Verification Answer']
 ];
 return [];
};
const secure=(parent,modal,kind,field,title)=>{
 const box=mk('div','field span-all parity-secure parity-auto-sensitive parity-sensitive-editor');
 box.dataset.parityKind=kind;box.dataset.parityField=field;
 const heading=mk('div','parity-sensitive-editor-heading');
 heading.append(mk('strong','parity-sensitive-label'),mk('span','parity-sensitive-status'));
 heading.querySelector('strong').textContent=title;
 heading.querySelector('span').textContent='Checking authorized agency information…';
 const grid=mk('div','parity-protected-form-grid');
 for(const [key,label] of protectedFields(kind,field,title)){
  const wrap=mk('label','field parity-protected-field');
  const caption=mk('span');caption.textContent=label;
  const input=document.createElement(key==='payment_notes'||key==='card_notes'?'textarea':'input');
  input.dataset.protectedInput=key;input.name='office_protected_'+key;input.autocomplete='off';
  if(input instanceof HTMLInputElement)input.type=key==='password'?'password':'text';
  if(input instanceof HTMLTextAreaElement)input.rows=3;
  const clear=mk('label','parity-protected-clear');
  const clearBox=document.createElement('input');clearBox.type='checkbox';clearBox.dataset.protectedClear=key;
  clear.append(clearBox,document.createTextNode(' Clear saved value'));
  wrap.append(caption,input,clear);grid.append(wrap);
 }
 const actions=mk('div','parity-sensitive-actions');
 const save=document.createElement('button');save.type='button';save.className='primary';save.dataset.saveProtected=kind;save.textContent='Save Protected Information';
 actions.append(save);box.append(heading,grid,actions);parent.append(box);
 save.addEventListener('click',async()=>{
  const api=window.officeCrmClientBridge,current=api?.current?.(),status=box.querySelector('.parity-sensitive-status');
  if(!api||!current){status.textContent='Save the client before editing protected information.';return;}
  const values={};
  for(const input of box.querySelectorAll('[data-protected-input]')){
   const key=input.dataset.protectedInput,clear=box.querySelector('[data-protected-clear="'+key+'"]');
   if(clear?.checked)values[key]='';
   else if(input.value!==input.dataset.initial)values[key]=input.value;
  }
  if(!Object.keys(values).length){status.textContent='No protected changes to save.';return;}
  save.disabled=true;status.textContent='Saving securely…';
  try{
   await api.request(current.agency,'save_sensitive',{client_id:current.id,kind,values});
   status.textContent='Saved securely.';
   await modal.officeReloadProtected?.(kind);
  }catch(error){status.textContent='Save failed: '+(error?.message||'Unable to save protected information.');}
  finally{save.disabled=false;}
 });
 return box;
};
function loadProtected(modal){
 const nodes=[...modal.querySelectorAll('.parity-auto-sensitive')].filter(node=>node.isConnected);
 if(!nodes.length)return;
 const api=window.officeCrmClientBridge,current=api?.current?.();
 if(!api||!current){
  nodes.forEach(node=>node.querySelector('.parity-sensitive-status').textContent=
   'Save the client to edit protected information, or request agency permission.');
  return;
 }
 const fill=(kind,data={})=>{
  for(const node of nodes.filter(item=>item.dataset.parityKind===kind)){
   for(const input of node.querySelectorAll('[data-protected-input]')){
    const key=input.dataset.protectedInput;
    const value=key==='card_number'?'':String(data[key]??'');
    input.value=value;input.dataset.initial=value;
    const clear=node.querySelector('[data-protected-clear="'+key+'"]');if(clear)clear.checked=false;
    if(key==='card_number'&&data.card_last4)input.placeholder='Saved ending in '+String(data.card_last4)+' — enter a new value to replace';
   }
   node.querySelector('.parity-sensitive-status').textContent='Editable secure fields loaded.';
  }
 };
 const protectedHandler=event=>{
  const detail=event.detail||{};if(!modal.isConnected)return;
  fill(detail.kind,detail.data);
 };
 modal.addEventListener('office:protected',protectedHandler);
 const loadKind=async kind=>{
  const targets=nodes.filter(node=>node.dataset.parityKind===kind);
  targets.forEach(node=>node.querySelector('.parity-sensitive-status').textContent='Retrieving saved secure values…');
  try{
   const result=await api.request(current.agency,'secure_client',{client_id:current.id,kind});
   if(!modal.isConnected)return;
   const data=result?.data&&typeof result.data==='object'?result.data:{};
   fill(kind,data);
   if(!Object.values(data).some(value=>value!==null&&value!==''&&value!==undefined))
    targets.forEach(node=>node.querySelector('.parity-sensitive-status').textContent='No saved information in this section yet.');
  }catch(error){
   targets.forEach(node=>node.querySelector('.parity-sensitive-status').textContent=
    'Unable to load saved values: '+(error?.message||'secure agency request failed.'));
  }
 };
 modal.officeReloadProtected=loadKind;
 const clearVisible=()=>nodes.forEach(node=>{
  node.querySelectorAll('[data-protected-input]').forEach(input=>{input.value='';input.dataset.initial='';});
  node.querySelector('.parity-sensitive-status').textContent='Hidden while Office CRM is not visible.';
 });
 const focusHandler=()=>{
  if(document.visibilityState==='hidden')clearVisible();
  else if(modal.isConnected){
   nodes.forEach(node=>node.querySelector('.parity-sensitive-status').textContent='Refreshing authorized agency information…');
   for(const kind of new Set(nodes.map(node=>node.dataset.parityKind)))void loadKind(kind);
  }
 };
 document.addEventListener('visibilitychange',focusHandler);
 const disconnector=new MutationObserver(()=>{if(!modal.isConnected){
  document.removeEventListener('visibilitychange',focusHandler);modal.removeEventListener('office:protected',protectedHandler);
  delete modal.officeReloadProtected;disconnector.disconnect();
 }});
 disconnector.observe(document.body,{childList:true,subtree:true});
 for(const kind of new Set(nodes.map(node=>node.dataset.parityKind)))void loadKind(kind);
}

function accordion(parent,title,cls){
 const d=mk('details','field-group parity-subsection '+cls);d.append(mk('summary','',title),mk('div','form-grid'));
 parent.append(d);return d.querySelector('.form-grid');
}

function finalizeArctosSections(modal){
 const shell=modal.querySelector('.oc-client-four-tabs');if(!shell)return;
 const overview=shell.querySelector('[data-oc-client-panel="overview"]');
 overview?.querySelector('.client-glance-notes-wide')?.classList.add('arctos-top-note');
 const general=overview?.querySelector('.oc-client-category.tone-overview');
 general?.classList.add('arctos-personal-group');
 const coverage=shell.querySelector('[data-oc-client-panel="coverage"]');
 if(coverage){
  const sections=[...coverage.querySelectorAll(':scope > .oc-client-category')];
  let anchor=coverage.querySelector('.oc-client-group-heading');
  for(const [key,pattern] of [
   ['medicare',/Medicare & Current Coverage/i],
   ['life',/Life Insurance/i],
   ['hospital_indemnity',/Hospital Indemnity/i],
   ['retirement',/Retirement/i]]){
   const found=sections.find(el=>pattern.test(el.querySelector(':scope > summary')?.textContent||''));
   if(!found)continue;
   found.dataset.clientCategory=key;
   found.classList.add('arctos-coverage-card');
   if(anchor)anchor.insertAdjacentElement('afterend',found);
   anchor=found;
  }
  const medicare=sections.find(el=>/Medicare & Current Coverage/i.test(el.querySelector(':scope > summary')?.textContent||''));
  const body=medicare?.querySelector('.oc-client-category-body');
  if(body){
   const med=[...body.querySelectorAll(':scope > details')].find(el=>el.querySelector(':scope > summary')?.textContent==='Medicare Information');
   const medBody=med?.querySelector(':scope > .form-grid');
   const subsections=[...medBody?.querySelectorAll(':scope > .oc-client-subsection')||[]];
   for(const [title,matcher,style] of [
    ['Health Plan Information',/Medicare Advantage|Health Plans/i,'health'],
    ['Annual Medicare Reviews',/Annual Medicare Reviews/i,'reviews']]){
    const found=subsections.find(el=>matcher.test(el.querySelector('h4')?.textContent||''));
    if(!found)continue;
    const group=accordion(body,title,style);
    group.append(found);
   }
   const medicaid=[...body.querySelectorAll(':scope > details')].find(el=>el.querySelector(':scope > summary')?.textContent==='Medicaid Information');
   const sunfire=[...body.querySelectorAll(':scope > details')].find(el=>el.querySelector(':scope > summary')?.textContent==='Sunfire');
   const datums=[...medBody?.querySelectorAll('.oc-client-datum')||[]];
   for(const row of datums){
    const title=row.querySelector('dt')?.textContent||'';
    if(/medicaid level/i.test(title))medicaid?.querySelector('.form-grid')?.append(row);
    if(/sunfire/i.test(title))sunfire?.querySelector('.form-grid')?.append(row);
   }
   const medicaidEditor=medBody?.querySelector('[data-medicaid-level-editor]');
   if(medicaidEditor)medicaid?.querySelector('.form-grid')?.prepend(medicaidEditor);
   for(const title of ['Medicare Information','Medicare.gov Login Credentials',
     'Medicaid Information','Sunfire','Health Plan Information','Annual Medicare Reviews']){
    const el=[...body.querySelectorAll(':scope > details')].find(group=>
      group.querySelector(':scope > summary')?.textContent===title);
    if(el)body.append(el);
   }
  }
  const hip=coverage.querySelector('[data-client-category="hospital_indemnity"]');
  const hipBody=hip?.querySelector('.oc-client-category-body');
  if(hipBody)hipBody.prepend(mk('div','arctos-hip-label',
   '<strong>Hospital Indemnity Plan Information</strong><p>Hospital, ambulance, outpatient, cancer and skilled-nursing benefits, where available in the original record.</p>'));
 }
 const medical=shell.querySelector('[data-oc-client-panel="medical"]');
 if(medical){
  const categories=[...medical.querySelectorAll('.oc-client-category')];
  for(const [kind,title] of [['doctors',/Doctors/],['medications',/Medications/]]){
   const item=categories.find(el=>title.test(el.querySelector(':scope > summary')?.textContent||''));
   if(item)item.dataset.clientCategory=kind;
  }
 }
 const files=shell.querySelector('[data-oc-client-panel="files"]');
 if(files){
  const sections=[...files.querySelectorAll(':scope > .oc-client-category')];
  const doc=sections.find(el=>/Documents & Files/i.test(el.querySelector(':scope > summary')?.textContent||''));
  const note=sections.find(el=>/Client Notes/i.test(el.querySelector(':scope > summary')?.textContent||''));
  const heading=files.querySelector('.oc-client-group-heading');
  const count=doc?.querySelectorAll('[data-office-doc]').length||0;
  if(doc){
   doc.classList.add('arctos-files-section');
   const title=doc.querySelector(':scope > summary strong');
   if(title)title.textContent='Documents & Files ('+count+')';
   if(heading)heading.insertAdjacentElement('afterend',doc);
  }
  if(note){
   note.classList.add('arctos-notes-section');
   if(doc)doc.insertAdjacentElement('afterend',note);
  }
  if(heading){
   const status=mk('div','arctos-files-status');
   status.textContent=count
    ?count+' saved client file'+(count===1?'':'s')+' available in Documents & Files.'
    :'No documents attached to this client in this agency record.';
   heading.insertAdjacentElement('afterend',status);
  }
 }
}

function enhance(modal){
 if(modal.dataset.arctosParity==='done')return;
 modal.dataset.arctosParity='done';
 const shell=modal.querySelector('.oc-client-four-tabs');if(!shell)return;
 shell.classList.add('client-form','client-four-tabs');
 const nav=shell.querySelector('.oc-client-main-tabs');nav?.classList.add('client-main-tabs','section-tabs');
 nav?.querySelectorAll('button').forEach(b=>b.dataset.clientGroupTab=b.dataset.ocClientTab);
 shell.querySelectorAll('.oc-client-tabpanel').forEach(p=>p.dataset.clientGroupPanel=p.dataset.ocClientPanel);
 const overview=shell.querySelector('[data-oc-client-panel="overview"]');
 shell.querySelectorAll('.oc-client-field').forEach(el=>el.classList.add('field'));
 shell.querySelectorAll('.oc-client-form-grid').forEach(el=>el.classList.add('form-grid'));
 const form=overview?.querySelector('#editClient,#officeNewClientForm');
 if(!form)return;
 const glance=overview.querySelector('.oc-client-overview-card');
 if(glance){
  glance.classList.add('client-overview-card');
  glance.querySelector('.oc-client-kicker')?.classList.add('client-overview-kicker');
  glance.querySelector('.oc-client-overview-actions')?.classList.add('client-overview-shortcuts');
  const name=glance.querySelector('strong');if(name)name.dataset.clientSummaryName='';
  const meta=glance.querySelector('p');if(meta)meta.dataset.clientSummaryMeta='';
  form.prepend(glance);
 }
 const review=overview.querySelector('.oc-client-review');
 const note=form.querySelector('.oc-client-note-overview');
 if(review||note){
  const row=mk('div','client-glance-activity client-glance-reviews-layout');
  if(review){review.classList.add('client-review-checkoff');row.append(review)}
  if(note){note.classList.add('client-glance-notes-wide');row.append(note)}
  form.insertBefore(row,form.querySelector('.oc-client-category'));
 }
 const general=form.querySelector('.oc-client-category.tone-overview');
 if(general)general.classList.add('field-group');
 const grid=general?.querySelector('.oc-client-form-grid');
 if(grid){
  const fields=[...grid.children];
  for(const [title,key,names] of [
   ['Client Name','name',['first_name','last_name']],
   ['Date of Birth & Gender','demographics',['date_of_birth','gender']],
   ['Email & Phone','contact',['email','phone']],
   ['Address','address',['address1','address2','city','state','zip_code','county']],
   ['Client Assignment & Household','household',['agency','agent_id','spouse']]]){
   const group=addGroup(title,key);if(key==='address')group.classList.add('intake-section-address');
   for(const name of names){const field=fields.find(x=>x.querySelector('[name="'+name+'"]'));if(field)group.append(field)}
   if(key==='demographics')secure(group,modal,'identifiers','ssn','Social Security Number');
   grid.append(group);
  }
  const household=grid.querySelector('.intake-section-household');
  fields.filter(n=>n.parentElement===grid).forEach(n=>household?.append(n));
  // Arctos: Additional Client Information is NOT a separate Overview
  // accordion. Gender goes with DOB, spouse with household, and the remaining
  // height/weight/smoker/veteran fields sit in a Height, Weight & Status card
  // inside Personal & Contact Information immediately after Address.
  const demographics=grid.querySelector('[data-intake-section="demographics"]');
  const address=grid.querySelector('[data-intake-section="address"]');
  const agencyGrid=form.querySelector('.oc-client-agency-grid');
  if(agencyGrid&&household){
   agencyGrid.classList.add('oc-arctos-assignment-grid');
   household.prepend(agencyGrid);
  }
  const extra=[...form.querySelectorAll(':scope > .oc-client-category.tone-identity')]
   .find(el=>/Additional Client Information/i.test(el.querySelector(':scope > summary')?.textContent||''));
  const extraFields=extra?.querySelector('.oc-client-form-grid');
  const takeField=name=>extraFields?.querySelector('[name="'+name+'"]')?.closest('label.oc-client-field');
  const gender=takeField('gender');
  const spouse=takeField('spouse');
  if(gender&&demographics)demographics.insertBefore(gender,demographics.querySelector('.parity-secure')||null);
  if(spouse&&household)household.append(spouse);
  if(!gender&&demographics){
   // Match the original Arctos personal-information layout for new clients.
   // The current Office create-client endpoint only accepts basic contact
   // details, so don't present unsaved fields as editable.
   const field=mk('label','field oc-client-field');
   field.append(mk('span','','Gender'));
   const select=document.createElement('select');select.disabled=true;
   select.setAttribute('aria-label','Gender');
   select.append(mk('option','','Available after saving client'));
   demographics.insertBefore(field,demographics.querySelector('.parity-secure')||null);
   field.append(select);
  }
  if(!spouse&&household){
   const field=mk('label','field oc-client-field');
   field.append(mk('span','','Spouse'));
   const input=document.createElement('input');input.type='text';input.disabled=true;
   input.placeholder='Available after saving client';input.setAttribute('aria-label','Spouse');
   field.append(input);household.append(field);
  }
  // Arctos keeps this underwriting information in the personal details box,
  // in the order: Feet, Inches, Weight, Smoker, Veteran.
  const underwriting=mk('section','personal-underwriting-fields intake-section-underwriting span-all');
  underwriting.dataset.personalUnderwriting='true';
  underwriting.dataset.intakeSection='underwriting';
  underwriting.append(mk('div','personal-underwriting-title span-all','<strong>Height, Weight & Status</strong>'));
  let hasEditable=false;
  for(const name of ['height_feet','height_inches','weight_lbs','smoker','veteran']){
   const field=takeField(name);
   if(field){field.classList.add('field');underwriting.append(field);hasEditable=true;}
  }
  if(!hasEditable){
   // New-client Office bridge does not currently save underwriting fields at
   // creation time. Show their location without accepting unsaved inputs.
   for(const [name,label] of [
    ['height_feet','Height (Feet)'],['height_inches','Height (Inches)'],
    ['weight_lbs','Weight (lbs)'],['smoker','Smoker'],['veteran','Veteran']]){
    const field=mk('label','field oc-client-field');
    const title=mk('span');title.textContent=label;
    const input=document.createElement('input');input.type='text';input.disabled=true;
    input.placeholder='Available after saving';input.setAttribute('aria-label',label);
    field.append(title,input);underwriting.append(field);
   }
  }
  if(address)address.insertAdjacentElement('afterend',underwriting);
  else if(household)grid.insertBefore(underwriting,household);
  else grid.append(underwriting);
  if(extra){
   // Do not remove an extra panel while any unrecognized input is inside it.
   // Keeping unmapped fields visible avoids silently dropping saved data.
   const remaining=extraFields?.querySelectorAll('input[name],select[name],textarea[name]');
   if(!remaining?.length)extra.remove();
   else {
    const more=mk('section','intake-section-box intake-section-other span-all');
    more.dataset.intakeSection='other';
    more.append(mk('div','intake-section-title span-all','<strong>Additional Client Details</strong>'));
    if(extraFields)more.append(...[...extraFields.children]);
    grid.append(more);extra.remove();
   }
  }
 }
 // Keep original audited reveal controls connected, but remove the consolidated
 // Office grouping. Individual displays below invoke those same controls.
 const original=[...overview.querySelectorAll('.oc-client-category.tone-identity')].find(n=>/Identification & Protected/.test(n.querySelector('summary')?.textContent||''));
 if(original && /Identification & Protected/.test(original.querySelector('summary')?.textContent||'')){
  const stash=mk('div','parity-source-vault');stash.dataset.parityStash='';stash.hidden=true;
  stash.append(original);modal.append(stash);
 }
 if(general){
  const driver=mk('div','parity-identification');let body=accordion(driver,"Driver’s License Identification",'driver');
  secure(body,modal,'identifiers','license','Driver’s License Number');
  const banking=mk('div','parity-banking');body=accordion(banking,'Banking Information','banking');
  secure(body,modal,'banking','','Banking & Payment Information');
  general.after(driver,banking);
 }
 shell.querySelectorAll('.oc-client-category').forEach(cat=>{
  if(cat.closest('#editClient,#officeNewClientForm'))return;
  cat.classList.add('client-category');
  const key=cat.classList.contains('tone-medicare')?'medicare':
    cat.classList.contains('tone-life')?'life':cat.classList.contains('tone-hospital')?'hospital_indemnity':
    cat.classList.contains('tone-retirement')?'retirement':cat.classList.contains('tone-doctors')?'doctors':
    cat.classList.contains('tone-medications')?'medications':'information';
  cat.dataset.clientCategory=key;cat.querySelector('.oc-client-category-body')?.classList.add('client-category-body');
 });
 const coverage=shell.querySelector('[data-oc-client-panel="coverage"]');
 const main=[...(coverage?.querySelectorAll('.oc-client-category')||[])].find(cat=>
  /Medicare & Current Coverage/.test(cat.querySelector('summary')?.textContent||''));
 if(main){
  const body=main.querySelector('.oc-client-category-body'),sub=body?[...body.querySelectorAll(':scope > .oc-client-subsection')]:[];
  if(body){
   body.replaceChildren();
   let place=accordion(body,'Medicare Information','medicare');
   secure(place,modal,'identifiers','medicare','Medicare Number');
   sub.forEach(item=>{if(/Medicare Information|Medicare Advantage|Annual Medicare/.test(item.querySelector('h4')?.textContent||''))place.append(item)});
   place=accordion(body,'Medicare.gov Login Credentials','medicare-gov');
   secure(place,modal,'medicare_gov','','Medicare.gov Login Credentials');
   place=accordion(body,'Medicaid Information','medicaid');
   secure(place,modal,'identifiers','medicaid','Medicaid Number');
   place=accordion(body,'Sunfire','sunfire');
   place.append(mk('p','parity-hint','Additional Sunfire details are managed in the agency CRM.'));
  }
 }
 finalizeArctosSections(modal);
 loadProtected(modal);
 // Existing appointment, save, note, and agency handlers remain attached to
 // their original DOM nodes. No stored identifier leaves the secure bridge.
}
const obs=new MutationObserver(()=>{
 const dialog=currentDialog();if(!dialog)return;
 const modal=dialog.querySelector('.oc-arctos-client-dialog:not([data-arctos-parity])');
 if(modal){modal.dataset.arctosParity='pending';queueMicrotask(()=>enhance(modal))}
});
obs.observe(document.body,{childList:true,subtree:true});
})();
