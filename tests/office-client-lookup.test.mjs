import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const {officeClientLookup,officeBirthdayMonth}=await import('data:text/javascript;base64,'+readFileSync(new URL('../office-static/office-client-lookup.ts',import.meta.url)).toString('base64'));
function fixture(){
 const calls=[],rows=Array.from({length:205},(_,i)=>({id:String(i),status:'deceased'}));
 const chain=(rpc,options)=>{let start=0,end=204;const q={select(_fields,opts){options=opts;return q;},eq(key,value){calls.push({filter:[key,value]});return q;},order(key){calls.push({order:key});return q;},range(a,b){start=a;end=b;return q;},then(resolve){return Promise.resolve({data:options?.head?null:rows.slice(start,end+1),count:205,error:null}).then(resolve);}};return q;};
 const sb={rpc(name,args,options){calls.push({rpc:name,args,options});return chain(true,options);},from(table){calls.push({table});return chain(false);}};return {sb,calls};
}
test('Birthdays use the current Central month, including UTC month boundaries',()=>{
 assert.equal(officeBirthdayMonth(new Date('2026-11-01T02:00:00Z')).month,10);assert.equal(officeBirthdayMonth(new Date('2026-11-01T08:00:00Z')).month,11);assert.equal(officeBirthdayMonth(new Date('2027-01-01T02:00:00Z')).month_key,'2026-12');
});
test('Lookup counts request only totals and birthday lists stay paginated and ordered',async()=>{
 const f=fixture(),now=new Date('2026-10-25T12:00:00Z'),stats=await officeClientLookup(f,{view:'stats'},now);assert.equal(stats.birthdays,205);assert.equal(stats.deceased,205);assert.equal(stats.month_label,'October 2026');assert.equal(f.calls.find(call=>call.rpc).options.head,true);
 const page=await officeClientLookup(f,{view:'birthdays',offset:200,limit:200},now);assert.equal(page.clients.length,5);assert.equal(page.total,205);assert.equal(f.calls.filter(call=>call.rpc).at(-1).args.p_month,10);assert.ok(f.calls.some(call=>call.order==='birthday_day'));
});
test('Deceased lookup is explicitly filtered; invalid views and unbounded pages cannot query records',async()=>{
 const f=fixture();await officeClientLookup(f,{view:'deceased',offset:0,limit:20});assert.deepEqual(f.calls.find(call=>call.filter).filter,['status','deceased']);
 const before=f.calls.length;for(const data of [{view:'other'},{view:'birthdays',offset:-1},{view:'deceased',limit:201},{view:'birthdays',offset:1.5}])await assert.rejects(officeClientLookup(f,data));assert.equal(f.calls.length,before);
});
test('Birthday RPC keeps execution restricted to the agency service boundary',()=>{
 const sql=JSON.parse(readFileSync(new URL('../office-static/office-client-lookup-rpc.json',import.meta.url),'utf8')).sql;assert.match(sql,/security invoker/);assert.match(sql,/revoke all[\s\S]*from public,anon,authenticated/);assert.match(sql,/grant execute[\s\S]*to service_role/);assert.match(sql,/status is distinct from 'deceased'/);
 for(const scope of ['arctos','platinum']){const source=readFileSync(new URL('../office-static/office-crm-bridge-'+scope+'.ts',import.meta.url),'utf8');assert.match(source,/action==="client_lookup"/);assert.match(source,/exclude_deceased===true/);}
});
