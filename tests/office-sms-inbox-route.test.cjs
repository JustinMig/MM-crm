// Synthetic clients only. Exercises the actual Office HTTP handler and agency matching.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),agency=uuid(11000),agent=uuid(11001),mmAgent=uuid(11002);
const compile=p=>ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const person=(i,phone,name='Client')=>({id:uuid(i),first_name:name,last_name:'Test',phone});
const source=(kind,client,body='Message')=>({source:kind,source_id:client.id,summary:{[kind==='office'?'remote_client_id':'client_id']:client.id,latest_body:body,phone:client.phone,unread_count:'2',latest_at:'2026-11-01T00:00:00Z'}});
async function inbox({sources,agencyClients=[],mmClients=[],allowed=true}){
 const helper={};vm.runInNewContext(compile('lib/office-sms.ts'),{exports:helper,Set,Map});
 const bridgeRequests=[],rpcRequests=[];
 const admin={auth:{getUser:async()=>({data:{user:{id:uuid(11003)}}})},from(table){
  assert.ok(['profiles','office_crm_access'].includes(table),'full roster read: '+table);
  const q={select(){return this;},eq(){return this;},maybeSingle(){return {data:table==='profiles'?{agency_id:agency,active:true,role:'manager'}:{active:true,arctos_access:allowed,can_edit:true}};},then(resolve){resolve({data:[{id:mmAgent,full_name:'Justin Example'}]});}};return q;
 },rpc(name,args){
  rpcRequests.push({name,args});
  let rows;
  if(name==='office_sms_inbox_sources'){assert.equal(args.p_agency,agency);assert.equal(args.p_scope,'arctos');assert.equal(args.p_legacy_agent,mmAgent);rows=sources;}
  else {assert.equal(name,'crm_sms_phone_candidates');assert.equal(args.p_agent,mmAgent);rows=mmClients.filter(c=>args.p_phones.includes(helper.smsPhone(c.phone)));}
  return {select(){return this;},eq(col,val){assert.equal(col,'agency_id');assert.equal(val,agency);return this;},order(){return this;},range(start,end){return {data:rows.slice(start,end+1)};}};
 }};
 const fetch=async(_url,init)=>{const data=JSON.parse(init.body);bridgeRequests.push(data);assert.equal(data.agent_id,agent);
  const current={id:agent,full_name:'Justin Example'};
  if(data.agent_only)return Response.json({agent:current});
  assert.ok(data.candidate_phones?.length>0);assert.ok(data.candidate_phones.length<=1000);
  return Response.json({agent:current,clients:agencyClients.filter(c=>data.candidate_phones.includes(helper.smsPhone(c.phone)))});
 };
 const exp={};vm.runInNewContext(compile('app/api/office-sms/route.ts'),{exports:exp,require:name=>name==='next/server'?{NextResponse:{json:(v,o)=>Response.json(v,o)}}:name.includes('supabase/admin')?{createAdminClient:()=>admin}:helper,fetch,AbortSignal,Response,Request,Set,Map});
 const response=await exp.POST(new Request('https://crm.test/api/office-sms',{method:'POST',headers:{Authorization:'Bearer synthetic'},body:JSON.stringify({agency:'arctos',command:'conversations',agent_id:agent})}));
 return {status:response.status,body:await response.json(),bridgeRequests,rpcRequests};
}
test('Office uses current agent matches, native thread precedence, and exact unique legacy identities including clients without messages',async()=>{
 const remote=[person(1,'(555) 010-0001'),person(2,'5550100002'),person(3,'5550100003'),person(4,'5550100004')];
 const legacy=[person(11,'+15550100001'),person(12,'+15550100002'),person(13,'+15550100003'),person(14,'+15550100003')];
 const oldOwnerClient=person(400,'5550100004'),reserved=person(500,'662-750-4626');
 const r=await inbox({sources:[source('office',remote[0],'reassigned native'),source('legacy',legacy[0]),source('legacy',legacy[1]),source('legacy',legacy[2]),source('office',oldOwnerClient),source('office',reserved)],agencyClients:remote,mmClients:legacy});
 assert.equal(r.status,200);assert.deepEqual(r.body.conversations.map(x=>x.client_id),[remote[0].id,remote[1].id]);
 const [native,shared]=r.body.conversations;assert.equal(native.latest_body,'reassigned native');assert.equal(shared.unread_count,2);assert.equal(shared.agent_id,agent);assert.equal(shared.phone,remote[1].phone);
 assert.equal(r.bridgeRequests.length,2);assert.ok(!r.bridgeRequests[1].candidate_phones.includes('+16627504626'));
 assert.equal(r.rpcRequests.filter(r=>r.name==='crm_sms_phone_candidates').length,1);
});
test('A large inbox pages through every source and limits the number of authenticated agency lookups',async()=>{
 const clients=Array.from({length:1001},(_,i)=>person(i+1,'555'+String(1000000+i)));
 const r=await inbox({sources:clients.map(c=>source('office',c)),agencyClients:clients});
 assert.equal(r.status,200);assert.equal(r.body.conversations.length,1001);
 assert.deepEqual(r.bridgeRequests.slice(1).map(r=>r.candidate_phones.length),[1000,1]);assert.equal(r.rpcRequests.length,2);
});
test('A denied agency cannot reach either conversation source; an empty inbox skips client lookup',async()=>{
 const denied=await inbox({sources:[],allowed:false});assert.equal(denied.status,403);assert.equal(denied.bridgeRequests.length+denied.rpcRequests.length,0);
 const empty=await inbox({sources:[]});assert.deepEqual(empty.body.conversations,[]);assert.equal(empty.bridgeRequests.length,1);assert.equal(empty.rpcRequests.length,1);
});
