const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,until,id,doctorId,sleep}=require('./helpers/office-client-fixture.cjs');
const person={id,first_name:'Sample',last_name:'Client',status:'active',t65:true,birthday_65:'2026-11-25',medicare_review_completed:true,medicare_review_year:2026};
for(const view of ['medicare_reviews','t65'])test(view+' counts and open lists follow agency changes, including All Agencies',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[person,{...person,id:doctorId}],platinum:[person]}});
 try{
  const counter=()=>f.q('[data-office-client-count="'+view+'"]');
  await until(()=>counter().textContent==='3');f.q('[data-office-client-view="'+view+'"]').click();await until(()=>f.all('[data-client]').length===3);
  for(const [agency,count]of [['platinum',1],['arctos',2],['all',3]]){
   f.q('#filterAgency').value=agency;f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));
   await until(()=>counter().textContent===String(count)&&f.all('[data-client]').length===count);
   if(agency!=='all')assert.ok(f.all('[data-client]').every(button=>button.dataset.client.startsWith(agency+':')));
  }
 }finally{f.w.close();}
});
test('a late review response from the previous agency cannot replace the selected agency list',async()=>{
 const f=await fixture('arctos',{},true,{openRecord:false,lookupRecords:{arctos:[person],platinum:[person]}});
 try{
  const fetch=f.w.fetch;let release;
  f.w.fetch=async(url,options)=>{const data=JSON.parse(options.body||'{}'),response=await fetch(url,options);if(data.action==='client_lookup'&&data.view==='medicare_reviews'&&String(url).includes('bogusfmvdrlvxscopgaw'))return new Promise(resolve=>release=()=>resolve(response));return response;};
  f.q('[data-office-client-view="medicare_reviews"]').click();await until(()=>release);
  f.q('#filterAgency').value='platinum';f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));
  await until(()=>f.q('[data-client="platinum:'+id+'"]'));release();await sleep();await sleep();
  assert.equal(f.all('[data-client]').length,1);assert.ok(f.q('[data-client="platinum:'+id+'"]'));
 }finally{f.w.close();}
});
