// Synthetic records only. Exercises the real scripts, form events, and agency save payloads.
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'../../office-static',name),'utf8');
const id='11111111-1111-4111-8111-111111111111',doctorId='22222222-2222-4222-8222-222222222222';
const sleep=()=>new Promise(resolve=>setTimeout(resolve,5));
async function until(fn){for(let i=0;i<200;i++){if(fn())return;await sleep();}throw Error('Timed out waiting for UI update');}
async function fixture(agency='arctos',detailErrors={},exact=false,options={}){
 const fixtureOptions=options;
 const dom=new JSDOM('<div id="office-root"></div>',{url:'https://office.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,requests=[],errors=[];
 const observers=[],NativeObserver=w.MutationObserver;
 w.MutationObserver=class extends NativeObserver{constructor(callback){super(callback);observers.push(this);}};
 const nativeClose=w.close.bind(w);w.close=()=>{observers.forEach(observer=>observer.disconnect());nativeClose();};
 w.addEventListener('error',event=>errors.push(event.error?.message||event.message));
 w.sessionStorage.setItem('office_login_session',JSON.stringify({access_token:'synthetic-session'}));
 w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.remove();};
 w.HTMLElement.prototype.scrollIntoView=function(){};w.URL.createObjectURL=()=> 'blob:https://office.test/synthetic';w.URL.revokeObjectURL=()=>{};
 w.HTMLCanvasElement.prototype.getContext=()=>({strokeStyle:'',lineWidth:0,lineCap:'',clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}});
 const opened=[];w.open=url=>{opened.push(url);return {location:{replace:url=>opened.push(url)},close(){}};};
 const client={id,assigned_agent_id:id,first_name:'Sample',last_name:'Client',phone:'555-0100',email:'sample@example.test',status:'active',products:['medicare'],date_of_birth:'1950-01-01',height_feet:6,height_inches:2,weight_lbs:200,veteran:false,smoker:false,drivers_license_state:'MS',drivers_license_expiration:'2030-01-01',notes:'Saved overview note',doctors_section_notes:'Saved doctor notes'};
 const details={medicare_details:[{client_id:id,part_a_date:'2015-01-01',part_b_date:'2015-02-01',medicaid_level:'QMB',sunfire_code:'SAVED-SUNFIRE',notes:'Saved Medicare notes'}],client_doctors:[{id:doctorId,client_id:id,doctor_name:'Sample Doctor',specialty:'Cardiology',phone:'555-0111',notes:'Saved doctor note',updated_at:'2026-01-01T00:00:00Z'}],client_pharmacies:[{client_id:id,pharmacy_name:'Sample Pharmacy',pharmacy_location:'Sample City',pharmacy_name_2:'Second Pharmacy',pharmacy_location_2:'Other City'}],client_medications:[],health_plans:[{id:'33333333-3333-4333-8333-333333333333',carrier:'Sample Health',premium:0,status:'active',notes:'Plan note'}],life_policies:[],hospital_indemnity_plans:[],retirement_accounts:[],client_notes:[],documents:[],athena_medicare_reviews:[]};
 const secure={identifiers:{ssn:'111-22-3333',medicare_number:'TEST-MEDICARE',medicaid_number:'TEST-MEDICAID',drivers_license_number:'TEST-LICENSE'},banking:{bank_name:'Test Bank',account_number:'000111',routing_number:'000222'},medicare_gov:{username:'test-user',password:'test-password'}};
 Object.assign(details,options.details||{});Object.assign(client,options.client||{});Object.assign(secure,options.secure||{});
 let failNext=false,failOperation=null;
 w.fetch=async(url,options={})=>{
  if(String(url).includes('/storage/v1/object/upload/sign/'))return new Response('{}');
  const data=JSON.parse(options.body||'{}');requests.push(structuredClone(data));let result={};
  if(failOperation===data.action){failOperation=null;return new Response(JSON.stringify({error:'Synthetic '+data.action+' failure'}),{status:400});}
  if(data.action==='session')result={permissions:{edit:fixtureOptions.edit!==false,sensitive:fixtureOptions.sensitive!==false},connected:true};
  else if(data.action==='search'){const which=String(url).includes('bogusfmvdrlvxscopgaw')?'arctos':'platinum',rows=fixtureOptions.lookupRecords?.[which]||[client],term=String(data.search||'').toLowerCase();result={clients:rows.filter(row=>(!data.exclude_deceased||row.status!=='deceased')&&[row.first_name,row.last_name,row.phone].join(' ').toLowerCase().includes(term))};}
  else if(data.action==='client_lookup'){
   const which=String(url).includes('bogusfmvdrlvxscopgaw')?'arctos':'platinum',records=fixtureOptions.lookupRecords?.[which]||[client],month=fixtureOptions.lookupMonth||'2026-10',birthdays=records.filter(row=>row.status!=='deceased'&&String(row.date_of_birth||'').slice(5,7)===month.slice(-2)).map(row=>({...row,birthday_day:Number(row.date_of_birth.slice(-2))})),deceased=records.filter(row=>row.status==='deceased');
   if(data.view==='stats')result={birthdays:birthdays.length,deceased:deceased.length,month_key:month,month_label:'October 2026'};
   else {const rows=data.view==='birthdays'?birthdays:deceased,offset=data.offset||0;result={clients:structuredClone(rows.slice(offset,offset+(data.limit||200))),total:rows.length,offset,month_key:month,month_label:'October 2026'};}
  }
  else if(data.action==='client')result={client:structuredClone(client),details:structuredClone(details),detail_errors:detailErrors};
  else if(data.action==='secure_client'){
   if(fixtureOptions.failSecure===data.kind)return new Response(JSON.stringify({error:'Synthetic protected read failure'}),{status:400});
   result={kind:data.kind,data:structuredClone(secure[data.kind]||{})};
  }
  else if(data.action==='coverage_documents')result={documents:structuredClone(details.documents)};
  else if(data.action==='client_documents')result={documents:structuredClone(details.documents.slice(data.offset||0,(data.offset||0)+(data.limit||200)))};
  else if(data.action==='client_notes')result={notes:structuredClone(details.client_notes)};
  else if(data.action==='add_client_note'){let note=details.client_notes.find(note=>note.id===data.note_id);if(!note){note={id:data.note_id,client_id:id,title:data.title,body:data.body,created_at:new Date().toISOString()};details.client_notes.unshift(note);}result={saved:true,note:structuredClone(note)};}
  else if(data.action==='delete_client_note'){details.client_notes=details.client_notes.filter(note=>note.id!==data.note_id);result={saved:true};}
  else if(data.action==='client_remove_document'){details.documents=details.documents.filter(doc=>doc.id!==data.document_id);result={saved:true};}
  else if(data.action==='medication_search')result={suggestions:[{name:'Sample Medication',strengths:['10 mg tablet','20 mg tablet']}]};
  else if(data.action==='coverage_soa_context')result={client:structuredClone(client),agent:{id,full_name:'Sample Agent',phone:'555-0100'},user:{id}};
  else if(data.action==='coverage_soa_request')result={saved:true};
  else if(data.action==='document_url')result={url:'https://'+(agency==='arctos'?'bogusfmvdrlvxscopgaw':'sggzshbdfgkyyvxbebul')+'.supabase.co/storage/v1/object/sign/test?token=synthetic'};
  else if(data.action==='coverage_upload_start')result={upload_url:'https://'+(agency==='arctos'?'bogusfmvdrlvxscopgaw':'sggzshbdfgkyyvxbebul')+'.supabase.co/storage/v1/object/upload/sign/test?token=synthetic'};
  else if(data.action==='coverage_upload_complete'){const doc={id:data.document_id,client_id:id,category:data.category,file_name:data.file_name,mime_type:data.mime_type,file_size:data.file_size,file_available:true,created_at:new Date().toISOString(),...(data.category==='life_policy_document'?{life_policy_id:data.parent_id}:data.category==='hospital_indemnity_document'?{hospital_indemnity_plan_id:data.parent_id}:{})};details.documents.push(doc);result={saved:true,document:doc};}
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
 w.eval(source('arctos-coverage-template.js'));w.eval(source('office-coverage-soa.js'));w.eval(source('office-arctos-coverage.js'));
 w.eval(source('arctos-medical-files-template.js'));w.eval(source('office-arctos-medical-files.js'));
 w.eval(source('office-live.js'));w.eval(source('office-client-record.js'));w.eval(source('arctos-client-parity.js'));
 const q=selector=>w.document.querySelector(selector),all=selector=>[...w.document.querySelectorAll(selector)];
 await until(()=>q('[data-tab="clients"]'));q('[data-tab="clients"]').click();
 if(options.openRecord!==false){
  q('#clientSearch').value='Sample';q('#clientSearch').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await until(()=>q('[data-client^="'+agency+':"]'));q('[data-client^="'+agency+':"]').click();
  await until(()=>q('[data-office-exact-coverage] [name="sunfire_code"]'));
  if(options.sensitive!==false&&options.failSecure!=='identifiers')await until(()=>q('[data-protected-input="ssn"]')?.value===String(secure.identifiers.ssn||''));
 }
 const fill=(element,value)=>{element.value=value;element.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const submit=form=>form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 return {w,dom,q,all,requests,client,details,secure,errors,fill,submit,opened,fail:()=>failNext=true,failAction:action=>failOperation=action};
}

module.exports={fixture,until,id,doctorId,sleep,source};
