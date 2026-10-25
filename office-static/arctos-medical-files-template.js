/* Generated from the actual Arctos Medical and Notes & Files modules. */
window.officeArctosMedicalFilesMarkup={"medical":"<section role=\"tabpanel\" data-client-group-panel=\"medical\" id=\"client-group-panel-medical\" aria-labelledby=\"client-group-tab-medical\" hidden=\"\"><div class=\"client-group-heading\"><strong>Medical Information</strong><p>Doctors, current medications, pharmacies and supporting files.</p></div><details class=\"client-category\" data-client-category=\"doctors\"><summary><span><strong>Doctors</strong><small>Providers, specialties and office locations</small></span><span class=\"client-category-chevron\" aria-hidden=\"true\">⌄</span></summary><section class=\"client-category-body\" id=\"client-panel-doctors\" data-panel=\"doctors\"><div class=\"health-tab-toolbar\"><div><h3>Doctors</h3><p>Keep each doctor and office location as a separate record.</p></div><button type=\"button\" class=\"btn primary\" data-add-health-record=\"doctors\">+ Add Doctor</button></div>\n    <label class=\"field health-doctors-general-notes\"><span>Doctors Section Notes</span><textarea name=\"doctors_section_notes\" rows=\"4\" placeholder=\"General notes about this client's doctors, referrals, or appointments\"></textarea></label>\n    <div class=\"health-record-list\" data-health-list=\"doctors\"></div>\n    <div class=\"health-tab-empty\" data-health-empty=\"doctors\">No doctors saved yet. Use the Add button above.</div>\n    </section></details><details class=\"client-category\" data-client-category=\"medications\"><summary><span><strong>Medications &amp; Pharmacies</strong><small>Prescriptions, pharmacies and medication files</small></span><span class=\"client-category-chevron\" aria-hidden=\"true\">⌄</span></summary><section class=\"client-category-body\" id=\"client-panel-medications\" data-panel=\"medications\"><section class=\"pharmacy-panel\" data-pharmacy-panel=\"\">\n    <div class=\"pharmacy-panel-head\">\n      <div><h3>Pharmacy Information</h3><p>Keep the client's preferred pharmacy and medication-related files together.</p></div>\n    </div>\n    <div class=\"pharmacy-fields form-grid\">\n      <label class=\"field\"><span>Primary Pharmacy Name</span><input name=\"pharmacy_name\" value=\"\" autocomplete=\"off\"></label>\n      <label class=\"field\"><span>Primary Pharmacy Location</span><input name=\"pharmacy_location\" value=\"\" placeholder=\"Address, city, or location\" autocomplete=\"off\"></label>\n      <label class=\"field\"><span>Second Pharmacy Name</span><input name=\"pharmacy_name_2\" value=\"\" autocomplete=\"off\"></label>\n      <label class=\"field\"><span>Second Pharmacy Location</span><input name=\"pharmacy_location_2\" value=\"\" placeholder=\"Address, city, or location\" autocomplete=\"off\"></label>\n      <label class=\"field span-all\"><span>Medication / Pharmacy Notes</span><textarea name=\"medication_notes\" rows=\"4\" placeholder=\"Add notes about medications, pharmacies, refill details, or anything else important.\"></textarea></label>\n    </div>\n    <div class=\"pharmacy-file-head\">\n      <div><strong>Medication / Pharmacy Files</strong><span>Upload medication lists, pharmacy printouts, prescription photos, or other related files.</span></div>\n      <div class=\"pharmacy-file-actions\">\n        <label class=\"btn secondary\">Upload Files<input type=\"file\" data-pharmacy-files=\"\" multiple=\"\" accept=\".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt\" hidden=\"\"></label>\n        <label class=\"btn secondary\">Camera / Scan<input type=\"file\" data-pharmacy-camera=\"\" accept=\"image/*\" capture=\"environment\" hidden=\"\"></label>\n      </div>\n    </div>\n    <div class=\"pharmacy-file-list\" data-pharmacy-file-list=\"\"><div class=\"pharmacy-file-empty\">No medication or pharmacy files uploaded yet.</div></div>\n    <div class=\"pharmacy-file-status\" data-pharmacy-status=\"\" role=\"status\" aria-live=\"polite\">0 medication/pharmacy files stored.</div>\n  </section><div class=\"health-tab-toolbar\"><div><h3>Medications</h3><p>Keep each current or inactive medication as its own record.</p></div></div>\n    \n    <div class=\"health-record-list\" data-health-list=\"medications\"></div>\n    <div class=\"health-tab-empty\" data-health-empty=\"medications\">No medications saved yet. Use the Add Medication button below.</div>\n    <div class=\"health-tab-bottom-actions\"><button type=\"button\" class=\"btn primary\" data-add-health-record=\"medications\">+ Add Medication</button></div></section></details></section>","files":"<section role=\"tabpanel\" data-client-group-panel=\"files\" id=\"client-group-panel-files\" aria-labelledby=\"client-group-tab-files\" hidden=\"\"><div class=\"client-group-heading\"><strong>Notes &amp; Files</strong><p>Keep client notes and additional documents together. Medicare cards, SOA forms and policy documents remain accessible within their coverage sections.</p></div><section id=\"client-panel-notes\" data-panel=\"notes\"><section class=\"client-files-hub\" data-client-files-hub=\"\" aria-label=\"All client notes and documents\"><div class=\"cfh-intro\"><div><span class=\"eyebrow\">ONE CLIENT FILE LOCATION</span><h3>All Client Files</h3><p>Find files from Medicare, SOA, life policies, hospital plans, pharmacies, and general uploads. Original file locations and policy links stay intact.</p></div><button type=\"button\" class=\"btn secondary\" data-cfh-refresh=\"\">Refresh</button></div><div class=\"cfh-categories\" role=\"group\" aria-label=\"Filter client files\"><button type=\"button\" data-cfh-filter=\"all\" aria-pressed=\"true\">All Files <span>0</span></button><button type=\"button\" data-cfh-filter=\"medicare\" aria-pressed=\"false\">Medicare &amp; SOA <span>0</span></button><button type=\"button\" data-cfh-filter=\"life\" aria-pressed=\"false\">Life Insurance <span>0</span></button><button type=\"button\" data-cfh-filter=\"medical\" aria-pressed=\"false\">Medical &amp; Pharmacy <span>0</span></button><button type=\"button\" data-cfh-filter=\"hospital\" aria-pressed=\"false\">Hospital Indemnity <span>0</span></button><button type=\"button\" data-cfh-filter=\"general\" aria-pressed=\"false\">General &amp; Other <span>0</span></button></div><label class=\"cfh-search\"><span>Search client documents</span><input type=\"search\" data-cfh-search=\"\" placeholder=\"File name, category, or description\" autocomplete=\"off\"></label><div class=\"cfh-status\" data-cfh-status=\"\" role=\"status\" aria-live=\"polite\">0 files available.</div><div class=\"cfh-records\" data-cfh-list=\"\"><p class=\"cfh-empty\">No documents match this filter.</p></div><div class=\"cfh-where\"><strong>Need to upload more?</strong><p>Use the original upload controls for coverage-specific files. General files can be added below.</p><div class=\"cfh-jumps\"><button type=\"button\" data-cfh-jump=\"medicare\">Medicare &amp; SOA</button><button type=\"button\" data-cfh-jump=\"life\">Life policies</button><button type=\"button\" data-cfh-jump=\"hospital_indemnity\">Hospital plans</button><button type=\"button\" data-cfh-jump=\"medications\">Medical &amp; pharmacy</button><button type=\"button\" data-cfh-general=\"\">General uploads ↓</button></div></div><section class=\"cfh-notes-history\" aria-label=\"Client note history\"><div class=\"cfh-notes-head\"><div><h3>Saved Client Notes</h3><p>Individual notes previously saved to this client.</p></div></div><div class=\"cfh-notes-list\" data-cfh-notes-list=\"\"><p class=\"cfh-empty\">No separate client notes have been saved.</p></div><details class=\"cfh-new-note\"><summary>+ Add a Client Note</summary><div class=\"cfh-note-editor\"><label><span>Note Title</span><input data-cfh-note-title=\"\" maxlength=\"160\" placeholder=\"Follow-up, review, or phone call\" autocomplete=\"off\"></label><label><span>Note</span><textarea data-cfh-note-body=\"\" maxlength=\"10000\" rows=\"3\" placeholder=\"Enter client-specific note\"></textarea></label><button type=\"button\" class=\"btn primary\" data-cfh-note-save=\"\">Save Note</button></div></details><p class=\"cfh-note-message\" data-cfh-note-message=\"\" role=\"status\" aria-live=\"polite\"></p></section></section><details class=\"field-group\" data-initial-collapse=\"true\"><summary>Client Notes</summary><div class=\"form-grid\"><label class=\"field span-all\"><span>Notes</span><textarea name=\"notes\" rows=\"5\" placeholder=\"Client-specific notes\"></textarea></label></div></details><details class=\"cfh-general-uploader\"><summary>General File Uploads &amp; Management</summary><section class=\"client-documents-panel notes-extras-documents\" data-notes-extras-documents=\"\">\n  <div class=\"document-manager-head\"><div><h3>Documents / Extras</h3><p>Upload multiple general client documents, photos, forms, IDs, or other supporting files here.</p></div></div>\n  <div class=\"document-upload-card\">\n    <label class=\"document-category\"><span>Document Type</span><select data-extras-category=\"\"><option value=\"extra_document\">Other / Extra</option><option value=\"application\">Application</option><option value=\"insurance_policy\">Insurance Policy</option><option value=\"id\">Identification</option></select></label>\n    <label class=\"document-file-picker\"><span>Choose Documents</span><input type=\"file\" data-extras-files=\"\" multiple=\"\" accept=\".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt\"></label>\n    <button type=\"button\" class=\"btn primary\" data-extras-upload=\"\">Upload Securely</button>\n    <label class=\"btn secondary document-camera\">Camera / Scan<input type=\"file\" data-extras-camera=\"\" accept=\"image/*\" capture=\"environment\" hidden=\"\"></label>\n  </div>\n  <div class=\"document-status\" data-extras-status=\"\" role=\"status\" aria-live=\"polite\">0 extra documents stored.</div>\n  <div class=\"document-list\" data-extras-list=\"\"><div class=\"document-empty\"><strong>No extra documents uploaded yet.</strong><span>You can add one file or several at a time.</span></div></div>\n</section></details></section></section>"};
window.officeArctosMedicalCards={"doctor":"<details class=\"health-record-card health-doctor\" data-health-card=\"\" data-kind=\"doctor\" data-index=\"0\">\n    <summary><span><strong data-health-title=\"\">Doctor 1</strong><small>Doctor information</small></span><b aria-hidden=\"true\">⌄</b></summary>\n    <div class=\"health-record-body form-grid\"><input type=\"hidden\" name=\"doctor_0_id\" value=\"22222222-2222-4222-8222-222222222222\"><label class=\"field\"><span>Doctor Name</span><input name=\"doctor_0_doctor_name\" value=\"\"></label><label class=\"field\"><span>Specialty</span><select name=\"doctor_0_specialty\"><option value=\"\" selected=\"\">Choose Specialty</option><option value=\"Primary Care Physician\">Primary Care Physician</option><option value=\"Family Medicine\">Family Medicine</option><option value=\"Internal Medicine\">Internal Medicine</option><option value=\"Cardiology\">Cardiologist / Cardiology</option><option value=\"Neurology\">Neurologist / Neurology</option><option value=\"Urology\">Urologist / Urology</option><option value=\"Optometry\">Optometrist / Optometry</option><option value=\"Ophthalmology\">Ophthalmologist / Ophthalmology</option><option value=\"Dentistry\">Dentist / Dentistry</option><option value=\"Orthopedics\">Orthopedics</option><option value=\"Pulmonology\">Pulmonology</option><option value=\"Gastroenterology\">Gastroenterology</option><option value=\"Endocrinology\">Endocrinology</option><option value=\"Nephrology\">Nephrology</option><option value=\"Rheumatology\">Rheumatology</option><option value=\"Dermatology\">Dermatology</option><option value=\"Oncology\">Oncology</option><option value=\"Hematology\">Hematology</option><option value=\"Psychiatry\">Psychiatry</option><option value=\"Pain Management\">Pain Management</option><option value=\"ENT / Otolaryngology\">ENT / Otolaryngology</option><option value=\"Podiatry\">Podiatry</option><option value=\"General Surgery\">General Surgery</option><option value=\"Vascular Surgery\">Vascular Surgery</option><option value=\"Allergy &amp; Immunology\">Allergy &amp; Immunology</option><option value=\"Infectious Disease\">Infectious Disease</option><option value=\"OB/GYN\">OB/GYN</option><option value=\"Other / Not Listed\">Other / Not Listed</option></select></label><label class=\"field\"><span>Practice / Facility</span><input name=\"doctor_0_practice_name\" value=\"\"></label><label class=\"field\"><span>Phone</span><input name=\"doctor_0_phone\" value=\"\" type=\"tel\"></label><label class=\"field\"><span>Fax</span><input name=\"doctor_0_fax\" value=\"\" type=\"tel\"></label><label class=\"field\"><span>Address</span><input name=\"doctor_0_address\" value=\"\"></label><label class=\"field\"><span>City</span><input name=\"doctor_0_city\" value=\"\"></label><label class=\"field\"><span>State</span><input name=\"doctor_0_state\" value=\"\"></label><label class=\"field\"><span>ZIP Code</span><input name=\"doctor_0_zip_code\" value=\"\"></label><label class=\"field span-all\"><span>Doctor Notes</span><textarea name=\"doctor_0_notes\" rows=\"4\"></textarea></label><div class=\"health-record-actions span-all\"><button type=\"button\" class=\"btn danger\" data-remove-health-record=\"\">Remove</button></div></div>\n  </details>","medication":"<details class=\"health-record-card health-medication\" data-health-card=\"\" data-kind=\"medication\" data-index=\"0\">\n    <summary><span><strong data-health-title=\"\">Medication 1</strong><small>Medication information</small></span><b aria-hidden=\"true\">⌄</b></summary>\n    <div class=\"health-record-body form-grid\"><input type=\"hidden\" name=\"medication_0_id\" value=\"33333333-3333-4333-8333-333333333333\"><label class=\"field\"><span>Medication</span><input name=\"medication_0_medication_name\" value=\"\"></label><label class=\"field\"><span>Strength</span><input name=\"medication_0_strength\" value=\"\"></label><label class=\"field\"><span>Dosage</span><input name=\"medication_0_dosage\" value=\"\"></label><label class=\"field\"><span>Frequency</span><input name=\"medication_0_frequency\" value=\"\"></label><label class=\"field\"><span>Prescribing Doctor</span><input name=\"medication_0_prescribing_doctor\" value=\"\"></label><label class=\"field\"><span>Purpose / Condition</span><input name=\"medication_0_purpose\" value=\"\"></label><label class=\"field\"><span>Status</span><select name=\"medication_0_status\"><option value=\"active\" selected=\"\">Active</option><option value=\"inactive\">Inactive</option></select></label><label class=\"field span-all\"><span>Medication Notes</span><textarea name=\"medication_0_notes\" rows=\"4\"></textarea></label><div class=\"health-record-actions span-all\"><button type=\"button\" class=\"btn danger\" data-remove-health-record=\"\">Remove</button></div></div>\n  </details>"};

