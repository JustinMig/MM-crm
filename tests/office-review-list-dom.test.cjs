const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,doctorId}=require('./helpers/office-client-fixture.cjs');
test('Medicare Review follows the selected agency; search shows Yes and year or an empty cell',async()=>{
 const done={id,first_name:'Sample',last_name:'Reviewed',status:'active',medicare_review_completed:true,medicare_review_year:2026};
 const blank={id:doctorId,first_name:'Sample',last_name:'Unchecked',status:'active',medicare_review_completed:false,medicare_review_year:2026};
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[done,blank],platinum:[done]}});
 try{
  await until(()=>f.q('[data-office-client-count="medicare_reviews"]').textContent==='2');
  f.fill(f.q('#clientSearch'),'Sample');f.q('#clientSearchButton').click();await until(()=>f.all('[data-client]').length===3);
  const rows=f.all('#clientResults tbody tr');assert.equal(f.all('#clientResults th')[4].textContent,'Medicare Review');
  for(const row of rows)assert.equal(row.children[4].textContent,row.textContent.includes('Unchecked')?'':'Yes 2026');
  f.q('#filterAgency').value='platinum';f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));await until(()=>f.q('[data-office-client-count="medicare_reviews"]').textContent==='1');
  f.q('[data-office-client-view="medicare_reviews"]').click();await until(()=>f.q('#clientLookupTitle').textContent==='Medicare Review'&&f.all('[data-client]').length===1);
  assert.equal(f.all('#clientResults tbody tr').every(r=>r.textContent.includes('Yes 2026')),true);
 }finally{f.w.close();}
});
