const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {fixture,until}=require('./helpers/office-client-fixture.cjs');

function moduleAt(file,imports){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>{
  if(name==='server-only')return {};
  if(name==='next/server')return {NextResponse:{json:(body,init)=>Response.json(body,init)}};
  if(!(name in imports))throw Error('Unexpected import: '+name);
  return imports[name];
 },Response,Request,Map,Set,URL,Date,Promise,Error});
 return exports;
}
function importer({warning='',gate}={}){
 const writes=[],requests=[];
 const admin={from(table){const q={select(){return q},eq(){return q},not(){return q},order(){return Promise.resolve({data:[],error:null})},
  upsert(rows,opts){writes.push({table,rows:JSON.parse(JSON.stringify(rows)),opts});
   const result={data:rows.map((_,i)=>({id:String(i)})),error:null};
   return {select:async()=>result,then:(resolve,reject)=>Promise.resolve(result).then(resolve,reject)};
  }};return q;}};
 const api=moduleAt('lib/office-ringcentral-sync.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/ringcentral':{
   getRingCentralAccessToken:async()=>{requests.push('token');if(gate)await gate;return 'synthetic';},
   listRecentRingCentralCalls:async(...args)=>{requests.push(['calls',...args]);return [{id:'call-1',type:'Voice',direction:'Inbound',startTime:'2026-10-25T14:00:00Z',from:{phoneNumber:'5550100'},result:'Missed'}];},
   listRecentRingCentralVoicemails:async(...args)=>{requests.push(['voicemail',...args]);if(warning)throw Error(warning);return [{id:'1001',type:'VoiceMail',creationTime:'2026-10-25T14:01:00Z',from:{phoneNumber:'5550100'},attachments:[{id:'2001',type:'AudioRecording',vmDuration:12}]}];},
   normalizePhone:value=>String(value||'').replace(/\D/g,'')
  }
 });return {...api,writes,requests};
}
test('Shared import saves unknown callers and playable voicemail without overwriting notes or deletion markers',async()=>{
 const x=importer(),response=await x.syncOfficeRingCentral('office-agency');
 assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.voicemails,1);assert.equal(body.voicemail_warning,'');
 const saved=x.writes.find(x=>x.table==='ringcentral_office_voicemails');
 assert.equal(saved.rows[0].agency_id,'office-agency');assert.equal(saved.rows[0].client_id,null);
 assert.equal(saved.rows[0].audio_attachment_id,'2001');
 assert.equal(saved.opts.onConflict,'agency_id,source_message_id');
 for(const write of x.writes)for(const row of write.rows){assert.equal('hidden_at' in row,false);assert.equal('staff_note' in row,false);}
 assert.ok(x.requests.some(r=>Array.isArray(r)&&r[0]==='voicemail'&&r[2]===90&&r[3]===10));
});
test('Voicemail permission failures remain explicit while imported calls are retained',async()=>{
 const x=importer({warning:'ReadMessages permission is required'});
 const body=await (await x.syncOfficeRingCentral('office-agency')).json();
 assert.equal(body.synced,1);assert.equal(body.voicemails,0);assert.match(body.voicemail_warning,/ReadMessages/);
 assert.equal(x.writes.length,1);
});
test('Concurrent imports share work only for the same agency and return usable responses',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),x=importer({gate});
 const first=x.syncOfficeRingCentral('one'),second=x.syncOfficeRingCentral('one'),other=x.syncOfficeRingCentral('two');
 release();const responses=await Promise.all([first,second,other]);
 assert.equal(x.requests.filter(x=>x==='token').length,2);
 for(const response of responses)assert.equal((await response.json()).voicemails,1);
 assert.deepEqual(x.writes.filter(x=>x.table==='ringcentral_office_voicemails').map(x=>x.rows[0].agency_id).sort(),['one','two']);
});
function endpoint({active=true,role='manager',valid=true,configured=true}={}){
 const calls=[];
 const api=moduleAt('app/api/office-ringcentral/sync/route.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>({auth:{getUser:async()=>({data:{user:valid?{id:'staff'}:null},error:null})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{active,role,agency_id:'trusted-agency'},error:null})})})},
  '@/lib/ringcentral':{isRingCentralConfigured:()=>configured},
  '@/lib/office-ringcentral-sync':{syncOfficeRingCentral:async agency=>{calls.push(agency);return Response.json({voicemails:1});}}
 });return {...api,calls};
}
const request=(headers={})=>new Request('https://crm.mayerig.com/api/office-ringcentral/sync',{method:'POST',headers,body:JSON.stringify({agency_id:'spoofed'})});
test('Office sync requires a verified active manager/admin, rejects foreign origins, and derives agency server side',async()=>{
 const headers={origin:'https://office-crm-sand.vercel.app',authorization:'Bearer synthetic'};
 const x=endpoint();assert.equal((await x.POST(request())).status,401);
 assert.equal((await x.POST(request({...headers,origin:'https://untrusted.test'}))).status,403);
 for(const opts of [{valid:false},{active:false},{role:'agent'}]){
  const y=endpoint(opts);assert.ok([401,403].includes((await y.POST(request(headers))).status));assert.equal(y.calls.length,0);
 }
 const response=await x.POST(request(headers));assert.equal(response.status,200);
 assert.equal(response.headers.get('access-control-allow-origin'),headers.origin);
 assert.deepEqual(x.calls,['trusted-agency']);
 assert.equal((await endpoint({configured:false}).POST(request(headers))).status,409);
});
async function phoneFixture(sync){
 const x=await fixture('arctos',{},true,{openRecord:false});let syncs=0,feeds=0;
 const original=x.w.fetch;
 x.w.AbortSignal={timeout:()=>undefined};
 x.w.fetch=async(url,options={})=>{
  if(String(url).includes('/office-ringcentral/sync')){syncs++;assert.equal(options.headers.authorization,'Bearer synthetic-session');return sync(syncs);}
  if(String(url).includes('/rpc/office_phone_feed')){feeds++;return Response.json({calls:[],texts:[],voicemails:syncs?[{id:'vm-1',received_at:'2026-10-25T14:00:00Z',from_phone:'5550100',audio_attachment_id:'audio-1'}]:[]});}
  return original(url,options);
 };
 return {...x,syncs:()=>syncs,feeds:()=>feeds};
}
test('Opening Office Phone syncs directly; Refresh forces a new import and reveals voicemail playback',async()=>{
 const x=await phoneFixture(()=>Response.json({voicemails:1}));
 try{
  x.q('[data-tab="phone"]').click();await until(()=>x.q('#officePhoneStatus')?.textContent.includes('1 voicemails synced'));
  assert.equal(x.syncs(),1);assert.equal(x.feeds(),2);
  x.q('[data-phone-section="voicemails"]').click();assert.ok(x.q('[data-phone-action="play"][data-phone-kind="voicemail"]'));
  x.q('[data-tab="clients"]').click();x.q('[data-tab="phone"]').click();await until(()=>!x.q('#officePhoneRefresh').disabled);
  assert.equal(x.syncs(),1);
  x.q('#officePhoneRefresh').click();await until(()=>x.syncs()===2&&!x.q('#officePhoneRefresh').disabled);
  assert.equal(x.errors.length,0);
 }finally{x.w.close();}
});
test('Office phone preserves saved records and shows a voicemail permission warning across filters',async()=>{
 const x=await phoneFixture(()=>Response.json({voicemails:0,voicemail_warning:'ReadMessages permission is required'}));
 try{
  x.q('[data-tab="phone"]').click();await until(()=>x.q('#officePhoneStatus')?.textContent.includes('ReadMessages'));
  x.q('[data-phone-section="voicemails"]').click();assert.match(x.q('#officePhoneStatus').textContent,/Voicemail sync needs attention.*ReadMessages/);
  assert.ok(x.q('[data-phone-action="play"]'));assert.equal(x.errors.length,0);
 }finally{x.w.close();}
});
test('Network failure is visible and does not replace saved records or pretend sync succeeded',async()=>{
 const x=await phoneFixture(()=>{throw Error('Connection unavailable')});
 try{
  x.q('[data-tab="phone"]').click();await until(()=>x.q('#officePhoneStatus')?.textContent.includes('Connection unavailable'));
  assert.match(x.q('#officePhoneStatus').textContent,/Saved records are still available/);
  assert.equal(x.q('#officePhoneRefresh').disabled,false);assert.equal(x.feeds(),1);
 }finally{x.w.close();}
});
test('A sync finishing after sign-out cannot reload the previous account feed',async()=>{
 let finish;const pending=new Promise(resolve=>finish=resolve);
 const x=await phoneFixture(()=>pending);
 try{
  x.q('[data-tab="phone"]').click();await until(()=>x.syncs()===1);
  x.q('#logout').click();finish(Response.json({voicemails:1}));
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(x.q('#login-form'));assert.equal(x.feeds(),1);assert.equal(x.errors.length,0);
 }finally{x.w.close();}
});
