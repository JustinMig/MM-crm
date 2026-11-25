const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const nativeId='10000000-0000-4000-8000-000000000001',legacyId='20000000-0000-4000-8000-000000000001',agent='8099c3d2-dff1-4a34-8c90-06931f64177e';
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers={};vm.runInNewContext(compile('lib/office-sms.ts'),{exports:helpers,URLSearchParams,Set,Map,Date});
function fixture(options={}){
 const updated=[],client={first_name:'Sample',last_name:'Client',phone:'6625550100'};
 function query(scope,table){
  let change=null;
  const q={select:()=>q,eq:()=>q,order:()=>q,range:()=>q,not:()=>q,in:()=>q,is:()=>q,update:v=>{change=v;return q;},
   maybeSingle:async()=>({data:{id:options.other?'other':agent,active:!options.inactive,role:options.other?'agent':'admin'}}),
   single:async()=>({data:{agency_id:'agency',full_name:'Isaiah Hernandez'}}),
   then(resolve){
    if(change){updated.push(change);return resolve({error:null});}
    if(table==='clients'){
     const rows=scope==='native'?[{...client,id:nativeId}]:[{...client,id:legacyId,first_name:options.wrongName?'Different':'Sample'}];
     if(options.duplicate&&scope==='mm')rows.push({...rows[0],id:'duplicate'});
     return resolve({data:rows,error:null});
    }
    return resolve({data:[{id:'message',client_id:legacyId,direction:'inbound',body:'Existing M&M message',twilio_message_sid:'SMexample',status:'received',created_at:'2026-08-20T15:24:00Z',read_at:null}],error:null});
   }};return q;
 }
 const native={auth:{getUser:async()=>({data:{user:options.invalid?null:{id:options.other?'other':agent}},error:options.invalid?{}:null})},from:table=>query('native',table)},admin={from:table=>query('mm',table)},exports={};
 vm.runInNewContext(compile('app/api/platinum-sms-history/route.ts'),{exports,Request,Response,URL,Date,Map,Set,require:name=>{
  if(name==='@supabase/supabase-js')return {createClient:()=>native};
  if(name==='@/lib/supabase/admin')return {createAdminClient:()=>admin};
  if(name==='@/lib/office-sms')return helpers;
  if(name==='@/lib/sms-media')return {photoUrls:async()=>[]};
  throw Error(name);
 }});
 const request=(method='GET',input={})=>new Request('https://crm.mayerig.com/api/platinum-sms-history',{method,headers:{Authorization:'Bearer synthetic',Origin:options.badOrigin?'https://bad.test':'https://pf.mayerig.com','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(input)}:{})});
 return {api:exports,request,updated};
}
test('exact matched Isaiah history includes older messages',async()=>{
 const f=fixture(),r=await f.api.GET(f.request());assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.messages.length,1);assert.equal(data.messages[0].client_id,nativeId);
 assert.equal(data.messages[0].body,'Existing M&M message');assert.equal(data.messages[0].occurred_at,'2026-08-20T15:24:00Z');
});
test('mismatched and ambiguous clients expose no history',async()=>{
 for(const options of [{wrongName:true},{duplicate:true}]){const f=fixture(options),r=await f.api.GET(f.request());assert.equal((await r.json()).messages.length,0);}
});
test('expired accounts, unrelated agents and wrong origins are rejected',async()=>{
 for(const [options,status] of [[{invalid:true},401],[{inactive:true},403],[{other:true},403],[{badOrigin:true},403]]){const f=fixture(options);assert.equal((await f.api.GET(f.request())).status,status);}
});
test('reading a matched thread updates shared read status',async()=>{
 const f=fixture(),r=await f.api.POST(f.request('POST',{clientId:nativeId,action:'read'}));assert.equal(r.status,200);assert(f.updated.some(row=>row.read_at));
});
