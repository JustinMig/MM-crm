const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dir=path.resolve(__dirname,'../office-static');
const zip=require(path.join(dir,'vendor/zip-core-2.8.26.min.js'));
async function simulate(fail){
 const dom=new JSDOM('<main></main>'),window=dom.window;
 let blob,aborted=false;
 const chunks=[];
 window.showSaveFilePicker=async()=>({createWritable:async()=>new WritableStream({write:x=>chunks.push(x.slice()),close:()=>{blob=new Blob(chunks)},abort:()=>{aborted=true}})});
 vm.runInNewContext(fs.readFileSync(path.join(dir,'office-backup.js'),'utf8'),{window,document:window.document,zip,fetch:async()=>new Response(fail?null:'sample document',{status:fail?404:200})});
 const root=window.document.querySelector('main');
 const ids=[{id:'archived',updated_at:'v1'}];
 window.officeBackup.mount(root,{allowed:()=>true,request:async(scope,action)=>action==='backup_index'?{clients:ids}:{records:[{client:{id:'archived',status:'deceased'},related:{},protected:{ssn:'SAMPLE ONLY'}}],files:[{id:'doc',client_id:'archived',name:'test.pdf',url:'https://example.invalid/file'}]},sms:async()=>({byClient:{archived:[{body:'sample text'}]},files:[]})});
 const form=root.querySelector('form'),pass='synthetic-password';
 form.elements.password.value=form.elements.confirmation.value=pass;
 form.dispatchEvent(new window.Event('submit',{cancelable:true}));
 for(let i=0;i<200 && !/Backup (complete|did not finish)/.test(root.querySelector('[role=status]').textContent);i++)await new Promise(r=>setTimeout(r,10));
 const message=root.querySelector('[role=status]').textContent;
 dom.window.close();
 if(fail){assert.match(message,/did not finish/);assert.ok(aborted);assert.equal(blob,undefined);return;}
 assert.match(message,/Backup complete/);
 const reader=new zip.ZipReader(new zip.BlobReader(blob));const entries=await reader.getEntries();
 assert.ok(entries.every(e=>e.encrypted));
 assert.equal(entries.length,5);const record=entries.find(e=>e.filename==='platinum/archived/record.json');
 await assert.rejects(record.getData(new zip.TextWriter(),{password:'wrong',useWebWorkers:false}));
 const saved=JSON.parse(await record.getData(new zip.TextWriter(),{password:pass,useWebWorkers:false}));
 assert.equal(saved.client.status,'deceased');assert.equal(saved.related.shared_messages[0].body,'sample text');
 assert.equal(await entries.find(e=>e.filename.endsWith('/doc.pdf')).getData(new zip.TextWriter(),{password:pass,useWebWorkers:false}),'sample document');await reader.close();
}
test('both agency records and file bytes round trip through the encrypted backup',()=>simulate(false));
test('a missing document aborts the output',()=>simulate(true));