/* Original file hub, filters, note history, and previews, using an Office data adapter. */
window.officeArctosFilesUi=function(apiAdapter){const supabase=apiAdapter.supabase,mhRepository=apiAdapter.repository;
// One read-only index over each client's existing document categories.
// Never move, rename, or silently change the category or policy association.
const FILE_GROUPS=Object.freeze([
  {key:'all',name:'All Files'},
  {key:'medicare',name:'Medicare & SOA'},
  {key:'life',name:'Life Insurance'},
  {key:'medical',name:'Medical & Pharmacy'},
  {key:'hospital',name:'Hospital Indemnity'},
  {key:'general',name:'General & Other'}
]);
const medicare=new Set(['medicare_card','medicaid_card','health_plan_card','health_plan','health_plan_document','medicare_document','medicare_photo','card_information','soa','scope_of_appointment','medicare','medicaid']);
const life=new Set(['life_policy_document','life_insurance','life_policy']);
const medical=new Set(['medication_document','pharmacy_document','medication_list','medical_document','doctor_document','provider_document']);
const hospital=new Set(['hospital_indemnity','hospital_indemnity_document','hospital_indemnity_plan_document']);
function fileGroup(category){
 const key=String(category||'').toLowerCase().trim();
 if(medicare.has(key))return'medicare';
 if(life.has(key))return'life';
 if(medical.has(key))return'medical';
 if(hospital.has(key))return'hospital';
 return'general';
}
const fileCategoryLabel=category=>String(category||'Other').trim().replace(/[_-]+/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
function fileIndex(records=[],filter='all',search=''){
 const needle=String(search||'').trim().toLowerCase();
 return (Array.isArray(records)?records:[]).filter(record=>
   (filter==='all'||fileGroup(record.category)===filter) &&
   (!needle || [record.file_name,record.category,record.notes].some(value=>String(value||'').toLowerCase().includes(needle)))
 );
}
function fileGroupCounts(records=[]){
 const counts={all:0,medicare:0,life:0,medical:0,hospital:0,general:0};
 for(const row of (Array.isArray(records)?records:[])){
  counts.all++;
  counts[fileGroup(row.category)]++;
 }
 return counts;
}




const BUCKET='mh-client-documents';
const PAGE=200,MAX_ROWS=4000,FILES_REFRESH_MS=20000;
const contexts=new WeakMap();
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const humanSize=value=>{const n=Number(value||0);return n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?(n/1024).toFixed(1)+' KB':n+' B';};
const displayDate=value=>{if(!value)return '';const d=new Date(value);return Number.isNaN(d.valueOf())?'':d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});};

