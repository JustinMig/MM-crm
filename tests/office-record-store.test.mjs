import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const {writeOfficeRecord,recordSelection,writeOfficeOverview}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-record-store.ts',import.meta.url)).toString('base64'))
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',recordId='33333333-3333-4333-8333-333333333333'
function fixture(scope='arctos'){
 const database={clients:[{id},{id:other}],medicare_details:[{client_id:id,part_a_date:'2010-01-01',medicaid_level:'QMB',sunfire_code:'OLD',medicaid_number:'do-not-touch'}],client_doctors:[{id:recordId,client_id:id,doctor_name:'Test Doctor',phone:'old',updated_at:'old-version'}],client_pharmacies:[],health_plans:[],retirement_accounts:[]},audit=[]
 const sb={from(table){
  let operation='select',payload={},filters=[],one=false
  const chain={
   select(){return chain},eq(key,value){filters.push(row=>row[key]===value);return chain},maybeSingle(){one=true;return chain},single(){one=true;return chain},
   update(data){operation='update';payload=data;return chain},insert(data){operation='insert';payload=data;return chain},delete(){operation='delete';return chain},
   then(resolve,reject){try{
    let rows=(database[table]||[]).filter(row=>filters.every(fn=>fn(row)))
    if(operation==='update')rows.forEach(row=>Object.assign(row,payload))
    if(operation==='insert'){const row={id:payload.id||recordId,...payload};(database[table]??=[]).push(row);rows=[row]}
    if(operation==='delete')database[table]=(database[table]||[]).filter(row=>!rows.includes(row))
    return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve,reject)
   }catch(error){return Promise.reject(error).then(resolve,reject)}}
  };return chain
 }}
 return {database,audit,context:{sb,actor:{id:other,permission:{can_edit:true}},scope,log:async(...args)=>audit.push(args)}}
}
test('Sunfire partial saves preserve Medicare dates, level and protected Medicaid number',async()=>{
 const f=fixture();const result=await writeOfficeRecord(f.context,'save_record',{client_id:id,table:'medicare_details',changes:{sunfire_code:'NEW'}})
 assert.equal(result.saved,true);assert.equal(f.database.medicare_details[0].sunfire_code,'NEW')
 assert.equal(f.database.medicare_details[0].part_a_date,'2010-01-01');assert.equal(f.database.medicare_details[0].medicaid_level,'QMB');assert.equal(f.database.medicare_details[0].medicaid_number,'do-not-touch')
 assert.equal(f.audit.length,1)
})
test('Overview checkoffs enforce edit permission and validate year and client before a write',async()=>{
 const f=fixture();f.context.actor.permission.can_edit=false;
 await assert.rejects(writeOfficeOverview(f.context,'save_review_checkoff',{client_id:id,review_year:2026,completed:true}),/not authorized/);
 f.context.actor.permission.can_edit=true;
 for(const bad of [{review_year:'2026',completed:true},{review_year:2026,completed:'true'},{review_year:9999,completed:true}])await assert.rejects(writeOfficeOverview(f.context,'save_review_checkoff',{client_id:id,...bad}),/Invalid review/);
 await assert.rejects(writeOfficeOverview(f.context,'save_review_checkoff',{client_id:recordId,review_year:2026,completed:true}),/Client not found/);
 assert.equal(f.audit.length,0);
})
test('Overview writes preserve campaign workflow state on repeat adds and audit the Office actor',async()=>{
 const requests=[],audit=[];const state={completed:false};
 const sb={from(table){let payload,options;const chain={select(){return chain},eq(){return chain},maybeSingle(){return chain},upsert(p,o){payload=p;options=o;return chain},then(resolve){requests.push({table,payload,options});if(table==='client_review_manual')Object.assign(state,payload);return Promise.resolve({data:table==='clients'||table==='campaigns'?{id}:null,error:null}).then(resolve)}};return chain;}};
 const context={sb,scope:'arctos',actor:{id:other,permission:{can_edit:true}},agencyActorId:recordId,log:async(...args)=>audit.push(args)};
 await writeOfficeOverview(context,'save_review_checkoff',{client_id:id,review_year:2026,completed:true});assert.equal(state.completed,true);assert.ok(state.completed_at);assert.equal(state.updated_by,recordId);
 await writeOfficeOverview(context,'save_review_checkoff',{client_id:id,review_year:2026,completed:false});assert.equal(state.completed_at,null);
 await writeOfficeOverview(context,'add_client_to_campaign',{client_id:id,campaign_id:other});
 const campaign=requests.find(r=>r.table==='campaign_members');assert.equal(campaign.options.ignoreDuplicates,true);assert.deepEqual(Object.keys(campaign.payload).sort(),['added_by','campaign_id','client_id']);assert.equal(audit.at(-1)[3],other);
})
test('Cross-client writes and deletes fail before mutation',async()=>{
 for(const action of ['save_record','delete_record']){
  const f=fixture();await assert.rejects(writeOfficeRecord(f.context,action,{client_id:other,record_id:recordId,table:'client_doctors',changes:{phone:'new'}}),/does not belong/)
  assert.equal(f.database.client_doctors[0].phone,'old');assert.equal(f.audit.length,0)
 }
})
test('Viewer permissions cannot edit and arbitrary fields cannot enter the service-role write path',async()=>{
 const f=fixture();f.context.actor.permission.can_edit=false
 await assert.rejects(writeOfficeRecord(f.context,'save_record',{client_id:id,table:'medicare_details',changes:{sunfire_code:'NEW'}}),/not authorized/)
 f.context.actor.permission.can_edit=true
 for(const changes of [{medicaid_number:'replace'},{client_id:other},{ssn:'replace'}])await assert.rejects(writeOfficeRecord(f.context,'save_record',{client_id:id,table:'medicare_details',changes}),/not available/)
 assert.equal(f.database.medicare_details[0].sunfire_code,'OLD')
})
test('Medical record saves reject stale versions and preserve other fields',async()=>{
 const f=fixture()
 await assert.rejects(writeOfficeRecord(f.context,'save_record',{client_id:id,record_id:recordId,table:'client_doctors',expected_updated_at:'stale-version',changes:{phone:'new'}}),/another session/)
 assert.equal(f.database.client_doctors[0].phone,'old')
 await writeOfficeRecord(f.context,'save_record',{client_id:id,record_id:recordId,table:'client_doctors',expected_updated_at:'old-version',changes:{phone:'new'}})
 assert.equal(f.database.client_doctors[0].doctor_name,'Test Doctor');assert.equal(f.database.client_doctors[0].phone,'new')
})
test('Invalid dates, amounts and Medicaid levels are rejected before writes',async()=>{
 const f=fixture()
 for(const changes of [{part_a_date:'2026-02-30'},{medicaid_level:'NOT-A-LEVEL'}])await assert.rejects(writeOfficeRecord(f.context,'save_record',{client_id:id,table:'medicare_details',changes}),/valid/)
 await assert.rejects(writeOfficeRecord(f.context,'save_record',{client_id:id,table:'health_plans',changes:{premium:-1}}),/valid/)
 assert.equal(f.database.health_plans.length,0)
})
test('Read selections include Sunfire and coverage fields while excluding protected identifiers',()=>{
 for(const scope of ['arctos','platinum']){
  assert.match(recordSelection(scope,'medicare_details'),/sunfire_code/)
  assert.doesNotMatch(recordSelection(scope,'medicare_details'),/medicaid_number|ssn/)
  assert.match(recordSelection(scope,'life_policies'),/expiration_date/)
  assert.doesNotMatch(recordSelection(scope,'retirement_accounts'),/account_number/)
 }
})
