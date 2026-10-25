import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {officeClientNotes}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-client-notes.ts',import.meta.url)).toString('base64'));
const client='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',note='33333333-3333-4333-8333-333333333333';
function fixture(scope='arctos'){
 const db={clients:[{id:client,assigned_agent_id:other}],client_notes:[],profiles:[{id:other}]},audit=[],writes=[];
 const sb={from(table){let filters=[],payload,operation='read',one=false;const q={select(){return q;},eq(key,value){filters.push(row=>row[key]===value);return q;},order(){return q;},limit(){return q;},single(){one=true;return q;},maybeSingle(){one=true;return q;},insert(value){operation='insert';payload=value;return q;},delete(){operation='delete';return q;},then(resolve){let rows=db[table].filter(row=>filters.every(fn=>fn(row)));if(operation==='insert'){rows=[{...payload}];db[table].push(rows[0]);writes.push(payload);}if(operation==='delete'){db[table]=db[table].filter(row=>!rows.includes(row));writes.push('delete');}return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve);}};return q;}};
 return {db,audit,writes,context:{sb,actor:{id:other,permission:{can_edit:true}},scope,agencyActorId:null,log:async(...args)=>audit.push(args)},data:{client_id:client,note_id:note,title:'Review',body:'Complete note text'}};
}
test('Client note history is scoped, includes legacy Platinum text, and is readable without edit permission',async()=>{
 const f=fixture('platinum');f.context.actor.permission.can_edit=false;f.db.client_notes.push({id:note,client_id:client,title:'Legacy',note:'Older full text',body:null},{id:other,client_id:other,body:'Other client'});const result=await officeClientNotes(f.context,'client_notes',f.data);assert.equal(result.notes.length,1);assert.equal(result.notes[0].body,'Older full text');assert.equal('note' in result.notes[0],false);assert.equal(f.writes.length,0);
 for(const action of ['add_client_note','delete_client_note'])await assert.rejects(officeClientNotes(f.context,action,f.data),/not authorized/);
});
for(const scope of ['arctos','platinum'])test(scope+' creates titled notes with a server-chosen author and retries without duplicating them',async()=>{
 const f=fixture(scope),result=await officeClientNotes(f.context,'add_client_note',{...f.data,author_id:client});assert.equal(result.note.author_id,other);assert.equal(result.note.body,'Complete note text');if(scope==='platinum')assert.equal(result.note.note,'Complete note text');await officeClientNotes(f.context,'add_client_note',f.data);assert.equal(f.db.client_notes.length,1);assert.equal(f.audit.length,1);await assert.rejects(officeClientNotes(f.context,'add_client_note',{...f.data,body:'Changed request'}),/already belongs/);
 await officeClientNotes(f.context,'delete_client_note',f.data);await officeClientNotes(f.context,'delete_client_note',f.data);assert.equal(f.db.client_notes.length,0);assert.equal(f.audit.length,2);
});
test('Another client’s note, malformed IDs, overlong text, and missing clients cannot be mutated',async()=>{
 const f=fixture();f.db.client_notes.push({id:note,client_id:other});for(const action of ['add_client_note','delete_client_note'])await assert.rejects(officeClientNotes(f.context,action,f.data),/does not belong/);f.db.client_notes=[];
 for(const bad of [{note_id:'bad'},{client_id:'bad'},{body:''},{body:'x'.repeat(10001)},{title:'x'.repeat(161)},{client_id:other}])await assert.rejects(officeClientNotes(f.context,'add_client_note',{...f.data,...bad}));assert.equal(f.writes.length,0);
});
