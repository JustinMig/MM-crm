const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until}=require('./helpers/office-client-fixture.cjs');

test('Office dashboard totals use the selected agencies and never fetch full calendars or campaigns',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,dashboardCounts:{arctos:{appointments:5,campaigns:2},platinum:{appointments:7,campaigns:3},office:{appointments:4}}});
 try{
  f.q('[data-tab="dashboard"]').click();
  const values=()=>f.all('.metric b').map(el=>el.textContent);
  await until(()=>values()[1]==='16');assert.deepEqual(values(),['2','16','5']);
  f.q('#filterAgency').value='arctos';f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));
  await until(()=>values()[1]==='5');assert.deepEqual(values(),['2','5','2']);
  assert.ok(f.requests.every(r=>!['appointments','campaigns'].includes(r.action)));
 }finally{f.w.close();}
});

for(const agency of ['arctos','platinum'])test(agency+' opens the overview independently and keeps drafts when other tabs load or retry',async()=>{
 const f=await fixture(agency,{},true,{progressive:true});
 try{
  const sections=()=>f.requests.filter(r=>r.action==='client').map(r=>r.section);
  assert.deepEqual(sections(),['overview']);
  assert.equal(f.q('[data-office-exact-coverage]'),null);assert.equal(f.q('[data-office-exact-medical-files-panel]'),null);
  const name=f.q('#editClient [name="first_name"]');f.fill(name,'Draft first name');f.fill(f.q('#editClient [name="notes"]'),'Draft note');
  f.failAction('client');f.q('[data-oc-client-tab="coverage"]').click();
  const retry=()=>f.q('[data-oc-client-panel="coverage"] [data-client-section-status] button');
  await until(retry);retry().click();f.q('[data-oc-client-tab="coverage"]').click();
  await until(()=>f.q('[data-office-exact-coverage] [name="sunfire_code"]'));
  assert.equal(f.q('[data-office-exact-coverage] [name="sunfire_code"]').value,'SAVED-SUNFIRE');
  const coverage=f.q('[data-office-exact-coverage] [name="sunfire_code"]');f.fill(coverage,'Draft coverage');
  f.q('[data-oc-client-tab="files"]').click();await until(()=>f.q('[data-client-files-hub]'));
  await until(()=>f.requests.some(r=>r.action==='client_notes'));
  assert.equal(f.q('[data-oc-client-panel="files"] [name="notes"]').value,'Draft note');
  assert.equal(f.requests.filter(r=>r.action==='client_documents').length,1);
  f.q('[data-oc-client-tab="medical"]').click();f.q('[data-oc-client-tab="overview"]').click();
  assert.equal(name.value,'Draft first name');assert.equal(coverage.value,'Draft coverage');
  assert.deepEqual(sections(),['overview','coverage','coverage','medical']);
  assert.ok(f.q('.oc-arctos-client-dialog').officeHasUnsavedChanges());
  assert.ok(f.all('[data-save-tab]').every(b=>!b.closest('footer').hidden));
  assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});

test('Arctos dashboard counts overlapping native and shared events once across pages without reading event details',async()=>{
 const fs=require('node:fs'),path=require('node:path');
 const bridge=fs.readFileSync(path.join(__dirname,'../office-static/office-crm-bridge-arctos.ts'),'utf8');
 const code=bridge.slice(bridge.indexOf(' if(action==="dashboard_counts"){'),bridge.indexOf(' if(action==="appointments"){'));
 const run=new (Object.getPrototypeOf(async function(){}).constructor)('action','data','sb','q','createClient','MM_URL','MM_PUBLIC','authorization',code);
 const pageRows=(ids)=>{
  const query={select(columns){assert.equal(columns,'id');return this;},gte(){return this;},lte(){return this;},order(columns){assert.equal(columns,'id');return this;},range(start,end){return ids.slice(start,end+1).map(id=>({id}));}};
  return query;
 };
 const ids=Array.from({length:520},(_,i)=>String(i)),remote=ids.slice(300).concat('shared-only');
 const db={from(table){if(table==='campaigns')return {select(columns,options){assert.equal(columns,'id');assert.deepEqual(options,{head:true,count:'exact'});return {count:9};}};
  assert.equal(table,'appointments');return pageRows(ids);}};
 const central=(_url,_key,options)=>{assert.equal(options.global.headers.Authorization,'Bearer session');return {rpc(name){assert.equal(name,'office_arctos_calendar_events');return pageRows(remote);}};};
 const result=await run('dashboard_counts',{from:'2026-11-01',to:'2026-11-30'},db,async x=>x,central,'url','public','Bearer session');
 assert.deepEqual(result,{appointments:521,campaigns:9});
});
