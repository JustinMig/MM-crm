import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../office-static/platinum-soa-sign.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source.replace(/^import .*;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function fixture(record=null){
 let handler;const writes=[],buckets=[];
 const db={from(table){let payload,select=false;const q={select(){select=true;return q;},eq(){return q;},maybeSingle(){return q;},single(){return q;},insert(data){payload=data;return q;},update(data){payload=data;return q;},then(resolve){if(payload)writes.push({table,payload});return Promise.resolve({data:table==='soa_signature_requests'&&!payload?record:table==='documents'&&select?{id:'22222222-2222-4222-8222-222222222222'}:null,error:null}).then(resolve);}};return q;},storage:{from(bucket){buckets.push(bucket);return {upload:async()=>({error:null}),remove:async()=>({error:null})};}}};
 new Function('Deno','createClient','crypto',compiled)({env:{get:()=> 'synthetic-only'},serve:fn=>{handler=fn;}},()=>db,webcrypto);
 return {request:(method='GET',body,token='a'.repeat(32))=>handler(new Request('https://unit.invalid/soa-sign'+(token?'?token='+token:''),{method,...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{})})),writes,buckets};
}
test('public signing requests without a valid token cannot reveal client data or write files',async()=>{
 const f=fixture();assert.equal((await f.request('GET',null,'')).status,400);assert.equal((await f.request()).status,404);assert.equal(f.writes.length,0);assert.equal(f.buckets.length,0);
});
test('Platinum signatures use its own bucket and required agency uploader with locked retention',async()=>{
 const record={id:'11111111-1111-4111-8111-111111111111',client_id:'33333333-3333-4333-8333-333333333333',requested_by:'44444444-4444-4444-8444-444444444444',status:'pending',expires_at:'2099-01-01',request_payload:{beneficiary_name:'Synthetic Client',appointment_date:'2026-11-01',coverage_year:2027}};
 const f=fixture(record);assert.equal((await f.request('POST',{})).status,400);assert.equal(f.writes.length,0);
 const result=await f.request('POST',{signature_png_base64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')});assert.equal(result.status,200);
 assert.deepEqual(f.buckets,['platinum-client-documents']);const document=f.writes.find(write=>write.table==='documents').payload;assert.equal(document.uploaded_by,record.requested_by);assert.equal(document.compliance_locked,true);assert.equal(document.coverage_year,2027);
 assert.ok(new Date(document.retention_until)>new Date(document.signed_at));
});
