const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,doctorId}=require('./helpers/office-client-fixture.cjs');
test('T65 card displays totals and opens a separate paginated client list with record actions',async()=>{
 const client={id,first_name:'Sample',last_name:'T65',date_of_birth:'1961-11-25',birthday_65:'2026-11-25',status:'active',t65:true};
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[client,{...client,id:doctorId,status:'deceased'}],platinum:[]}});
 try{
  await until(()=>f.q('[data-office-client-count="t65"]').textContent==='1');
  assert.equal(f.q('[data-office-client-view="t65"]').textContent.includes('T65'),true);
  f.q('[data-office-client-view="t65"]').click();await until(()=>f.q('[data-client="arctos:'+id+'"]'));
  assert.equal(f.q('#clientLookupTitle').textContent,'T65');assert.match(f.q('#clientLookupDescription').textContent,/3 months before.*4 months after/);
  assert.equal(f.q('#officeClientSearch').hidden,true);assert.equal(f.all('[data-client]').length,1);
  assert.match(f.q('#clientResults').textContent,/65th birthday:/);assert.ok(f.q('[data-delete-client]'));
  f.q('#clientLookupBack').click();assert.equal(f.q('#officeClientSearch').hidden,false);
 }finally{f.w.close();}
});