async function readFiles(id){
 const records=[];
 for(let start=0;start<MAX_ROWS;start+=PAGE){
  const {data,error}=await supabase.from('documents')
   .select('id,client_id,category,file_name,storage_path,mime_type,file_size,notes,created_at')
   .eq('client_id',id).order('created_at',{ascending:false}).order('id',{ascending:false})
   .range(start,start+PAGE-1);
  if(error)throw error;
  records.push(...(data||[]));
  if(!data||data.length<PAGE)break;
 }
 return {records,limited:records.length>=MAX_ROWS};
}
async function readNotes(id){
 const {data,error}=await supabase.from('client_notes')
  .select('id,client_id,title,body,author_id,created_at,updated_at')
  .eq('client_id',id).order('created_at',{ascending:false}).limit(40);
 if(error)throw error;
 return data||[];
}
function markup(){
 return '<section class="client-files-hub" data-client-files-hub aria-label="All client notes and documents">'+
  '<div class="cfh-intro"><div><span class="eyebrow">ONE CLIENT FILE LOCATION</span><h3>All Client Files</h3>'+
  '<p>Find files from Medicare, SOA, life policies, hospital plans, pharmacies, and general uploads. Original file locations and policy links stay intact.</p></div>'+
  '<button type="button" class="btn secondary" data-cfh-refresh>Refresh</button></div>'+
  '<div class="cfh-categories" role="group" aria-label="Filter client files"></div>'+
  '<label class="cfh-search"><span>Search client documents</span><input type="search" data-cfh-search placeholder="File name, category, or description" autocomplete="off"></label>'+
  '<div class="cfh-status" data-cfh-status role="status" aria-live="polite">Open this tab to load client files.</div>'+
  '<div class="cfh-records" data-cfh-list></div>'+
  '<div class="cfh-where"><strong>Need to upload more?</strong>'+
  '<p>Use the original upload controls for coverage-specific files. General files can be added below.</p>'+
  '<div class="cfh-jumps"><button type="button" data-cfh-jump="medicare">Medicare &amp; SOA</button>'+
  '<button type="button" data-cfh-jump="life">Life policies</button>'+
  '<button type="button" data-cfh-jump="hospital_indemnity">Hospital plans</button>'+
  '<button type="button" data-cfh-jump="medications">Medical &amp; pharmacy</button>'+
  '<button type="button" data-cfh-general>General uploads ↓</button></div></div>'+
  '<section class="cfh-notes-history" aria-label="Client note history">'+
  '<div class="cfh-notes-head"><div><h3>Saved Client Notes</h3><p>Individual notes previously saved to this client.</p></div></div>'+
  '<div class="cfh-notes-list" data-cfh-notes-list></div>'+
  '<details class="cfh-new-note"><summary>+ Add a Client Note</summary>'+
  '<div class="cfh-note-editor"><label><span>Note Title</span><input data-cfh-note-title maxlength="160" placeholder="Follow-up, review, or phone call" autocomplete="off"></label>'+
  '<label><span>Note</span><textarea data-cfh-note-body maxlength="10000" rows="3" placeholder="Enter client-specific note"></textarea></label>'+
  '<button type="button" class="btn primary" data-cfh-note-save>Save Note</button></div></details>'+
  '<p class="cfh-note-message" data-cfh-note-message role="status" aria-live="polite"></p></section>'+
  '</section>';
}
function openFileModal(record,url){
 const mime=String(record.mime_type||'').toLowerCase();
 const isImage=['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(mime);
 const isPdf=mime==='application/pdf';
 const modal=document.createElement('dialog');
 modal.className='mh-file-preview-dialog cfh-preview office-file-preview';
 modal.innerHTML='<div class="mh-file-preview-frame"><header class="mh-file-preview-head">'+
  '<div><h2>'+esc(record.file_name||'Document')+'</h2><p>'+esc(fileCategoryLabel(record.category))+' · Secure client file</p></div>'+
  '<div class="mh-file-preview-actions"><button type="button" class="btn secondary" data-cfh-download>Download</button>'+
  '<button type="button" class="modal-close" data-cfh-close aria-label="Close file preview">×</button></div></header>'+
  '<div class="mh-file-preview-body">'+(isImage?'<img alt="'+esc(record.file_name||'Document')+'" src="'+esc(url)+'">':
    isPdf?'<iframe title="'+esc(record.file_name||'PDF document')+'" src="'+esc(url)+'"></iframe>':
     '<div class="mh-file-preview-unavailable"><strong>Preview unavailable for this file type.</strong><span>Use Download to open the original document.</span></div>')+
  '</div><div class="cfh-preview-error" data-cfh-preview-error role="status"></div></div>';
 document.body.append(modal);apiAdapter.onPreview?.(modal);
 const finish=()=>{if(modal.isConnected){modal.close();modal.remove();}};
 modal.querySelector('[data-cfh-close]').onclick=finish;
 modal.addEventListener('cancel',e=>{e.preventDefault();finish();});
 modal.addEventListener('click',e=>{if(e.target===modal)finish();});
 modal.querySelector('[data-cfh-download]').onclick=async e=>{
  const btn=e.currentTarget;btn.disabled=true;
  try{
   const response=await fetch(url);
   if(!response.ok)throw Error('Could not download this secure document.');
   const blob=await response.blob(),objectURL=URL.createObjectURL(blob);
   const link=document.createElement('a');link.href=objectURL;link.download=record.file_name||'client-document';
   document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(objectURL),1000);
  }catch(error){modal.querySelector('[data-cfh-preview-error]').textContent=error?.message||'Download failed.';}
  finally{btn.disabled=false;}
 };
 modal.showModal();
}

