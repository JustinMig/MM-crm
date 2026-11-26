const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {JSDOM} = require('jsdom');
const {until} = require('./helpers/office-client-fixture.cjs');

function deferred() {
 let resolve;
 const promise = new Promise(r => { resolve = r; });
 return {promise, resolve};
}
function setup(respond) {
 const w = new JSDOM('<main id="inbox"></main><aside id="dialog"></aside>', {url:'https://office.test', runScripts:'outside-only', pretendToBeVisual:true}).window;
 const timers=new Map(), calls=[];
 let visible=true, seq=0;
 Object.defineProperty(w.document, 'visibilityState', {get:()=>visible?'visible':'hidden'});
 w.setInterval=(tick,delay)=>{const id=++seq;timers.set(id,{tick,delay});return id;};
 w.clearInterval=id=>timers.delete(id);
 w.eval(readFileSync('office-static/text-attachments.js','utf8'));
 w.eval(readFileSync('office-static/office-sms.js','utf8'));
 w.officeSms.configure({signedIn:()=>true,agencies:()=>['arctos','platinum'],openClient:()=>{},request:async p=>{
  calls.push(p);
  if(p.command==='agents')return {agents:[{id:'agent',full_name:'Sample Agent'}]};
  if(p.command==='directory')return {agent:{full_name:'Sample Agent'},clients:[{id:'one',first_name:'Sample',phone:'6625550101'},{id:'two',first_name:'Other',phone:'6625550102'}],can_send:true};
  return respond(p);
 }});
 const q=selector=>w.document.querySelector(selector);
 const set=(selector,value)=>{const node=q(selector);node.value=value;node.dispatchEvent(new w.Event('change'));};
 return {w,q,calls,set,show(value){visible=value;w.document.dispatchEvent(new w.Event('visibilitychange'));},
  tick(delay){for(const timer of timers.values())if(timer.delay===delay)timer.tick();},
  count(cmd){return calls.filter(p=>p.command===cmd).length;},
  async openInbox(){w.officeSms.mount(q('#inbox'));set('[data-sms-agency]','arctos');await until(()=>!q('[data-sms-agent]').disabled);set('[data-sms-agent]','agent');await until(()=>!q('[data-sms-new]').disabled);}
 };
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const row={client_id:'one',client_name:'Sample Client',phone:'6625550101',latest_at:'2026-11-25T12:00:00Z',latest_body:'Hello',unread_count:1};

test('inbox keeps identical rows in place and pauses while hidden or covered by a composer',async()=>{
 let pending=null;
 const result={can_send:true,conversations:[row]};
 const f=setup(()=>pending?.promise||structuredClone(result));
 try{
  await f.openInbox();
  const button=f.q('[data-sms-thread]');button.focus();
  const cards=f.q('[data-sms-conversations]'),oldHTML=cards.innerHTML;
  pending=deferred();f.tick(30000);f.tick(30000);f.q('[data-sms-refresh]').click();
  assert.equal(f.count('conversations'),2);
  assert.equal(f.q('[data-sms-inbox-notice]').textContent,'');
  pending.resolve(result);pending=null;await flush();
  assert.equal(f.q('[data-sms-thread]'),button);assert.equal(f.w.document.activeElement,button);
  assert.equal(cards.innerHTML,oldHTML);
  f.show(false);f.tick(30000);assert.equal(f.count('conversations'),2);
  f.show(true);await flush();assert.equal(f.count('conversations'),3);
  f.q('[data-sms-new]').click();await until(()=>f.q('.office-sms-recipients input'));
  const checkbox=f.q('.office-sms-recipients input');checkbox.click();
  f.q('textarea').value='Bulk draft';f.q('[name=consent]').click();f.tick(30000);
  assert.equal(f.count('conversations'),3);assert.equal(f.q('.office-sms-recipients input'),checkbox);
  assert.ok(checkbox.checked);assert.equal(f.q('textarea').value,'Bulk draft');assert.ok(f.q('[name=consent]').checked);
  f.q('[data-sms-close]').click();f.q('#dialog').innerHTML='<div role="dialog"></div>';f.tick(30000);
  assert.equal(f.count('conversations'),3);
  f.q('#dialog').replaceChildren();result.conversations=[{...row,unread_count:0}];f.tick(30000);await flush();
  assert.equal(f.q('[data-sms-board="read"]').textContent,'Read (1)');
  assert.equal(f.q('[data-sms-thread]'),null);
  f.q('[data-sms-board="read"]').click();assert.equal(f.q('[data-sms-thread] strong').textContent,'Sample Client');
  f.q('#inbox').remove();f.tick(30000);assert.equal(f.count('conversations'),4);
 }finally{f.w.close();}
});

test('new, unchanged and older message pages preserve the live draft, file and open history',async()=>{
 const message=(id,body,minute)=>({id,body,created_at:'2026-11-25T12:'+minute+':00Z',direction:'inbound',status:'received',read_at:null});
 const first=message('first','First message','01'),old=message('older','Earlier message','00'),next=message('next','New message','02');
 let head=[first],gate=null;
 const f=setup(p=>{
  if(p.command==='read')return {saved:true};
  if(p.command==='thread')return gate?.promise||{client:{first_name:'Sample',last_name:'Client',phone:row.phone},agent:{full_name:'Sample Agent'},can_send:true,messages:p.offset?[old]:head,has_more:!p.offset,next_offset:p.offset?101:100};
 });
 try{
  await f.w.officeSms.open('arctos','one');
  assert.equal(f.count('read'),1);
  const input=f.q('textarea'),file=f.q('[type=file]'),article=f.q('.office-sms-bubble');
  input.value='Part of a draft';input.dispatchEvent(new f.w.Event('input'));input.focus();input.setSelectionRange(3,5);
  Object.defineProperty(file,'files',{value:[new f.w.File(['test'],'draft.txt',{type:'text/plain'})]});
  file.dispatchEvent(new f.w.Event('change',{bubbles:true}));
  const original=f.q('.office-sms-thread').innerHTML;
  f.tick(15000);await flush();
  assert.equal(f.count('read'),1);assert.equal(f.q('.office-sms-bubble'),article);assert.equal(f.q('.office-sms-thread').innerHTML,original);
  f.q('[data-sms-older]').click();await until(()=>f.q('.office-sms-thread').textContent.includes('Earlier message'));
  head=[first,next];f.tick(15000);await until(()=>f.q('.office-sms-thread').textContent.includes('New message'));
  assert.ok(f.q('.office-sms-thread').textContent.includes('Earlier message'));
  assert.equal(f.q('textarea'),input);assert.equal(input.value,'Part of a draft');assert.equal(input.selectionStart,3);assert.equal(input.selectionEnd,5);
  assert.equal(f.q('[type=file]'),file);assert.equal(f.q('[data-file-name]').textContent,'draft.txt');
  assert.equal(f.count('read'),3);
  gate=deferred();f.tick(15000);const count=f.count('thread');f.tick(15000);f.tick(15000);assert.equal(f.count('thread'),count);
  f.show(false);f.tick(15000);assert.equal(f.count('thread'),count);
  f.w.officeSms.close();gate.resolve({messages:[]});await flush();f.show(true);f.tick(15000);
  assert.equal(f.count('thread'),count);assert.equal(f.q('.office-sms-modal'),null);
 }finally{f.w.close();}
});

test('late agency responses cannot overwrite the current inbox or release its pending refresh',async()=>{
 const results=[];
 const f=setup(p=>{
  const item=deferred();results.push({p,...item});return item.promise;
 });
 try{
  f.w.officeSms.mount(f.q('#inbox'));f.set('[data-sms-agency]','arctos');await until(()=>!f.q('[data-sms-agent]').disabled);f.set('[data-sms-agent]','agent');
  f.set('[data-sms-agency]','platinum');await until(()=>!f.q('[data-sms-agent]').disabled);f.set('[data-sms-agent]','agent');
  assert.equal(results.length,2);results[0].resolve({can_send:true,conversations:[row]});await flush();
  assert.equal(f.q('[data-sms-thread]'),null);f.tick(30000);assert.equal(results.length,2);
  results[1].resolve({can_send:true,conversations:[{...row,client_name:'Second agency client'}]});await flush();
  assert.equal(f.q('[data-sms-thread] strong').textContent,'Second agency client');
 }finally{f.w.close();}
});

test('a send completed during an in-flight poll still refreshes the confirmed message exactly once',async()=>{
 const head={client:{first_name:'Sample',phone:row.phone},agent:{full_name:'Agent'},can_send:true,messages:[]};
 const gate=deferred();let fetches=0;
 const f=setup(p=>{
  if(p.command==='send')return {status:'queued'};
  if(p.command==='thread'){
   fetches++;if(fetches===2)return gate.promise;
   if(fetches===3)return {...head,messages:[{id:'sent',direction:'outbound',status:'queued',created_at:row.latest_at,body:'A new message'}]};
   return head;
  }
 });
 try{
  await f.w.officeSms.open('arctos','one');f.tick(15000);
  const input=f.q('textarea'),form=f.q('form');
  input.value='A new message';input.dispatchEvent(new f.w.Event('input'));
  form.dispatchEvent(new f.w.Event('submit',{cancelable:true}));
  await until(()=>f.count('send')===1&&input.value==='');
  f.tick(15000);assert.equal(f.count('thread'),2);
  gate.resolve(head);await until(()=>f.q('.office-sms-bubble p')?.textContent==='A new message');
  assert.equal(f.count('thread'),3);assert.equal(f.count('send'),1);assert.equal(f.q('textarea'),input);
  assert.equal(input.disabled,false);
 }finally{f.w.close();}
});
