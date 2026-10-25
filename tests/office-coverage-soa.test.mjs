import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {officeCoverageSoa}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-coverage-soa.ts',import.meta.url)).toString('base64'));
const client='11111111-1111-4111-8111-111111111111',agent='22222222-2222-4222-8222-222222222222',office='33333333-3333-4333-8333-333333333333';
function fixture(){
 const db={clients:[{id:client,assigned_agent_id:agent,first_name:'Test',last_name:'Client',phone:'555-0100'}],profiles:[{id:agent,active:true,full_name:'Agency Agent',phone:'555-0200'}],soa_signature_requests:[]},audit=[];
 const sb={from(table){let filters=[],one=false,insert;const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(value){insert=value;return q;},then(resolve){let rows=db[table].filter(row=>filters.every(fn=>fn(row)));if(insert){rows=[{id:office,...insert}];db[table].push(rows[0]);}return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve);}};return q;}};
 return {db,audit,context:{sb,actor:{id:office,permission:{can_edit:true}},agencyActorId:agent,log:async(...args)=>audit.push(args)},data:{client_id:client,payload:{phone:'+16625550100',token_hash:'a'.repeat(64),request_payload:{appointment_date:'2026-11-01',coverage_year:2027,products:['Medicare Supplement (Medigap)'],other_product:'',beneficiary_name:'Untrusted name',agent_name:'Untrusted agent'}}}};
}
test('SOA context is authorized for this agency client and link payload names come from the server',async()=>{
 const f=fixture();const context=await officeCoverageSoa(f.context,'coverage_soa_context',f.data);assert.equal(context.client.id,client);assert.equal(context.user.id,agent);
 await officeCoverageSoa(f.context,'coverage_soa_request',f.data);const saved=f.db.soa_signature_requests[0];assert.equal(saved.request_payload.beneficiary_name,'Test Client');assert.equal(saved.request_payload.agent_name,'Agency Agent');assert.equal(saved.requested_by,agent);assert.equal(f.audit[0][3],office);
});
test('viewers, invalid client IDs, missing clients, and malformed links cannot create an SOA request',async()=>{
 const f=fixture();f.context.actor.permission.can_edit=false;await assert.rejects(officeCoverageSoa(f.context,'coverage_soa_request',f.data),/not authorized/);f.context.actor.permission.can_edit=true;
 await assert.rejects(officeCoverageSoa(f.context,'coverage_soa_request',{...f.data,client_id:office}),/Client not found/);
 for(const payload of [{...f.data.payload,token_hash:'bad'},{...f.data.payload,phone:'bad'},{...f.data.payload,request_payload:{appointment_date:'2026-02-31',coverage_year:2027,products:[]}},{...f.data.payload,request_payload:{appointment_date:'2026-11-01',coverage_year:2027,products:['unapproved']}}])await assert.rejects(officeCoverageSoa(f.context,'coverage_soa_request',{...f.data,payload}));
 assert.equal(f.db.soa_signature_requests.length,0);
});
