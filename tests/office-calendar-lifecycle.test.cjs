const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,until,id,doctorId}=require('./helpers/office-client-fixture.cjs');
async function setup(edit=true){
 const today=new Date(), date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const item={id:doctorId,title:'Sample appointment',assigned_agent_id:id,calendar_source:'mayer_justin',event_date:date,event_type:'appointment',status:'scheduled',start_time:'14:30:00',end_time:'15:00:00',notes:'Original'};
 const opts={edit,openRecord:false,calendarAppointments:{arctos:[item]},calendarAgents:{arctos:[{id,full_name:'Demo Agent'}],platinum:[],office:[]}};
 const f=await fixture('arctos',{},true,opts),mutations=[],fetch=f.w.fetch;
 f.w.fetch=async(url,options)=>{
  const data=JSON.parse(options.body||'{}');
  if(data.action!=='mutate_appointment')return fetch(url,options);
  mutations.push(data);
  if(data.operation==='complete')item.status='completed';
  if(data.operation==='update')Object.assign(item,data.changes);
  if(data.operation==='delete')opts.calendarAppointments.arctos=[];
  return new Response(JSON.stringify({saved:true}));
 };
 f.q('[data-tab="calendar"]').click();
 await until(()=>f.q('[data-calendar-agency="arctos"]'));
 f.q('[data-calendar-agency="arctos"]').click();
 await until(()=>f.q('[data-calendar-person="arctos:'+id+'"]'));
 f.q('[data-calendar-person="arctos:'+id+'"]').click();
 await until(()=>f.q('[data-cal-event]'));
 return {f,item,mutations,opts};
}
test('Office edits the original appointment, shows completion on the chip, and removes deleted entries',async()=>{
 const {f,item,mutations}=await setup();try{
  const open=()=>f.q('[data-cal-event]').click();
  open();f.q('[data-oc-edit]').click();
  f.q('#dialog [name=title]').value='New title';f.submit(f.q('#dialog form'));
  await until(()=>f.q('.oc-event-title')?.textContent==='New title');
  assert.deepEqual(mutations[0].changes,{title:'New title'});
  assert.equal(mutations[0].calendar_source,item.calendar_source);
  assert.equal(mutations[0].event_id,item.id);
  assert.equal(mutations[0].event_date,item.event_date);
  assert.equal(mutations[0].expected_status,'scheduled');
  open();f.q('[data-oc-complete]').click();
  await until(()=>f.q('.oc-event-status')?.textContent==='✓ Completed');
  assert.ok(f.q('[data-cal-event]').getAttribute('aria-label').startsWith('Completed'));
  open();assert.equal(f.q('[data-oc-complete]'),null);
  f.w.confirm=()=>false;f.q('[data-oc-delete]').click();assert.equal(mutations.length,2);
  f.w.confirm=()=>true;f.q('[data-oc-delete]').click();
  await until(()=>!f.q('#dialog .modal-card')&&!f.q('[data-cal-event]')&&!f.q('#calendarResults .loading-state'));
  assert.deepEqual(mutations.map(x=>x.operation),['update','complete','delete']);
 }finally{f.w.close();}
});
test('Incoming completion refreshes the already-open read-only detail and month chip',async()=>{
 const {f,item}=await setup(false);try{
  f.q('[data-cal-event]').click();assert.equal(f.q('[data-oc-edit]'),null);
  item.status='completed';item.activity_title='Review <b>coverage</b>';item.person_phone='555-0100';f.w.dispatchEvent(new f.w.Event('focus'));
  await until(()=>f.q('#dialog .status-pill')?.textContent==='Completed');
  assert.match(f.q('[data-cal-event]').textContent,/Completed/);
  assert.match(f.q('#dialog').textContent,/Appointment purposeReview <b>coverage<\/b>/);
  assert.match(f.q('#dialog').textContent,/Phone555-0100/);
 }finally{f.w.close();}
});