function renderFiles(state){
 const host=state.host;
 if(!host?.isConnected)return;
 const cats=host.querySelector('.cfh-categories');
 const counts=fileGroupCounts(state.records);
 cats.innerHTML=FILE_GROUPS.map(({key,name})=>'<button type="button" data-cfh-filter="'+esc(key)+'" aria-pressed="'+(state.filter===key)+'">'+
  esc(name)+' <span>'+counts[key]+'</span></button>').join('');
 const rows=fileIndex(state.records,state.filter,state.query);
 host.querySelector('[data-cfh-list]').innerHTML=!state.loaded?'':rows.length?
  rows.slice(0,120).map(record=>'<article class="cfh-file" data-cfh-file="'+esc(record.id)+'">'+
   '<div class="cfh-file-info"><strong>'+esc(record.file_name||'Untitled Document')+'</strong>'+
   '<small>'+esc(fileCategoryLabel(record.category))+' · '+esc(humanSize(record.file_size))+
    (record.created_at?' · '+esc(displayDate(record.created_at)):'')+'</small></div>'+
   (record.storage_path?'<button type="button" class="btn secondary" data-cfh-view>View</button>':
      '<span class="cfh-unavailable">Original file unavailable</span>')+'</article>').join('')+
   (rows.length>120?'<p class="cfh-more">Showing 120 of '+rows.length+' matching documents. Search or choose a category to narrow the list.</p>':''):
  '<p class="cfh-empty">No documents match this filter.</p>';
 const status=host.querySelector('[data-cfh-status]');
 if(state.loading)status.textContent='Loading your secure client files…';
 else if(state.error)status.textContent=state.error;
 else if(!state.clientId)status.textContent='Save this client first. Notes and general uploads can be prepared below.';
 else status.textContent=counts.all+' file'+(counts.all===1?'':'s')+' available'+(state.limited?' · large collection, showing up to 4,000 records':'')+'.';
}
function renderNotes(state){
 const host=state.host;if(!host?.isConnected)return;
 const list=host.querySelector('[data-cfh-notes-list]');
 if(!state.clientId){
  list.innerHTML='<p class="cfh-empty">Save this client before adding separate saved notes.</p>';return;
 }
 list.innerHTML=state.notes.length?state.notes.map(note=>
  '<details class="cfh-note" data-cfh-note="'+esc(note.id)+'"><summary><strong>'+esc(note.title||'Untitled Note')+'</strong>'+
   '<small>'+esc(displayDate(note.created_at||note.updated_at))+'</small></summary>'+
   '<p>'+esc(note.body||'')+'</p><button type="button" class="btn danger" data-cfh-delete-note>Delete Note</button></details>').join(''):
  '<p class="cfh-empty">No separate client notes have been saved.</p>';
}
function bind(dialog){
 if(!dialog.classList.contains('oc-arctos-client-dialog'))return;
 const notesPanel=dialog.querySelector('[data-panel="notes"]');
 if(!notesPanel||notesPanel.querySelector('[data-client-files-hub]'))return;
 const wrap=document.createElement('div');wrap.innerHTML=markup();
 const host=wrap.firstElementChild;
 notesPanel.prepend(host);
 const state={host,dialog,records:[],notes:[],loaded:false,loadedAt:0,loading:false,refreshPending:false,limited:false,error:'',filter:'all',query:'',clientId:'',request:0};
 contexts.set(dialog,state);
 const currentId=()=>dialog.dataset.clientId||'';
 async function reload(force=false){
  if(state.loading){if(force)state.refreshPending=true;return;}
  const id=currentId();
  if(!force && state.loaded && state.clientId===id && Date.now()-state.loadedAt<FILES_REFRESH_MS)return;
  const ticket=++state.request;
  state.clientId=id;
  if(!id){state.records=[];state.notes=[];state.loaded=true;state.loadedAt=Date.now();renderFiles(state);renderNotes(state);return;}
  state.loading=true;state.error='';renderFiles(state);
  const [files,notes]=await Promise.allSettled([readFiles(id),readNotes(id)]);
  if(!dialog.isConnected||ticket!==state.request)return;
  if(files.status==='fulfilled'){
   state.records=files.value.records;state.limited=files.value.limited;
  }else state.error='Files: '+(files.reason?.message||'Could not load documents.');
  if(notes.status==='fulfilled')state.notes=notes.value;
  else state.error+=(state.error?' · ':'')+'Notes: '+(notes.reason?.message||'Could not load notes.');
  state.loaded=true;state.loadedAt=Date.now();state.loading=false;renderFiles(state);renderNotes(state);
  if(state.refreshPending){state.refreshPending=false;void reload(true);}
 }
 host.querySelector('[data-cfh-refresh]').onclick=()=>void reload(true);
 host.querySelector('[data-cfh-search]').oninput=e=>{state.query=e.target.value;renderFiles(state);};
 host.querySelector('.cfh-categories').addEventListener('click',event=>{
  const b=event.target.closest('[data-cfh-filter]');
  if(!b)return;state.filter=b.dataset.cfhFilter;renderFiles(state);
 });
 host.querySelector('[data-cfh-list]').addEventListener('click',async event=>{
  const button=event.target.closest('[data-cfh-view]');if(!button)return;
  const row=button.closest('[data-cfh-file]');
  const record=state.records.find(x=>x.id===row?.dataset.cfhFile);
  if(!record?.storage_path||record.client_id!==currentId())return;
  button.disabled=true;
  try{
   const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(record.storage_path,120);
   if(error)throw error;if(!data?.signedUrl)throw Error('The secure file could not be opened.');
   openFileModal(record,data.signedUrl);
  }catch(error){state.error=error?.message||'Unable to open document.';renderFiles(state);}
  finally{button.disabled=false;}
 });
 host.querySelectorAll('[data-cfh-jump]').forEach(button=>button.onclick=()=>{
  dialog.querySelector('[data-tab="'+button.dataset.cfhJump+'"]')?.click();
 });
 host.querySelector('[data-cfh-general]').onclick=()=>{
  const general=notesPanel.querySelector('.cfh-general-uploader');
  if(general){general.open=true;general.scrollIntoView({block:'start',behavior:'smooth'});}
 };
 host.querySelector('[data-cfh-note-save]').onclick=async ()=>{
  const button=host.querySelector('[data-cfh-note-save]');
  const title=host.querySelector('[data-cfh-note-title]'),body=host.querySelector('[data-cfh-note-body]'),message=host.querySelector('[data-cfh-note-message]');
  const clientId=currentId(),userId=mhRepository.user?.id;
  if(!clientId||!userId){message.textContent='Save this client and sign in before adding a note.';return;}
  if(!title.value.trim()||!body.value.trim()){message.textContent='Enter a note title and the note text.';return;}
  button.disabled=true;message.textContent='Saving the note…';
  try{
   const {error}=await supabase.from('client_notes').insert({
    client_id:clientId,author_id:userId,title:title.value.trim(),body:body.value.trim()
   });
   if(error)throw error;
   title.value='';body.value='';message.textContent='Client note saved.';
   const {data,error:notesError}=await supabase.from('client_notes')
      .select('id,client_id,title,body,author_id,created_at,updated_at')
      .eq('client_id',clientId).order('created_at',{ascending:false}).limit(40);
   if(notesError)throw notesError;
   state.notes=data||[];renderNotes(state);
  }catch(error){message.textContent=error?.message||'Unable to save client note. Your text is still here.';}
  finally{button.disabled=false;}
 };
 host.querySelector('[data-cfh-notes-list]').addEventListener('click',async event=>{
  const button=event.target.closest('[data-cfh-delete-note]');
  if(!button)return;
  const row=button.closest('[data-cfh-note]'),id=row?.dataset.cfhNote,clientId=currentId();
  if(!id||!clientId||!confirm('Delete this client note permanently?'))return;
  button.disabled=true;
  try{
   const {error}=await supabase.from('client_notes').delete().eq('id',id).eq('client_id',clientId);
   if(error)throw error;
   state.notes=state.notes.filter(note=>note.id!==id);renderNotes(state);
   host.querySelector('[data-cfh-note-message]').textContent='Note deleted.';
  }catch(error){button.disabled=false;host.querySelector('[data-cfh-note-message]').textContent=error?.message||'Unable to delete note.';}
 });
 dialog.addEventListener('click',event=>{
  if(event.target.closest('[data-client-group-tab="files"],[data-tab="notes"]'))void reload();
 });
 dialog.addEventListener('arctos:client-file-change',()=>void reload(true));
 renderFiles(state);renderNotes(state);
 if(dialog.querySelector('[data-client-group-tab="files"]')?.getAttribute('aria-selected')==='true')void reload();
}
// Install on native client dialogs only; unrelated CRM DOM updates no longer
// trigger Notes & Files binding work.
return {bind,openFileModal};

};

