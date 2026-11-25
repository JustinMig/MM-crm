const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,sleep}=require('./helpers/office-client-fixture.cjs');
const client={id,assigned_agent_id:id,first_name:'Sample',last_name:'Client',status:'active'};
test('Clear is beside Search and clears results and the search field',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[client],platinum:[]}});try{
  assert.equal(f.q('#clientSearchButton').nextElementSibling.id,'clientSearchClear');
  f.fill(f.q('#clientSearch'),'Sample');f.q('#clientSearchButton').click();await until(()=>f.q('[data-client]'));
  f.q('#clientSearchClear').click();assert.equal(f.q('#clientSearch').value,'');assert.equal(f.q('[data-client]'),null);await sleep();assert.equal(f.q('[data-client]'),null);
 }finally{f.w.close();}
});
test('Delete targets one agency client, can be cancelled, and removes only the confirmed row',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[client],platinum:[client]}});try{
  f.fill(f.q('#clientSearch'),'Sample');f.q('#clientSearchButton').click();await until(()=>f.all('[data-delete-client]').length===2);
  const button=f.q('[data-delete-client="arctos:'+id+'"]');assert.equal(button.previousElementSibling.textContent,'Open →');
  f.w.confirm=()=>false;button.click();await sleep();assert.equal(f.requests.some(r=>r.action==='delete_client'),false);
  f.w.confirm=message=>{assert.match(message,/Justin \/ Arctos/);assert.match(message,/permanently deletes/);return true;};
  button.click();await until(()=>!f.q('[data-delete-client="arctos:'+id+'"]'));
  assert.ok(f.q('[data-delete-client="platinum:'+id+'"]'));
  const request=f.requests.find(r=>r.action==='delete_client');assert.equal(request.client_id,id);assert.equal(request.expected_agent_id,id);assert.equal(request.expected_name,'Sample Client');
 }finally{f.w.close();}
});
