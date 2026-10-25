import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {officeCoverageFiles}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-coverage-files.ts',import.meta.url)).toString('base64'));
const client='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',docId='33333333-3333-4333-8333-333333333333',plan='44444444-4444-4444-8444-444444444444';
function fixture(){
 const database={clients:[{id:client,assigned_agent_id:other}],life_policies:[{id:plan,client_id:client}],documents:[]},objects=[],audit=[],calls=[];
 const sb={from(table){let action='select',payload,one=false,filters=[];const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},order(){return q;},limit(){return q;},maybeSingle(){one=true;return q;},single(){one=true;return q;},insert(value){action='insert';payload=value;return q;},delete(){action='delete';return q;},then(resolve){let rows=(database[table]||[]).filter(row=>filters.every(fn=>fn(row)));if(action==='insert'){rows=[{...payload}];database[table].push(rows[0]);}if(action==='delete')database[table]=database[table].filter(row=>!rows.includes(row));calls.push({table,action,payload});return Promise.resolve({data:one?rows[0]||null:rows,error:null}).then(resolve);}};return q;},storage:{from(bucket){calls.push({bucket});return {list:async(folder)=>({data:objects.filter(o=>o.folder===folder),error:null}),createSignedUploadUrl:async(path,options)=>{calls.push({path,options});return {data:{signedUrl:'https://agency.invalid/'+path},error:null};},remove:async paths=>{calls.push({remove:paths});return {data:[],error:null};}};}}};
 const context={sb,actor:{id:other,permission:{can_edit:true}},scope:'arctos',agencyActorId:other,log:async(...args)=>audit.push(args)};
 const data={client_id:client,document_id:docId,category:'medicare_card',file_name:'Card.pdf',mime_type:'application/pdf',file_size:10};
 return {context,data,database,objects,audit,calls};
}
test('file reads are scoped to one client, and viewers cannot upload or remove',async()=>{
 const f=fixture();f.database.documents.push({id:docId,client_id:client,file_name:'Mine'},{id:plan,client_id:other,file_name:'Other'});
 f.context.actor.permission.can_edit=false;
 assert.equal((await officeCoverageFiles(f.context,'coverage_documents',f.data)).documents.length,1);
 for(const action of ['coverage_upload_start','coverage_upload_complete','coverage_remove_document'])await assert.rejects(officeCoverageFiles(f.context,action,f.data),/not authorized/);
 assert.equal(f.calls.some(call=>call.path||call.remove),false);
});
test('another client’s document or policy cannot be changed or used for a signed upload',async()=>{
 const f=fixture();f.database.documents.push({id:docId,client_id:other});
 await assert.rejects(officeCoverageFiles(f.context,'coverage_remove_document',f.data),/does not belong/);f.database.documents=[];
 await assert.rejects(officeCoverageFiles(f.context,'coverage_upload_start',{...f.data,category:'life_policy_document',parent_id:other}),/does not belong/);
 assert.equal(f.calls.some(call=>call.path||call.remove),false);
});
test('category, size, MIME and parent validation precede signed upload authorization',async()=>{
 const f=fixture();
 for(const invalid of [{category:'soa'},{file_size:26*1024*1024},{mime_type:'text/html'},{file_name:''},{category:'life_policy_document',parent_id:'bad'},{parent_id:other}])await assert.rejects(officeCoverageFiles(f.context,'coverage_upload_start',{...f.data,...invalid}));
 assert.equal(f.calls.some(call=>call.path),false);
});
test('uploads use private client paths, are verified before insertion, and retry without duplicates',async()=>{
 const f=fixture();const start=await officeCoverageFiles(f.context,'coverage_upload_start',f.data);assert.ok(start.upload_url);
 assert.equal(f.calls.find(call=>call.path).options.upsert,false);
 await assert.rejects(officeCoverageFiles(f.context,'coverage_upload_complete',f.data),/could not be verified/);assert.equal(f.database.documents.length,0);
 f.objects.push({folder:client+'/office-coverage/'+docId,name:'Card.pdf',metadata:{size:10,mimetype:'application/pdf'}});
 assert.equal((await officeCoverageFiles(f.context,'coverage_upload_start',f.data)).uploaded,true);
 const complete=await officeCoverageFiles(f.context,'coverage_upload_complete',f.data);assert.equal(complete.saved,true);assert.equal(complete.document.uploaded_by,other);
 const again=await officeCoverageFiles(f.context,'coverage_upload_complete',f.data);assert.equal(again.document.id,docId);assert.equal(f.database.documents.length,1);assert.equal(f.audit.filter(row=>row[0]==='upload').length,1);
 await assert.rejects(officeCoverageFiles(f.context,'coverage_upload_start',{...f.data,file_name:'Other.pdf'}),/another upload/);
});
test('plan documents keep their policy association, while retained SOAs cannot be deleted',async()=>{
 const f=fixture();const data={...f.data,category:'life_policy_document',parent_id:plan};f.objects.push({folder:client+'/office-coverage/'+docId,name:'Card.pdf',metadata:{size:10,mimetype:'application/pdf'}});
 const result=await officeCoverageFiles(f.context,'coverage_upload_complete',data);assert.equal(result.document.life_policy_id,plan);
 f.database.documents[0].compliance_locked=true;
 await assert.rejects(officeCoverageFiles(f.context,'coverage_remove_document',data),/retained/);
 f.database.documents[0].compliance_locked=false;f.database.documents[0].category='soa';
 await assert.rejects(officeCoverageFiles(f.context,'coverage_remove_document',data),/retained/);
 assert.equal(f.calls.some(call=>call.remove),false);
});
test('signed SOA uploads retain server-controlled ten-year locking and reject unsigned metadata',async()=>{
 const f=fixture(),data={...f.data,category:'soa',mime_type:'image/png',file_name:'Signed.png',soa:{appointment_date:'2026-11-01',coverage_year:2027}};
 await assert.rejects(officeCoverageFiles(f.context,'coverage_upload_start',{...data,soa:{appointment_date:'2026-02-31',coverage_year:2027}}),/Confirm the SOA/);
 f.objects.push({folder:client+'/office-coverage/'+docId,name:'Signed.png',metadata:{size:10,mimetype:'image/png'}});
 const result=await officeCoverageFiles(f.context,'coverage_upload_complete',data);
 assert.equal(result.document.compliance_locked,true);assert.equal(result.document.appointment_date,'2026-11-01');assert.equal(result.document.coverage_year,2027);
 assert.ok(new Date(result.document.retention_until).getUTCFullYear()>=new Date().getUTCFullYear()+10);
 await assert.rejects(officeCoverageFiles(f.context,'coverage_remove_document',data),/retained/);
});
