import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {officeMedicationSearch}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-medication-search.ts',import.meta.url)).toString('base64'));
test('Copied RxTerms lookup sends only the sanitized drug query and preserves its dosage choices',async()=>{
 let called;const result=await officeMedicationSearch({}, {query:'  Sample%_ drug ',client_id:'private-client'},async(url,options)=>{called={url:String(url),options};return Response.json([1,['Sample drug'],{STRENGTHS_AND_FORMS:[['10 mg tablet','10 mg tablet','20 mg tablet']],RXCUIS:[['123']]},[]]);});const url=new URL(called.url);assert.equal(url.origin,'https://clinicaltables.nlm.nih.gov');assert.equal(url.searchParams.get('terms'),'Sample drug');assert.equal(url.searchParams.get('maxList'),'20');assert.equal(called.url.includes('private-client'),false);assert.deepEqual(result.suggestions[0].strengths,['10 mg tablet','20 mg tablet']);
});
test('Short terms never query the network, and unavailable catalogs fall back to agency drug names without client identifiers',async()=>{
 let network=false;assert.deepEqual(await officeMedicationSearch({}, {query:'a'},async()=>{network=true;}),{suggestions:[]});assert.equal(network,false);let selected;
 const q={select(value){selected=value;return q;},ilike(){return q;},order(){return q;},limit(){return Promise.resolve({data:[{medication_name:'Example',strength:'10 mg'},{medication_name:'Example',strength:'20 mg'}],error:null});}};
 const result=await officeMedicationSearch({sb:{from(table){assert.equal(table,'client_medications');return q;}}},{query:'Example'},async()=>{throw Error('offline');});assert.equal(selected,'medication_name,strength');assert.equal(result.suggestions.length,1);assert.deepEqual(result.suggestions[0].strengths,['10 mg','20 mg']);
});
