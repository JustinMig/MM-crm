const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../office-static/office-calendar-mutations.ts'),'utf8').replace('export async function mutateOfficeCalendar','async function mutateOfficeCalendar');
const mutate=new Function(code+'\nreturn mutateOfficeCalendar')();
const date='2026-11-20',id='event',owner='9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9';

function fixture(){
 const source={id,event_date:date,status:'scheduled',client_id:null,start_time:'10:00',end_time:'10:30',updated_at:'version-1'};
 const calls=[],audit=[];
 function query(name,result){
  const builder={then(yes,no){return Promise.resolve({data:result,error:null}).then(yes,no)}};
  for(const k of ['eq','select','update','upsert','maybeSingle','delete'])builder[k]=(...args)=>{calls.push([name,k,...args]);return builder;};
  return builder;
 }
 const ctx={
  sb:{from(n){return query(n,n==='appointments'?source:null)}},
  central:{rpc(n,p){calls.push([n,p]);return query(n,n==='office_arctos_calendar_events'?source:null);}},
  actor:{permission:{can_edit:true},id:'staff'},uuid:v=>v===id,log:async (...args)=>audit.push(args)
 };
 return {ctx,calls,audit};
}
function input(source,op,extra={}){return {operation:op,event_id:id,calendar_source:source,expected_status:'scheduled',event_date:date,...extra};}
test('Office writes only the selected local appointment and preserves unrelated fields',async()=>{
 const {ctx,calls}=fixture();
 await mutate(ctx,input('arctos_campaign','update',{changes:{notes:'only new notes'}}));
 assert.deepEqual(calls.find(c=>c[1]==='update'),['appointments','update',{notes:'only new notes'}]);
 assert.ok(calls.some(c=>c[1]==='eq'&&c[2]==='assigned_agent_id'&&c[3]===owner));
 assert.ok(calls.some(c=>c[1]==='eq'&&c[2]==='updated_at'&&c[3]==='version-1'));
 assert.ok(!calls.some(c=>c[0].startsWith('office_')));
});
test('Complete and delete use the shared mutation RPC for shared events',async()=>{
 for(const op of ['complete','delete']){
  const {ctx,calls}=fixture();await mutate(ctx,input('mayer_justin',op));
  const call=calls.find(c=>c[0]==='office_change_arctos_shared_event');
  assert.equal(call[1].p_operation,op);assert.equal(call[1].p_id,id);
  assert.ok(!calls.some(c=>c[0]==='appointments'));
 }
});
test('Denied edits, stale statuses and assignment tampering are rejected',async()=>{
 let {ctx,calls}=fixture();ctx.actor.permission.can_edit=false;
 await assert.rejects(mutate(ctx,input('mayer_justin','delete')),/authorized/);assert.deepEqual(calls,[]);
 ({ctx}=fixture());
 await assert.rejects(mutate(ctx,input('arctos_campaign','delete',{expected_status:'completed'})),/changed/);
 await assert.rejects(mutate(ctx,input('arctos_campaign','update',{changes:{assigned_agent_id:'other'}})),/Unsupported/);
});
