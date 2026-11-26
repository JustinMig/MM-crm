(function(){
 'use strict';
 const labels={arctos:'Arctos',platinum:'Platinum Financial'};
 let running=false,progress='',view=null,stop=false;
 function status(message){progress=message;if(view?.isConnected)view.querySelector('[role=status]').textContent=message;}
 function check(){if(stop)throw Error('Backup canceled.');}
 function safeExt(name){return String(name||'').match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase()||'';}
 async function destination(name){
  if(window.showSaveFilePicker){
   const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Encrypted ZIP backup',accept:{'application/zip':['.zip']}}]});
   return {stream:await handle.createWritable(),done:async()=>{},cleanup:async()=>{}};
  }
  if(!navigator.storage?.getDirectory)throw Error('Open Office CRM in desktop Chrome or Edge to save this large backup directly to disk.');
  const root=await navigator.storage.getDirectory(),temp=crypto.randomUUID()+'.zip';
  const handle=await root.getFileHandle(temp,{create:true});
  const cleanup=()=>root.removeEntry(temp);
  return {stream:await handle.createWritable(),cleanup,done:async()=>{
   const url=URL.createObjectURL(await handle.getFile()),a=document.createElement('a');
   a.download=name;a.href=url;a.click();setTimeout(()=>{URL.revokeObjectURL(url);cleanup().catch(()=>{});},60000);
  }};
 }
 // Folder writes close one file at a time, so large archives do not accumulate in memory.
 async function folderDestination(name){
  const parent=await window.showDirectoryPicker({mode:'readwrite'});
  const root=await parent.getDirectoryHandle(name,{create:true});
  async function write(path,value){
   const parts=path.split('/'),file=parts.pop();let dir=root;
   for(const part of parts)dir=await dir.getDirectoryHandle(part,{create:true});
   const handle=await dir.getFileHandle(file,{create:true}),stream=await handle.createWritable();
   try{if(typeof value==='string'){const writer=stream.getWriter();try{await writer.write(value);await writer.close();}finally{writer.releaseLock();}}else await value.pipeTo(stream);}
   catch(error){try{await stream.abort();}catch{}throw error;}
  }
  await write('INCOMPLETE.txt','The backup is still running or was interrupted. Only use it as a complete backup once this marker is removed.');
  return {write,finish:()=>root.removeEntry('INCOMPLETE.txt')};
 }
 function csv(rows){
  const cell=value=>{
   let text=String(value??'');
   if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
   return '"'+text.replace(/"/g,'""')+'"';
  };
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
 }
 function fields(value,path='',output=[]){
  if(value!==null&&typeof value==='object'&&Object.keys(value).length){
   for(const [key,entry] of Object.entries(value))fields(entry,path?path+'.'+key:key,output);
  }else output.push([path,value===null?'':typeof value==='object'?JSON.stringify(value):value]);
  return output;
 }
 const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function page(title,content){
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+escapeHtml(title)+'</title><style>body{font:16px system-ui,sans-serif;max-width:68rem;margin:2rem auto;padding:0 1rem;color:#172838}a{color:#075a87}table{border-collapse:collapse;width:100%}td,th{text-align:left;vertical-align:top;padding:.45rem;border-bottom:1px solid #ddd;overflow-wrap:anywhere;white-space:pre-wrap}summary{cursor:pointer;font-weight:bold;padding:.6rem 0}details{margin:.6rem 0}</style><h1>'+escapeHtml(title)+'</h1>'+content+'</html>';
 }
 function details(record,files){
  const name=[record.client.first_name,record.client.last_name].filter(Boolean).join(' ')||'Client';
  const groups=[['Client',record.client],['Protected fields',record.protected],...Object.entries(record.related)];
  const rows=[['Section','Field','Value']];
  const sections=groups.map(([group,value],i)=>{
   const values=fields(value);
   for(const [field,v] of values)rows.push([group,field,v]);
   return '<details'+(i===0?' open':'')+'><summary>'+escapeHtml(group.replace(/_/g,' '))+'</summary><table>'+values.map(([k,v])=>'<tr><th>'+escapeHtml(k)+'</th><td>'+escapeHtml(v)+'</td></tr>').join('')+'</table></details>';
  });
  for(const f of files)rows.push(['Files',f.name||f.id,f.local]);
  const links=files.map(f=>'<li><a href="'+escapeHtml(f.local)+'">'+escapeHtml(f.name||f.id)+'</a></li>').join('');
  return {csv:csv(rows),html:page(name,'<a href="../../Open-Backup.html">All clients</a> · <a href="Details.csv">Open details CSV</a><h2>Files</h2>'+(links?'<ul>'+links+'</ul>':'<p>No saved files.</p>')+sections.join(''))};
 }
 function directory(manifest){
  const records=manifest.clients.slice().sort((a,b)=>String(a.lastName).localeCompare(String(b.lastName))||String(a.firstName).localeCompare(String(b.firstName)));
  const keys=[...new Set(records.flatMap(c=>Object.keys(c.overview)))];
  const rows=[['Agency','First name','Last name','Status','Offline record',...keys]];
  const links=records.map(c=>{
   rows.push([labels[c.agency],c.firstName,c.lastName,c.status,c.page,...keys.map(k=>c.overview[k])]);
   return '<tr><td><a href="'+escapeHtml(c.page)+'">'+escapeHtml([c.lastName,c.firstName].filter(Boolean).join(', ')||c.id)+'</a></td><td>'+escapeHtml(labels[c.agency])+'</td><td>'+escapeHtml(c.status)+'</td></tr>';
  });
  return {csv:csv(rows),html:page('Office client backup','<p>'+records.length+' clients · <a href="Clients.csv">Open clients CSV</a></p><p>Choose a name to open the record and its files. Use Ctrl+F or Command+F to find a client.</p><table><tr><th>Client</th><th>Agency</th><th>Status</th></tr>'+links.join('')+'</table>')};
 }
 function controls(){
  if(!view?.isConnected)return;
  for(const el of view.querySelectorAll('input,select,[type=submit]'))el.disabled=running;
  view.querySelector('[data-cancel]').hidden=!running;
 }
 async function run(form,ctx){
  if(running)return;
  const password=form.elements.password.value;
  const folder=form.elements.format.value==='folder';
  if(!folder&&password!==form.elements.confirmation.value){status('The passwords must match.');return;}
  const selected=form.elements.scope.value,scopes=selected==='both'?Object.keys(labels):[selected];
  if(scopes.some(s=>!ctx.allowed(s))){status('Full Office access is required for each selected agency.');return;}
  running=true;stop=false;controls();let dest,finalized=false;
  const started=new Date(),name='Office-CRM-'+selected+'-'+started.toISOString().replace(/[:.]/g,'-')+'.zip';
  const onLeave=e=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',onLeave);
  try{
   dest=folder?await folderDestination(name.slice(0,-4)):await destination(name);
   const archive=folder?null:new zip.ZipWriter(dest.stream,{password,encryptionStrength:3,level:0,useWebWorkers:false});
   const manifest={format:1,started:started.toISOString(),agencies:{},clients:[],files:[]};
   const addText=(path,value)=>folder?dest.write(path,value):archive.add(path,new zip.TextReader(value));
   const addJson=(path,value)=>addText(path,JSON.stringify(value,null,2));
   for(const scope of scopes){
    check();status('Checking '+labels[scope]+' client directory…');
    const {clients}=await ctx.request(scope,'backup_index');
    const counts=manifest.agencies[scope]={clients:0,documents:0,messageFiles:0};
    for(let i=0;i<clients.length;i+=5){
     check();const ids=clients.slice(i,i+5).map(c=>c.id);
     status(labels[scope]+' · '+counts.clients+' of '+clients.length+' clients saved · '+counts.documents+' documents');
     const payload=await ctx.request(scope,'backup_clients',{ids});
     const comm=await ctx.sms({command:'backup_messages',agency:scope,ids});
     const files=[...payload.files.map(f=>({...f,category:'documents'})),...comm.files.map(f=>({...f,category:'messageFiles'}))];
     for(const f of files)f.local=f.category+'/'+f.id+safeExt(f.name);
     for(const record of payload.records){
      check();const key=scope+'/'+record.client.id;
      record.related.shared_messages=comm.byClient[record.client.id]||[];
      await addJson(key+'/record.json',record);
      const rendered=details(record,files.filter(f=>f.client_id===record.client.id));
      await addText(key+'/Details.csv',rendered.csv);
      await addText(key+'/Client.html',rendered.html);
      manifest.clients.push({page:key+'/Client.html',overview:Object.fromEntries(fields(record.client)),agency:scope,id:record.client.id,firstName:record.client.first_name,lastName:record.client.last_name,status:record.client.status,record:key+'/record.json'});
      counts.clients++;
     }
     for(const [category,files] of [['documents',payload.files],['messageFiles',comm.files]]){
      for(const f of files){
       check();const response=await fetch(f.url,{cache:'no-store',credentials:'omit'});
       if(!response.ok||!response.body)throw Error('Could not download a saved file. Please retry the backup.');
       const path=scope+'/'+f.client_id+'/'+category+'/'+f.id+safeExt(f.name);
       if(folder)await dest.write(path,response.body);else await archive.add(path,response.body);
       counts[category]++;manifest.files.push({path,originalName:f.name});
      }
     }
    }
    const after=await ctx.request(scope,'backup_index');
    if(JSON.stringify(clients)!==JSON.stringify(after.clients)){
     (manifest.changesDuringExport??=[]).push(labels[scope]);
    }
   }
   check();manifest.finished=new Date().toISOString();
   const index=directory(manifest);
   await addText('Clients.csv',index.csv);
   await addText('Open-Backup.html',index.html);
   await addJson('manifest.json',manifest);
   if(folder)await dest.finish();else{await archive.close();await dest.done();}
   finalized=true;
   const total=Object.values(manifest.agencies).reduce((n,a)=>n+a.clients,0);
   const changes=manifest.changesDuringExport?' Records changed during export in '+manifest.changesDuringExport.join(', ')+'. Run a fresh backup for the latest changes.':'';
   form.elements.password.value=form.elements.confirmation.value='';status('Backup complete. '+total+' clients and '+manifest.files.length+' files saved. '+(folder?'Open Open-Backup.html or Clients.csv in the new folder.':'Extract '+name+' and open Open-Backup.html or Clients.csv.')+changes);
  }catch(error){
   if(dest&&!folder&&!finalized){try{await dest.stream.abort();}catch{}try{await dest.cleanup();}catch{}}
   status(error.name==='AbortError'?'Backup canceled.':'Backup did not finish. '+(error.message||'Try again.'));
  }finally{window.removeEventListener('beforeunload',onLeave);running=false;controls();}
 }
 window.officeBackup={mount(host,ctx){
  view=host;host.innerHTML='<form class="panel"><h2>Download client backup</h2><p>Save Excel-readable CSVs, offline client pages and the original documents. Keep this tab open until the backup finishes.</p><label>Agency <select name="scope"><option value="both">Both agencies</option><option value="arctos">Arctos</option><option value="platinum">Platinum Financial</option></select></label><p><label>Save as <select name="format"><option value="folder">Folder on my drive</option><option value="zip">Password-protected ZIP</option></select></label></p><p data-folder-info>The folder contains readable personal information. Choose a private drive. Open Open-Backup.html inside the finished folder to find a client and their files.</p><div data-password><p><label>Backup password <input type="password" name="password" minlength="12" required autocomplete="new-password"></label> <label>Confirm password <input type="password" name="confirmation" required autocomplete="new-password"></label></p><p>Use at least 12 characters. Keep the password to open the ZIP in 7-Zip or another AES-compatible archive app.</p></div><button type="submit" class="primary">Download backup</button> <button type="button" data-cancel hidden>Cancel backup</button><p role="status" aria-live="polite"></p></form>';
  const form=host.querySelector('form');
  const format=form.elements.format;
  if(!window.showDirectoryPicker){format.querySelector('[value=folder]').disabled=true;format.value='zip';}
  function formatChanged(){const encrypted=format.value==='zip';host.querySelector('[data-password]').hidden=!encrypted;host.querySelector('[data-folder-info]').hidden=encrypted;form.elements.password.required=form.elements.confirmation.required=encrypted;if(!encrypted){form.elements.password.value='';form.elements.confirmation.value='';}}
  format.onchange=formatChanged;formatChanged();
  form.onsubmit=e=>{e.preventDefault();void run(form,ctx);};
  host.querySelector('[data-cancel]').onclick=()=>{stop=true;status('Canceling backup…');};
  status(progress);controls();
 }};
})();
