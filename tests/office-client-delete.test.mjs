import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteOfficeClient} from '../office-static/office-client-delete.ts';
const id='11111111-1111-4111-8111-111111111111';
function fixture(scope='arctos'){
 const calls=[],client={id,assigned_agent_id:id,first_name:'Sample',last_name:'Client',updated_at:'v1'};
 const sb={from(table){let deleting=false;const q={select(){return q},eq(...args){calls.push(args);return q},is(...args){calls.push(args);return q},delete(){deleting=true;calls.push('delete');return q},maybeSingle:async()=>({data:client}),then(resolve){return Promise.resolve({data:deleting?[{id}]:[{storage_path:id+'/test.pdf'}]}).then(resolve)}};return q},storage:{from(bucket){calls.push(bucket);return {remove:async()=>({error:null})}}}};
 return {calls,client,context:{sb,scope,actor:{id,permission:{can_edit:true}},log:async()=>{}},data:{client_id:id,confirmed:true,expected_agent_id:id,expected_name:'Sample Client'}};
}
test('Deletion requires edit permission, confirmation, and matching client/agent identity',async()=>{
 for(const change of ['permission','confirmation','agent','name']){
  const f=fixture();if(change==='permission')f.context.actor.permission.can_edit=false;if(change==='confirmation')f.data.confirmed=false;if(change==='agent')f.data.expected_agent_id=null;if(change==='name')f.data.expected_name='Other';
  await assert.rejects(deleteOfficeClient(f.context,f.data));assert.equal(f.calls.includes('delete'),false);
 }
});
test('Each agency deletion is version checked and cleans only its own document bucket',async()=>{
 for(const scope of ['arctos','platinum']){const f=fixture(scope);const result=await deleteOfficeClient(f.context,f.data);assert.equal(result.deleted,true);assert.ok(f.calls.some(x=>Array.isArray(x)&&x[0]==='updated_at'&&x[1]==='v1'));assert.ok(f.calls.includes(scope==='arctos'?'mh-client-documents':'platinum-client-documents'));}
});
