const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dir=path.resolve(__dirname,'../office-static');
const zip=require(path.join(dir,'vendor/zip-core-2.8.26.min.js'));
async function simulate(fail){
 const dom=new JSDOM('<main></main>'),window=dom.window;
 let blob,aborted=false;
 const chunks=[];
 let stagingClosed=false,reads=0,downloads=0;
 const file={getFile:async()=>{assert.ok(stagingClosed);reads++;return blob;},createWritable:async()=>new WritableStream({write:x=>chunks.push(x.slice()),close:()=>{blob=new Blob(chunks);stagingClosed=true;},abort:()=>{aborted=true}})};
 const staging={entries:async function*(){},getFileHandle:async()=>file,removeEntry:async()=>{}};
 Object.defineProperty(window.navigator,'storage',{value:{getDirectory:async()=>({getDirectoryHandle:async()=>staging})}});
 window.HTMLAnchorElement.prototype.click=()=>{downloads++;};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'office-backup.js'),'utf8'),{window,document:window.document,zip,URL:{createObjectURL:()=> 'blob:sample',revokeObjectURL:()=>{}},fetch:async()=>new Response(fail?null:'sample document',{status:fail?404:200})});
 const root=window.document.querySelector('main');
 const ids=[{id:'archived',updated_at:'v1'}];
 window.officeBackup.mount(root,{allowed:()=>true,request:async(scope,action)=>action==='backup_index'?{clients:ids}:{records:[{client:{id:'archived',first_name:'Jane',last_name:'Smith',status:'deceased'},related:{},protected:{ssn:'SAMPLE ONLY'}}],files:[{id:'doc',client_id:'archived',name:'test.pdf',url:'https://example.invalid/file'}]},sms:async()=>({byClient:{archived:[{body:'sample text'}]},files:[]})});
 const form=root.querySelector('form'),pass='synthetic-password';
 form.elements.password.value=form.elements.confirmation.value=pass;
 form.dispatchEvent(new window.Event('submit',{cancelable:true}));
 for(let i=0;i<200 && !/Backup (complete|did not finish)/.test(root.querySelector('[role=status]').textContent);i++)await new Promise(r=>setTimeout(r,10));
 const message=root.querySelector('[role=status]').textContent;
 if(!fail){await root.querySelector('[data-download-zip]').onclick();assert.equal(reads,2);assert.equal(downloads,2);}
 dom.window.close();
 if(fail){assert.match(message,/did not finish/);assert.ok(aborted);assert.equal(blob,undefined);return;}
 assert.match(message,/Backup complete/);
 const reader=new zip.ZipReader(new zip.BlobReader(blob));const entries=await reader.getEntries();
 assert.ok(entries.every(e=>e.encrypted));
 assert.equal(entries.length,11);const record=entries.find(e=>e.filename==='platinum/Smith, Jane/record.json');
 await assert.rejects(record.getData(new zip.TextWriter(),{password:'wrong',useWebWorkers:false}));
 const saved=JSON.parse(await record.getData(new zip.TextWriter(),{password:pass,useWebWorkers:false}));
 assert.equal(saved.client.status,'deceased');assert.equal(saved.related.shared_messages[0].body,'sample text');
 assert.equal(await entries.find(e=>e.filename.endsWith('/doc.pdf')).getData(new zip.TextWriter(),{password:pass,useWebWorkers:false}),'sample document');await reader.close();
}
test('both agency records and file bytes round trip through the encrypted backup',()=>simulate(false));
test('a missing document aborts the output',()=>simulate(true));
test('folder backup saves readable CSV, offline links and original file bytes without a password',async()=>{
 const os=require('node:os'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'office-csv-test-'));
 let staleWrites=0;
 function directory(at){
  return {
   async getDirectoryHandle(n){const d=path.join(at,n);fs.mkdirSync(d,{recursive:true});return directory(d)},
   async getFileHandle(n){return {createWritable:async()=>{const chunks=[];return new WritableStream({write:x=>chunks.push(Buffer.from(x)),close:()=>{if(n==='file-1.pdf'&&staleWrites<4){staleWrites++;throw Object.assign(new Error('stale handle'),{name:'InvalidStateError'});}fs.writeFileSync(path.join(at,n),Buffer.concat(chunks));}});}}},
   async removeEntry(n){fs.unlinkSync(path.join(at,n));}
  };
 }
 const dom=new JSDOM('<main></main>'),window=dom.window;
 try{
  window.showDirectoryPicker=async()=>directory(temp);
  vm.runInNewContext(fs.readFileSync(path.join(dir,'office-backup.js'),'utf8'),{window,document:window.document,fetch:async()=>new Response('local file bytes')});
  const host=window.document.querySelector('main'),client={id:'123',first_name:'Test',last_name:'Family, Jr.',status:'active',phone:'555-0100'};
  window.officeBackup.mount(host,{allowed:()=>true,request:async(scope,action)=>action==='backup_index'?{clients:[{id:client.id}]}:{records:[{client:{...client,id:'456'},protected:{},related:{}},{client,protected:{identifiers:{ssn:'sample'}},related:{client_notes:[{body:'=1+2'}]}}],files:[{id:'file-1',client_id:'123',name:'Policy & card.pdf',url:'https://example.invalid/test'}]},sms:async()=>({byClient:{},files:[]})});
  const form=host.querySelector('form');form.elements.scope.value='arctos';assert.ok(form.checkValidity());
  form.dispatchEvent(new window.Event('submit',{cancelable:true}));
  for(let i=0;i<400&&host.querySelector('[data-retry-write]').hidden;i++)await new Promise(r=>setTimeout(r,10));
  assert.match(host.textContent,/Backup paused/);host.querySelector('[data-retry-write]').click();
  for(let i=0;i<300&&!/Backup complete/.test(host.textContent);i++)await new Promise(r=>setTimeout(r,10));
  assert.match(host.textContent,/Backup complete/);
  const root=path.join(temp,fs.readdirSync(temp)[0]);
  assert.equal(staleWrites,4);assert.equal(fs.existsSync(path.join(root,'INCOMPLETE.txt')),false);
  assert.match(fs.readFileSync(path.join(root,'Clients.csv'),'utf8'),/"Family, Jr."/);
  const index=new JSDOM(fs.readFileSync(path.join(root,'Open-Backup.html'),'utf8'));
  const recordPath=path.join(root,[...index.window.document.querySelectorAll('td a')].find(a=>a.getAttribute('href').includes('(2)')).getAttribute('href'));
  const record=new JSDOM(fs.readFileSync(recordPath,'utf8'));
  assert.match(record.window.document.body.textContent,/sample/);
  const link=[...record.window.document.querySelectorAll('a')].find(a=>a.textContent==='Policy & card.pdf');
  assert.equal(fs.readFileSync(path.resolve(path.dirname(recordPath),link.getAttribute('href')),'utf8'),'local file bytes');
  assert.match(fs.readFileSync(path.resolve(path.dirname(recordPath),'Details.csv'),'utf8'),/"'=1\+2"/);
 }finally{dom.window.close();fs.rmSync(temp,{recursive:true,force:true});}
});
