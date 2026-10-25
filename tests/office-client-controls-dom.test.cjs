const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,doctorId,sleep}=require('./helpers/office-client-fixture.cjs');
const save=async(f,key)=>{f.q('[data-save-tab="'+key+'"]').click();await until(()=>f.q('[data-tab-save-footer="'+key+'"]').dataset.saving==='false');};
const sample={id,first_name:'Sample',last_name:'Birthday',phone:'555-0100',date_of_birth:'1950-10-20',status:'active'};
const deceased={id:doctorId,first_name:'Sample',last_name:'Archived',date_of_birth:'1940-10-03',status:'deceased'};
const other={id:'33333333-3333-4333-8333-333333333333',first_name:'Sample',last_name:'Other',date_of_birth:'1950-10-15',status:'active'};
test('A visible Search button and Enter both search; deceased clients stay in the dedicated archive',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[sample,deceased],platinum:[]}});try{
  assert.equal(f.q('#clientSearchButton').textContent,'Search');f.fill(f.q('#clientSearch'),'Sample');f.q('#clientSearchButton').click();await until(()=>f.q('[data-client]'));assert.equal(f.all('[data-client]').length,1);assert.equal(f.requests.filter(r=>r.action==='search').at(-1).exclude_deceased,true);
  const before=f.requests.filter(r=>r.action==='search').length;f.q('#clientSearch').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await until(()=>f.requests.filter(r=>r.action==='search').length>before);await until(()=>f.q('[data-client]'));assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Birthday and Deceased cards show agency totals, open the matching lists, and preserve access to client records',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,client:{date_of_birth:sample.date_of_birth},lookupRecords:{arctos:[sample,deceased],platinum:[other]}});try{
  await until(()=>f.q('[data-office-client-count="birthdays"]').textContent==='2');assert.equal(f.q('[data-office-client-count="deceased"]').textContent,'1');
  f.q('[data-office-client-view="birthdays"]').click();await until(()=>f.all('.client-birthday-client').length===2);assert.equal(f.q('#clientLookupTitle').textContent,'October 2026 Birthdays');assert.deepEqual(f.all('.birthday-day').map(n=>n.textContent),['15','20']);assert.equal(f.q('#officeClientSearch').hidden,true);
  f.q('[data-office-client-view="deceased"]').click();await until(()=>f.q('[data-client="arctos:'+doctorId+'"]'));assert.equal(f.all('[data-client]').length,1);assert.equal(f.q('#clientLookupTitle').textContent,'Deceased Clients');
  f.q('#clientLookupBack').click();assert.equal(f.q('#officeClientSearch').hidden,false);f.q('[data-office-client-view="birthdays"]').click();await until(()=>f.q('[data-client="arctos:'+id+'"]'));f.q('[data-client="arctos:'+id+'"]').click();await until(()=>f.q('[data-save-tab="overview"]'));assert.equal(f.q('[data-save-tab="overview"]').textContent,'Save Info');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('Archive pagination and agency changes retain every record without duplicate rows',async()=>{
 const rows=Array.from({length:205},(_,i)=>({...deceased,id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),last_name:'Archived '+i}));
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:rows,platinum:[]}});try{
  f.q('[data-office-client-view="deceased"]').click();await until(()=>f.all('[data-client]').length===200);assert.equal(f.q('#clientLookupMore').hidden,false);f.q('#clientLookupMore').click();await until(()=>f.all('[data-client]').length===205);assert.equal(f.q('#clientLookupMore').hidden,true);assert.ok(f.requests.some(r=>r.action==='client_lookup'&&r.offset===200));
  f.q('#filterAgency').value='platinum';f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));await until(()=>f.q('#clientResults').textContent.includes('No deceased clients'));assert.equal(f.all('[data-client]').length,0);assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
test('A late birthday response cannot replace a more recent Deceased list',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[sample,deceased],platinum:[]}});try{
  const fetch=f.w.fetch;let release;f.w.fetch=async(url,options)=>{const data=JSON.parse(options.body||'{}'),response=await fetch(url,options);if(data.action==='client_lookup'&&data.view==='birthdays'&&String(url).includes('bogusfmvdrlvxscopgaw'))return await new Promise(resolve=>release=()=>resolve(response));return response;};
  f.q('[data-office-client-view="birthdays"]').click();await until(()=>release);f.q('[data-office-client-view="deceased"]').click();await until(()=>f.q('[data-client="arctos:'+doctorId+'"]'));release();await sleep();await sleep();assert.equal(f.q('#clientLookupTitle').textContent,'Deceased Clients');assert.equal(f.q('[data-client="arctos:'+id+'"]'),null);
 }finally{f.w.close();}
});
test('Each tab exposes one bottom Save Info button, and Notes & Files includes the separate titled note',async()=>{
 const f=await fixture('arctos',{},true);try{
  for(const key of ['overview','coverage','medical','files']){f.q('[data-oc-client-tab="'+key+'"]').click();const panel=f.q('[data-oc-client-panel="'+key+'"]'),buttons=[...panel.querySelectorAll('button')].filter(button=>/^save\b/i.test(button.textContent.trim())&&!button.closest('[hidden]'));assert.equal(buttons.length,1,key);assert.equal(buttons[0].textContent,'Save Info');assert.equal(panel.lastElementChild.dataset.tabSaveFooter,key);assert.equal(buttons[0].closest('.footer-actions')?.parentElement,panel.lastElementChild);}
  assert.equal(f.q('[data-cfh-note-save]').hidden,true);f.fill(f.q('[data-cfh-note-title]'),'Bottom save');f.fill(f.q('[data-cfh-note-body]'),'Saved through Save Info');await save(f,'files');assert.equal(f.details.client_notes[0].body,'Saved through Save Info');assert.equal(f.q('[data-cfh-note-body]').value,'');assert.deepEqual(f.errors,[]);
 }finally{f.w.close();}
});