/* Original Arctos medication suggestions and dosage controls. */
window.officeArctosMedicationUi=function(apiAdapter){const root=apiAdapter.root;

const suggestionCache = new Map();
const states = new WeakMap();

const isMedicationName = input => input instanceof HTMLInputElement && /^medication_\d+_medication_name$/.test(input.name);
const cardFor = input => input.closest?.('[data-health-card][data-kind="medication"]') || null;

function stateFor(input) {
  let state = states.get(input);
  if (!state) {
    state = { timer: 0, controller: null, request: 0, menu: null, status: null };
    states.set(input, state);
  }
  return state;
}

function prepareCard(card) {
  if (!card || card.dataset.medicationLookupReady === 'true') return;
  card.dataset.medicationLookupReady = 'true';
  const name = card.querySelector('input[name$="_medication_name"]');
  const strength = card.querySelector('[name$="_strength"]');
  const dosage = card.querySelector('input[name$="_dosage"]');
  if (name instanceof HTMLInputElement) {
    name.autocomplete = 'off';
    name.spellcheck = false;
    name.placeholder = 'Start typing a medication name';
    name.setAttribute('aria-autocomplete', 'list');
    name.setAttribute('aria-expanded', 'false');
    name.closest('label.field')?.classList.add('medication-name-field');
  }
  const strengthLabel = strength?.closest?.('label.field')?.querySelector(':scope > span');
  if (strengthLabel) strengthLabel.textContent = 'Dosage / Strength';
  const dosageLabel = dosage?.closest?.('label.field')?.querySelector(':scope > span');
  if (dosageLabel) dosageLabel.textContent = 'How Taken / Directions';
  if (dosage instanceof HTMLInputElement && !dosage.placeholder) dosage.placeholder = 'Example: 1 tablet twice daily';
}

function closeMenu(input) {
  const state = stateFor(input);
  state.menu?.remove();
  state.menu = null;
  state.status?.remove();
  state.status = null;
  input.setAttribute('aria-expanded', 'false');
}

function showStatus(input, text, className = '') {
  const state = stateFor(input);
  state.status?.remove();
  const note = document.createElement('small');
  note.className = `medication-lookup-status ${className}`.trim();
  note.textContent = text;
  input.closest('label.field')?.append(note);
  state.status = note;
}

function makeManualStrength(card, value = '') {
  if (!card) return null;
  const current = card.querySelector('[name$="_strength"]');
  if (!current) return null;
  if (current instanceof HTMLInputElement) return current;
  const input = document.createElement('input');
  input.name = current.name;
  input.value = value;
  input.autocomplete = 'off';
  input.placeholder = 'Example: 10 mg tablet';
  current.replaceWith(input);
  return input;
}

function installStrengthChoices(card, strengths) {
  const current = card?.querySelector('[name$="_strength"]');
  if (!current) return;
  const unique = [...new Set((strengths || []).map(value => String(value || '').trim()).filter(Boolean))];
  if (!unique.length) {
    makeManualStrength(card, current.value || '');
    return;
  }
  const previous = String(current.value || '').trim();
  const select = document.createElement('select');
  select.name = current.name;
  select.className = current.className;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Choose dosage / strength';
  select.append(blank);
  for (const strength of unique) {
    const option = document.createElement('option');
    option.value = strength;
    option.textContent = strength;
    if (strength.toLocaleLowerCase('en-US') === previous.toLocaleLowerCase('en-US')) option.selected = true;
    select.append(option);
  }
  const manual = document.createElement('option');
  manual.value = '__manual__';
  manual.textContent = 'Other / enter manually';
  select.append(manual);
  select.addEventListener('change', () => {
    if (select.value === '__manual__') {
      const input = makeManualStrength(card, '');
      input?.focus();
      input?.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    select.dispatchEvent(new Event('input', { bubbles: true }));
  });
  current.replaceWith(select);
}

async function searchMedication(query,signal){const key=query.toLocaleLowerCase("en-US");if(suggestionCache.has(key))return suggestionCache.get(key);const rows=await apiAdapter.search(query,signal);suggestionCache.set(key,rows);return rows;}

function showSuggestions(input, suggestions) {
  closeMenu(input);
  if (!suggestions.length) {
    showStatus(input, 'No catalog match. You can still enter it manually.', 'no-results');
    return;
  }
  const state = stateFor(input);
  const menu = document.createElement('div');
  menu.className = 'medication-autocomplete-menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Medication suggestions');
  for (const suggestion of suggestions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'medication-autocomplete-option';
    button.setAttribute('role', 'option');
    const name = document.createElement('span');
    name.textContent = suggestion.name;
    button.append(name);
    if (suggestion.strengths.length) {
      const count = document.createElement('small');
      count.textContent = `${suggestion.strengths.length} strength${suggestion.strengths.length === 1 ? '' : 's'}`;
      button.append(count);
    }
    button.addEventListener('pointerdown', event => event.preventDefault());
    button.addEventListener('click', () => {
      input.dataset.rxSelecting = 'true';
      input.value = suggestion.name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      delete input.dataset.rxSelecting;
      installStrengthChoices(cardFor(input), suggestion.strengths);
      closeMenu(input);
    });
    menu.append(button);
  }
  input.closest('label.field')?.append(menu);
  state.menu = menu;
  input.setAttribute('aria-expanded', 'true');
}

function scheduleSearch(input) {
  const state = stateFor(input);
  clearTimeout(state.timer);
  state.controller?.abort();
  state.controller = null;
  closeMenu(input);
  const query = input.value.trim();
  if (query.length < 2) return;
  const request = ++state.request;
  state.timer = window.setTimeout(async () => {
    const controller = new AbortController();
    state.controller = controller;
    showStatus(input, 'Searching…');
    try {
      const suggestions = await searchMedication(query, controller.signal);
      if (request !== state.request || !input.isConnected || input.value.trim() !== query) return;
      showSuggestions(input, suggestions);
    } catch (error) {
      if (error?.name !== 'AbortError' && request === state.request) showStatus(input, 'Medication lookup unavailable. Manual entry is still available.', 'no-results');
    } finally {
      if (state.controller === controller) state.controller = null;
    }
  }, 160);
}

function prepareVisibleMedicationCards(root = apiAdapter.root) {
  root.querySelectorAll?.('[data-health-card][data-kind="medication"]').forEach(prepareCard);
}

root.addEventListener('input', event => {
  const input = event.target;
  if (!isMedicationName(input)) return;
  prepareCard(cardFor(input));
  if (input.dataset.rxSelecting === 'true') return;
  const card = cardFor(input);
  const strength = card?.querySelector('[name$="_strength"]');
  if (strength instanceof HTMLSelectElement) makeManualStrength(card, '');
  scheduleSearch(input);
}, true);

root.addEventListener('focusin', event => {
  if (!isMedicationName(event.target)) return;
  prepareCard(cardFor(event.target));
}, true);

root.addEventListener('focusout', event => {
  if (!isMedicationName(event.target)) return;
  window.setTimeout(() => closeMenu(event.target), 150);
}, true);

root.addEventListener('click', event => {
  if (event.target.closest?.('[data-add-health-record="medications"], [data-tab="medications"]')) {
    requestAnimationFrame(() => prepareVisibleMedicationCards());
  }
}, true);

prepareVisibleMedicationCards(root);

return {prepare:prepareCard,close:closeMenu};
};
