(()=>{'use strict';
const currentDialog=()=>document.getElementById('dialog');
const mk=(tag,cls='',html='')=>{const n=document.createElement(tag);n.className=cls;n.innerHTML=html;return n};
const addGroup=(title,type)=>{const s=mk('section','intake-section-box intake-section-'+type+' span-all',
'<div class="intake-section-title span-all"><strong>'+title+'</strong></div>');return s};
// Protected information is loaded automatically for an already-authorized Office
// staff account. The ordinary agency bridge still performs per-client checks and
// audit logs. Nothing is copied to local storage or sent to third-party services.
const secure=(parent,modal,kind,field,title)=>{
 const box=mk('div','field span-all parity-secure parity-auto-sensitive');
 box.dataset.parityKind=kind;box.dataset.parityField=field;
 box.append(mk('span','parity-sensitive-label'),mk('div','parity-secure-value'));
 box.querySelector('.parity-sensitive-label').textContent=title;
 box.querySelector('.parity-secure-value').textContent='Checking authorized agency information…';
 parent.append(box);return box;
};
function loadProtected(modal){
 const vault=modal.querySelector('[data-parity-stash]');
 const nodes=[...modal.querySelectorAll('.parity-auto-sensitive')];
 if(!nodes.length)return;
 const filtered=nodes.filter(node=>node.isConnected);
 if(!vault){
  filtered.forEach(node=>node.querySelector('.parity-secure-value').textContent=
   'Save the client to access protected information, or request agency permission.');
  return;
 }
 const kinds=[...new Set(filtered.map(node=>node.dataset.parityKind))];
 const match=(name,key)=>{
  const n=String(name||'').toLowerCase();
  if(!key)return true;
  if(key==='ssn')return /social security|\bssn\b/.test(n);
  if(key==='license')return /driver|license/.test(n);
  if(key==='medicare')return /medicare/.test(n)&&!/medicaid|medicare\.gov/.test(n);
  if(key==='medicaid')return /medicaid/.test(n);
  return false;
 };
 const restore=()=>{
  for(const node of filtered){
   const value=node.querySelector('.parity-secure-value');
   if(value){value.replaceChildren();value.textContent='Reopen the record to view protected information.';}
  }
 };
 // Sensitive field values exist only while this client record stays in view.
 const dialog=document.getElementById('dialog');
 const focusHandler=()=>{
  if(document.visibilityState==='hidden')restore();
 };
 document.addEventListener('visibilitychange',focusHandler);
 const disconnector=new MutationObserver(()=>{
  if(!modal.isConnected){
   document.removeEventListener('visibilitychange',focusHandler);
   disconnector.disconnect();
  }
 });
 disconnector.observe(document.body,{childList:true,subtree:true});
 for(const kind of kinds){
  const button=vault.querySelector('[data-protected="'+kind+'"]');
  const pane=vault.querySelector('[data-secure-result="'+kind+'"]');
  const targets=filtered.filter(node=>node.dataset.parityKind===kind);
  if(!button||!pane||button.disabled){
   for(const node of targets)node.querySelector('.parity-secure-value').textContent=
    'Protected information is restricted for this account.';
   continue;
  }
  const display=()=>{
   if(!modal.isConnected)return;
   const rows=[...pane.querySelectorAll('.oc-protected-field')];
   if(rows.length){
    for(const node of targets){
     const target=node.querySelector('.parity-secure-value');
     if(!target)continue;
     target.replaceChildren();
     const shown=rows.filter(row=>match(row.querySelector('strong')?.textContent,node.dataset.parityField));
     if(!shown.length){target.textContent='No saved information in this field.';continue;}
     for(const row of shown)target.append(row.cloneNode(true));
    }
    return true;
   }
   if(pane.querySelector('.oc-protected-error')){
    for(const node of targets)node.querySelector('.parity-secure-value').textContent=
     'Agency access denied or protected information unavailable.';
    return true;
   }
   if(/No saved information/i.test(pane.textContent||'')){
    for(const node of targets)node.querySelector('.parity-secure-value').textContent=
     'No saved information in this section.';
    return true;
   }
   return false;
  };
  // The audited agency reveal already verifies Office can_view_sensitive.
  button.click();
  let retries=0;
  const poll=()=>{
   if(!modal.isConnected)return;
   if(display())return;
   if(retries++<70)setTimeout(poll,120);
   else targets.forEach(node=>node.querySelector('.parity-secure-value').textContent=
    'Information is unavailable from the agency.');
  };
  setTimeout(poll,160);
 }
}

function accordion(parent,title,cls){
 const d=mk('details','field-group parity-subsection '+cls);d.append(mk('summary','',title),mk('div','form-grid'));
 parent.append(d);return d.querySelector('.form-grid');
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