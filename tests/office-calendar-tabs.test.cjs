const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture,until,id,doctorId,sleep}=require('./helpers/office-client-fixture.cjs');
const today=new Date(),date=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
const event=(name,agent)=>({id:name,assigned_agent_id:agent,title:name,event_date:date,start_time:'10:00',end_time:'10:30',status:'scheduled'});
const options={openRecord:false,calendarAgents:{arctos:[{id,full_name:'Justin Mayer'},{id:doctorId,full_name:'Other Arctos Agent'}],platinum:[{id,full_name:'Isaiah Hernandez'}],office:[{id,full_name:'Sheena'}]},calendarAppointments:{office:[event('Assistant appointment',id)],arctos:[event('Justin appointment',id),event('Other agent appointment',doctorId)],platinum:[event('Isaiah appointment',id)]}};
async function ready(f){await until(()=>f.q('[data-calendar-person="office"]')&&f.q('[data-calendar-person="arctos:'+id+'"]')&&!f.q('#calendarResults .loading-state'));}
test('Office calendar opens first, agent tabs isolate every view, and returning to Calendar resets to Office',async()=>{
 const f=await fixture('arctos',{},true,options);try{
  f.q('#filterAgency').value='platinum';f.q('#filterAgency').dispatchEvent(new f.w.Event('change',{bubbles:true}));
  f.q('[data-tab="calendar"]').click();await ready(f);
  assert.equal(f.q('[data-calendar-person="office"]').getAttribute('aria-selected'),'true');
  assert.deepEqual(f.all('.oc-event-title').map(n=>n.textContent),['Assistant appointment']);
  for(const [key,title]of [['arctos:'+id,'Justin appointment'],['arctos:'+doctorId,'Other agent appointment'],['platinum:'+id,'Isaiah appointment']]){
   f.q('[data-calendar-person="'+key+'"]').click();await until(()=>!f.q('#calendarResults .loading-state'));
   assert.deepEqual(f.all('.oc-event-title').map(n=>n.textContent),[title]);
  }
  for(const view of ['week','day','month']){f.q('[data-cal-view="'+view+'"]').click();await until(()=>!f.q('#calendarResults .loading-state'));assert.ok(f.all('.oc-event-title').every(n=>n.textContent==='Isaiah appointment'));}
  assert.ok(f.requests.some(r=>r.action==='appointments'&&r.agent_id===doctorId));
  f.q('[data-tab="clients"]').click();f.q('[data-tab="calendar"]').click();await ready(f);
  assert.equal(f.q('[data-calendar-person="office"]').getAttribute('aria-selected'),'true');assert.deepEqual(f.all('.oc-event-title').map(n=>n.textContent),['Assistant appointment']);
 }finally{f.w.close();}
});
test('Opening a day stays on the selected person and booking prefills that agent',async()=>{
 const f=await fixture('arctos',{},true,options);try{
  f.q('[data-tab="calendar"]').click();await ready(f);f.q('[data-calendar-person="arctos:'+id+'"]').click();await until(()=>!f.q('#calendarResults .loading-state'));
  f.q('[data-cal-date="'+date+'"]').click();await until(()=>f.q('[data-person-day-event]'));
  assert.deepEqual(f.all('.oc-popup-title').map(n=>n.textContent),['Justin appointment']);assert.match(f.q('.oc-day-popup .eyebrow').textContent,/Justin Mayer/);
  f.q('#ocScheduleDay').click();await until(()=>f.q('#oaAgent')?.value===id);
  assert.equal(f.q('#oaAgency').value,'arctos');assert.equal(f.q('#oaDate').value,date);
 }finally{f.w.close();}
});
test('A previous agent response cannot replace the currently selected calendar',async()=>{
 const f=await fixture('arctos',{},true,options);try{
  f.q('[data-tab="calendar"]').click();await ready(f);let release;const fetch=f.w.fetch;
  f.w.fetch=async(url,options)=>{const data=JSON.parse(options.body||'{}'),response=await fetch(url,options);if(data.action==='appointments'&&data.agent_id===doctorId)return new Promise(resolve=>release=()=>resolve(response));return response;};
  f.q('[data-calendar-person="arctos:'+doctorId+'"]').click();await until(()=>release);
  f.q('[data-calendar-person="platinum:'+id+'"]').click();await until(()=>!f.q('#calendarResults .loading-state'));release();await sleep();await sleep();
  assert.deepEqual(f.all('.oc-event-title').map(n=>n.textContent),['Isaiah appointment']);
 }finally{f.w.close();}
});
test('Both agency appointment queries filter by the selected agent before returning rows',async()=>{
 for(const scope of ['arctos','platinum']){
  const source=fs.readFileSync(new URL('../office-static/office-crm-bridge-'+scope+'.ts','file://'+__filename),'utf8');
  const body=source.slice(source.indexOf(' if(action==="appointments"){'),source.indexOf(' if(action==="lead_agents")'));
  const run=new (Object.getPrototypeOf(async function(){}).constructor)('sb','data','SCOPE','q','uuid','action',body);
  const filters=[],query={select(){return query},gte(){return query},lte(){return query},order(){return query},limit(){return query},eq(...args){filters.push(args);return query}},sb={from:()=>query};
  const data={from:date,to:date,agent_id:id};const result=await run(sb,data,scope,async()=>[event('Synthetic',id)],s=>s===id,'appointments');
  assert.deepEqual(filters,[['assigned_agent_id',id]]);assert.equal(result.appointments.length,1);
  await assert.rejects(run(sb,{...data,agent_id:'invalid'},scope,async()=>[],()=>false,'appointments'),/Invalid selected agent/);
 }
});
