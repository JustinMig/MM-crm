const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const nativeId='10000000-0000-4000-8000-000000000001',legacyId='20000000-0000-4000-8000-000000000001',agent='8099c3d2-dff1-4a34-8c90-06931f64177e';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={};vm.runInNewContext(compile('lib/office-sms.ts'),{exports:helpers,URLSearchParams,Set,Map,Date});
function fixture(options={}){
 const updated=[],calls=[],client={first_name:'Sample',last_name:'Client',phone:'6625550100'};
 function query(scope,table){
  let change=null; calls.push([scope,table]);
  const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,not:()=>q,in:()=>q,is:()=>q,update:v=>{change=v;return q;},
   maybeSingle:async()=>({data:table==='clients'?{...client,id:nativeId}:{id:options.other?'other':agent,active:!options.inactive,role:options.other?'agent':'admin'}}),
   single:async()=>({data:{agency_id:'agency',full_name:'Isaiah Hernandez'}}),
   then(resolve){
    if(change){updated.push(change);return resolve({error:null});}
    if(table==='clients'){
     const rows=scope==='native'?[{...client,id:nativeId}]:[{...client,id:legacyId,first_name:options.wrongName?'Different':'Sample'}];
     if((options.duplicate&&scope==='mm')||(options.duplicateNative&&scope==='native'))rows.push({...rows[0],id:'duplicate'});
     return resolve({data:rows,error:null});
    }
    return resolve({data:[{id:'message',client_id:legacyId,direction:'inbound',body:'Existing M&M message',twilio_message_sid:'SMexample',status:'received',from_number:options.reserved?'662-750-4626':'',notification_hidden_at:options.hidden?'date':null,created_at:'2026-08-20T15:24:00Z',read_at:null}],error:null});
   }};return q;
 }
 function rpc(scope,name,args){
  calls.push([scope,name,args]);
  if(name==='crm_sms_phone_candidates')return query(scope,'clients');
  if(name==='platinum_sms_suppressed_sids')return {data:options.hidden?['SMexample']:[]};
  if(name==='platinum_sms_hidden_shared')return {data:options.nativeHidden?['SMexample']:[]};
  if(name==='platinum_sms_digest_input')return {data:[{...client,id:legacyId,messages:[['id','SMexample','inbound',false,false,'date']]}]};
  if(name==='platinum_sms_digest')return {data:args.p_mode==='unread'?{unread:1}:{conversations:[{latest:{shared_id:'id'}}]}};
  if(name==='platinum_sms_preview')return {data:[{id:'id',body:'Latest'}]};
  throw Error(name);
 }
 const native={rpc:(n,a)=>rpc('native',n,a),auth:{getUser:async()=>({data:{user:options.invalid?null:{id:options.other?'other':agent}},error:options.invalid?{}:null})},from:table=>query('native',table)},admin={rpc:(n,a)=>rpc('mm',n,a),from:table=>query('mm',table)},exports={};
 vm.runInNewContext(compile('app/api/platinum-sms-history/route.ts'),{exports,Request,Response,URL,Date,Map,Set,require:name=>{
  if(name==='@supabase/supabase-js')return {createClient:()=>native};
  if(name==='@/lib/supabase/admin')return {createAdminClient:()=>admin};
  if(name==='@/lib/office-sms')return helpers;
  if(name==='@/lib/sms-media')return {photoUrls:async()=>[]};
  throw Error(name);
 }});
 const request=(method='GET',input={},params='')=>new Request('https://crm.mayerig.com/api/platinum-sms-history'+params,{method,headers:{Authorization:'Bearer synthetic',Origin:options.badOrigin?'https://bad.test':'https://pf.mayerig.com','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(input)}:{})});
 return {api:exports,request,updated,calls};
}
test('exact matched Isaiah history includes older messages',async()=>{
 const f=fixture(),r=await f.api.GET(f.request());assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.messages.length,1);assert.equal(data.messages[0].client_id,nativeId);
 assert.equal(data.messages[0].body,'Existing M&M message');assert.equal(data.messages[0].occurred_at,'2026-08-20T15:24:00Z');
});
test('mismatched and ambiguous clients expose no history',async()=>{
 for(const options of [{wrongName:true},{duplicate:true},{duplicateNative:true}]){const f=fixture(options),r=await f.api.GET(f.request());assert.equal((await r.json()).messages.length,0);}
});
test('expired accounts, unrelated agents and wrong origins are rejected',async()=>{
 for(const [options,status] of [[{invalid:true},401],[{inactive:true},403],[{other:true},403],[{badOrigin:true},403]]){const f=fixture(options);assert.equal((await f.api.GET(f.request())).status,status);}
});
test('reading a matched thread updates shared read status',async()=>{
 const f=fixture(),r=await f.api.POST(f.request('POST',{clientId:nativeId,action:'read'}));assert.equal(r.status,200);assert(f.updated.some(row=>row.read_at));
});
test('unread and inbox views never request shared transcript rows or media',async()=>{
 for(const mode of ['unread','summaries']){
  const f=fixture(),r=await f.api.GET(f.request('GET',{},'?mode='+mode)),body=await r.json();assert.equal(r.status,200);
  if(mode==='unread')assert.deepEqual(body,{unread:1});else assert.equal(body.conversations[0].latest.body,'Latest');
  assert(!f.calls.some(([db,name])=>db==='mm'&&name==='client_sms_messages'));
  const digest=f.calls.find(([,name])=>name==='platinum_sms_digest')[2];assert.equal(digest.p_shared[0][0],nativeId);
 }
});
test('hidden and reserved copies stay out of full history, including on a targeted thread',async()=>{
 for(const options of [{reserved:true},{hidden:true},{nativeHidden:true}]){
  for(const params of ['', '?clientId='+nativeId]){
   const f=fixture(options),r=await f.api.GET(f.request('GET',{},params));assert.equal(r.status,200);
   const body=await r.json();assert.deepEqual(body.messages,[]);
   if(params&&options.hidden)assert.deepEqual(body.suppressedSids,['SMexample']);
  }
 }
 const f=fixture({hidden:true,duplicate:true}),r=await f.api.GET(f.request('GET',{},'?clientId='+nativeId));
 const result=await r.json();assert.deepEqual(result.messages,[]);assert.deepEqual(result.suppressedSids,['SMexample']);
});
