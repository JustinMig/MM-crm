/* Office data bindings for the copied Arctos Overview; markup is generated separately. */
(()=>{'use strict';
const aliases={address:'address1',zip:'zip_code',license_expiration:'drivers_license_expiration',license_state:'drivers_license_state'};
const dateText=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||'');return m?m[2]+'/'+m[3]+'/'+m[1]:v||'';};
window.officeArctosOverviewMount=(root,client)=>{
 const panel=root.querySelector('[data-oc-client-panel="overview"]');
 panel.dataset.officeArctosOverview='';
 panel.innerHTML='<form id="editClient" class="client-form client-four-tabs" data-office-exact-overview autocomplete="off">'+window.officeArctosOverviewMarkup+'</form>';
 const form=panel.querySelector('form'),field=name=>form.elements.namedItem(name);
 for(const el of form.querySelectorAll('[name]')){
  const key=aliases[el.name]||el.name;
  if(el.name.startsWith('product_')){el.dataset.officeProduct=el.name.slice(8);el.checked=client.status!=='deceased'&&!!client.products?.includes(el.dataset.officeProduct);}
  else if(el.name==='deceased'){el.dataset.officeDeceased='';el.checked=client.status==='deceased';}
  else if(!el.name.startsWith('banking_'))el.value=el.hasAttribute('data-date')?dateText(client[key]):String(client[key]??'');
  if(aliases[el.name])el.dataset.officeCoreKey=key;
 }
 form.querySelector('[data-client-glance-note]').name='notes';field('notes').value=client.notes||'';field('notes').maxLength=2000;
 form.querySelector('[data-client-add-appointment]').dataset.ocClientAppointment='';
 const review=document.createElement('button');review.type='button';review.dataset.clientAthena='';review.textContent='Medicare Review';
 form.querySelector('.client-overview-shortcuts').prepend(review);
 review.onclick=()=>{const current=window.officeCrmClientBridge.current();window.open((current.agency==='arctos'?'https://mh.mayerig.com/':'https://crm.mayerig.com/')+'#/athena-medicare','_blank','noopener');};
 form.addEventListener('change',event=>{
  if(event.target.matches('[data-office-deceased]')&&event.target.checked)form.querySelectorAll('[data-office-product]').forEach(el=>el.checked=false);
  if(event.target.matches('[data-office-product]')&&event.target.checked)field('deceased').checked=false;
  form.querySelectorAll('[data-banking-panel]').forEach(el=>el.hidden=el.dataset.bankingPanel!==field('banking_payment_method').value);
 });
 const summary=()=>{
  form.querySelector('[data-client-summary-name]').textContent=[field('first_name').value,field('last_name').value].filter(Boolean).join(' ')||'Client information';
  const dob=field('date_of_birth').value,parsed=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dob);let age='';
  if(parsed){const now=new Date();let years=now.getFullYear()-Number(parsed[3]);if(now.getMonth()+1<Number(parsed[1])||(now.getMonth()+1===Number(parsed[1])&&now.getDate()<Number(parsed[2])))years--;if(years>=0)age=' (Age: '+years+')';}
  form.querySelector('[data-client-summary-meta]').textContent=[dob?'DOB: '+dob+age:'',field('phone').value,[field('city').value,field('state').value].filter(Boolean).join(', '),field('zip').value?'ZIP: '+field('zip').value:''].filter(Boolean).join('  •  ')||'Enter or review the client details below.';
 };
 form.addEventListener('input',summary);summary();
};
window.officeArctosOverviewBind=root=>{
 const api=window.officeCrmClientBridge,current=api.current(),form=root.querySelector('[data-office-exact-overview]');if(!form)return;
 const field=name=>form.elements.namedItem(name),canEdit=!!current.permissions?.edit;
 const bank=form.querySelector('[data-client-banking-group]'),status=bank.querySelector('[data-banking-status]');
 const identifiers=[['ssn','ssn'],['license_number','drivers_license_number']];
 const canonical=new Map(),baselines=new Map();let bankLoaded=false,identifiersLoaded=false,hidden=false;
 for(const [name,key]of identifiers){const el=field(name);el.dataset.protectedInput=key;el.disabled=true;el.value='';}
 for(const el of bank.querySelectorAll('input,textarea,select')){el.disabled=true;el.dataset.protectedInput=el.name;}
 const bankMapping=method=>({banking_payment_method:'payment_method',...(method==='bank'?{banking_bank_name:'bank_name',banking_routing_number:'routing_number',banking_account_number:'account_number'}:method==='card'?{banking_card_number:'card_number',banking_card_expiration:'card_expiration',banking_card_notes:'card_notes'}:method==='direct_express'?{banking_direct_express_card_number:'card_number',banking_direct_express_expiration:'card_expiration',banking_direct_express_notes:'card_notes'}:['cashapp','chime','other'].includes(method)?{['banking_'+method+'_account_name']:'account_name',['banking_'+method+'_routing_number']:'routing_number',['banking_'+method+'_account_number']:'account_number',['banking_'+method+'_notes']:'payment_notes'}:{})});
 const baseline=el=>{el.dataset.initial=el.value;baselines.set(el,el.value);};
 const load=async()=>{
  await Promise.allSettled(['identifiers','banking'].map(async kind=>{
   try{
    const result=await api.request(current.agency,'secure_client',{client_id:current.id,kind});if(!root.isConnected||hidden)return;const data=result.data||{};
    if(kind==='identifiers'){
     for(const [name,key]of identifiers){const el=field(name);if(!identifiersLoaded||el.value===baselines.get(el)){el.value=data[key]||'';baseline(el);}el.disabled=!canEdit;}
     identifiersLoaded=true;
    }else{
     const method=data.payment_method|| (data.bank_name||data.account_number?'bank':'');
     canonical.clear();Object.entries(bankMapping(method)).forEach(([name,key])=>canonical.set(name,key));
     for(const el of bank.querySelectorAll('input,textarea,select')){
      if(!bankLoaded||el.value===baselines.get(el)){const key=canonical.get(el.name);el.value=key==='payment_method'?method:key==='card_number'?'':key?String(data[key]??''):'';baseline(el);}
      el.disabled=!canEdit;if(canonical.get(el.name)==='card_number'&&data.card_last4)el.placeholder='Saved ending in '+data.card_last4;
     }
     bankLoaded=true;status.textContent='Banking information is stored encrypted when saved.';
     form.querySelectorAll('[data-banking-panel]').forEach(el=>el.hidden=el.dataset.bankingPanel!==field('banking_payment_method').value);
    }
   }catch(error){
    const text='Unable to load saved '+kind+': '+error.message;
    if(kind==='banking')status.textContent=text;
    else for(const [name]of identifiers){const el=field(name);el.setAttribute('aria-label',text);el.placeholder=text;}
   }
  }));
 };
 root.officeSaveExactProtected=async()=>{
  const values={};for(const [name,key]of identifiers){const el=field(name);if(identifiersLoaded&&!el.disabled&&el.value!==baselines.get(el))values[key]=el.value;}
  if(Object.keys(values).length){await api.request(current.agency,'save_sensitive',{client_id:current.id,kind:'identifiers',values});identifiers.forEach(([name])=>baseline(field(name)));}
  const changed=bankLoaded&&[...bank.querySelectorAll('input,textarea,select')].some(el=>!el.disabled&&el.name!=='banking_cvv'&&el.value!==baselines.get(el));
  if(changed){
   if(!bankLoaded)throw Error('Wait for banking information to load.');
   const method=field('banking_payment_method').value,mapping=bankMapping(method),values={};
   for(const [name,key]of Object.entries(mapping)){const el=field(name);if(el.value!==baselines.get(el))values[key]=el.value;}
   if(Object.keys(values).length)await api.request(current.agency,'save_sensitive',{client_id:current.id,kind:'banking',values});
   // Hidden method drafts remain unsaved until that method is selected.
   Object.keys(mapping).forEach(name=>baseline(field(name)));status.textContent='Banking information saved securely.';
  }
 };
 const manual=form.querySelector('[data-client-review-manual]'),reviewStatus=form.querySelector('[data-client-review-status]'),year=new Date().getFullYear();
 const reviews=current.details?.client_review_manual||[];manual.checked=reviews.some(row=>row.review_year===year&&row.completed);manual.disabled=!canEdit||!!current.errors?.client_review_manual;
 const updateReviewStatus=()=>{const automatic=(current.details?.athena_medicare_reviews||[]).filter(row=>row.workflow_status==='completed').map(row=>row.review_date).filter(Boolean).sort().reverse();const latest=automatic[0];reviewStatus.textContent=current.errors?.client_review_manual||current.errors?.athena_medicare_reviews?'Could not load all review records.':(latest?'✓ Athena review complete: '+latest+' · ':'')+(manual.checked?'✓ Marked complete manually':(!latest?'No completed reviews recorded':''));};updateReviewStatus();
 manual.onchange=async()=>{const checked=manual.checked;manual.disabled=true;reviewStatus.textContent='Saving review checkoff…';try{const result=await api.request(current.agency,'save_review_checkoff',{client_id:current.id,review_year:year,completed:checked});if(!result.saved)throw Error('Save was not confirmed.');root.officeRememberControl?.(manual);updateReviewStatus();}catch(error){manual.checked=!checked;reviewStatus.textContent='Save failed: '+error.message;}finally{manual.disabled=!canEdit;}};
 const campaign=form.querySelector('[data-client-add-campaign]'),campaignStatus=form.querySelector('[data-client-campaign-status]');
 campaign.disabled=!canEdit;
 campaign.onclick=async()=>{
  campaign.disabled=true;campaignStatus.textContent='Loading campaigns…';
  try{
   const result=await api.request(current.agency,'campaigns');if(!root.isConnected)return;
   const picker=document.createElement('dialog');picker.className='office-campaign-picker';picker.innerHTML='<form method="dialog"><h3>Add to Campaign</h3><label class="field"><span>Campaign</span><select required></select></label><p role="status"></p><button value="cancel">Cancel</button><button type="button" class="primary">Add Client</button></form>';
   const select=picker.querySelector('select');for(const row of result.campaigns||[]){const option=document.createElement('option');option.value=row.id;option.textContent=row.name;select.append(option);}
   root.append(picker);picker.showModal();campaignStatus.textContent='';picker.onclose=()=>picker.remove();
   picker.querySelector('button[type=button]').onclick=async event=>{event.target.disabled=true;try{if(!select.value)throw Error('Choose a campaign.');await api.request(current.agency,'add_client_to_campaign',{client_id:current.id,campaign_id:select.value});campaignStatus.textContent='Client added to campaign.';picker.close();}catch(error){picker.querySelector('[role=status]').textContent=error.message;}finally{event.target.disabled=false;}};
  }catch(error){campaignStatus.textContent=error.message;}finally{campaign.disabled=!canEdit;}
 };
 // Clear protected values when hidden, then re-authorize their reload.
 const visibility=()=>{hidden=document.visibilityState==='hidden';if(hidden){for(const el of form.querySelectorAll('[data-protected-input]')){el.value='';baseline(el);el.disabled=true;}identifiersLoaded=bankLoaded=false;}else void load();};
 document.addEventListener('visibilitychange',visibility);
 const observer=new MutationObserver(()=>{if(!root.isConnected){document.removeEventListener('visibilitychange',visibility);observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
 void load();
};
})();
