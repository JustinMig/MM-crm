(function(){
 'use strict';
 const labels={arctos:'Arctos',platinum:'Platinum Financial'};
 let running=false,progress='',view=null,stop=false;
 function status(message){progress=message;if(view?.isConnected)view.querySelector('[role=status]').textContent=message;}
 function check(){if(stop)throw Error('Backup canceled.');}
 function safeExt(name){return String(name||'').match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase()||'';}
 function clientFolder(client,used){
  const parts=[client.last_name,client.first_name].map(n=>String(n||'').trim()).filter(Boolean);
  let base=Array.from(parts.join(', ').normalize('NFC').replace(/[<>:"/\\|?*#%\x00-\x1f]/g,'-')).slice(0,72).join('').trim().replace(/[ .]+$/,'')||'Unnamed client';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base))base='_'+base;
  let name=base,number=1;
  while(used.has(name.toLowerCase()))name=base+' ('+(++number)+')';
  used.add(name.toLowerCase());
  return name;
 }
 function staleHandle(error){
  return ['InvalidStateError','NoModificationAllowedError','NotReadableError'].includes(error?.name)||/state.*changed since|state cached in an interface object/i.test(error?.message||'');
 }
 let resumeWrite=null;
 async function retryWrite(action){
  for(let attempt=0;;attempt++){
   check();
   try{return await action();}
   catch(error){
    if(!staleHandle(error))throw error;
    if(attempt>=3){
     status('Backup paused. Reconnect the original drive or pause folder syncing, then choose Retry writing.');
     await new Promise(resolve=>{resumeWrite=resolve;controls();});
     resumeWrite=null;controls();check();attempt=-1;
     status('Retrying the current file…');
     continue;
    }
    await new Promise(resolve=>window.setTimeout(resolve,200*(attempt+1)));
   }
  }
 }
 let finishedZip=null;
 function downloadButton(){
  if(!view?.isConnected)return;
  view.querySelector('[data-download-zip]').hidden=!finishedZip;
 }
 async function downloadZip(){
  const saved=finishedZip;if(!saved)return;
  // Read a new snapshot on each download, after the ZIP writer has closed.
  const handle=await saved.root.getFileHandle(saved.temp);
  const url=URL.createObjectURL(await handle.getFile()),a=document.createElement('a');
  a.href=url;a.download=saved.name;document.body.appendChild(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),3600000);
 }
 async function destination(name){
  const storage=window.navigator.storage;
  if(!storage?.getDirectory)throw Error('Open Office CRM in desktop Chrome or Edge to download this large backup.');
  const root=await (await storage.getDirectory()).getDirectoryHandle('office-backup-downloads',{create:true});
  const now=Date.now();
  // Remove abandoned encrypted staging files on a later visit.
  for await(const [entry] of root.entries()){
   const stamp=/^(\d+)-[a-f0-9-]+\.zip$/.exec(entry);
   if(stamp&&now-Number(stamp[1])>86400000)await root.removeEntry(entry).catch(()=>{});
  }
  const temp=now+'-'+window.crypto.randomUUID()+'.zip';
  const handle=await root.getFileHandle(temp,{create:true});
  return {stream:await handle.createWritable(),cleanup:()=>root.removeEntry(temp),done:async()=>{
   finishedZip={root,temp,name};downloadButton();
   try{await downloadZip();}catch{/* The completed ZIP is still available for manual download. */}
  }};
 }
 async function folderDestination(name){
  const parent=await window.showDirectoryPicker({mode:'readwrite'});
  await parent.getDirectoryHandle(name,{create:true});
  const openRoot=()=>parent.getDirectoryHandle(name);
  async function write(path,value){
   await retryWrite(async()=>{
    const parts=path.split('/'),file=parts.pop();let dir=await openRoot();
    for(const part of parts)dir=await dir.getDirectoryHandle(part,{create:true});
    const handle=await dir.getFileHandle(file,{create:true});
    const stream=await handle.createWritable(),writer=stream.getWriter();
    try{await writer.write(value);await writer.close();}
    catch(error){try{await writer.abort();}catch{}throw error;}
    finally{writer.releaseLock();}
   });
  }
  await write('INCOMPLETE.txt','The backup is still running or was interrupted. Only use it as a complete backup once this marker is removed.');
  return {write,finish:()=>retryWrite(async()=>{
   const root=await openRoot();
   try{await root.removeEntry('INCOMPLETE.txt');}catch(error){if(error.name!=='NotFoundError')throw error;}
  })};
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
  view.querySelector('[data-retry-write]').hidden=!resumeWrite;
 }
 async function run(form,ctx){
  if(running)return;
  const password=form.elements.password.value;
  const folder=form.elements.format.value==='folder';
  if(!folder&&password!==form.elements.confirmation.value){status('The passwords must match.');return;}
  const selected=form.elements.scope.value,scopes=selected==='both'?Object.keys(labels):[selected];
  if(scopes.some(s=>!ctx.allowed(s))){status('Full Office access is required for each selected agency.');return;}
  finishedZip=null;downloadButton();running=true;stop=false;controls();let dest,finalized=false;
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
    const usedFolders=new Set();
    const counts=manifest.agencies[scope]={clients:0,documents:0,messageFiles:0};
    for(let i=0;i<clients.length;i+=5){
     check();const ids=clients.slice(i,i+5).map(c=>c.id);
     status(labels[scope]+' · '+counts.clients+' of '+clients.length+' clients saved · '+counts.documents+' documents');
     const payload=await ctx.request(scope,'backup_clients',{ids});
     const comm=await ctx.sms({command:'backup_messages',agency:scope,ids});
     const files=[...payload.files.map(f=>({...f,category:'documents'})),...comm.files.map(f=>({...f,category:'messageFiles'}))];
     for(const f of files)f.local=f.category+'/'+f.id+safeExt(f.name);
     const clientPaths=new Map();
     for(const record of payload.records){
      check();const key=scope+'/'+clientFolder(record.client,usedFolders);
      clientPaths.set(record.client.id,key);
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
       const key=clientPaths.get(f.client_id);
       if(!key)throw Error('A document could not be matched to its client folder.');
       const path=key+'/'+category+'/'+f.id+safeExt(f.name);
       if(folder)await dest.write(path,new Uint8Array(await response.arrayBuffer()));else await archive.add(path,response.body);
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
   form.elements.password.value=form.elements.confirmation.value='';status('Backup complete. '+total+' clients and '+manifest.files.length+' files saved. '+(folder?'Open Open-Backup.html or Clients.csv in the new folder.':'Use Download finished ZIP if your browser did not start the download. Extract the ZIP and open Open-Backup.html or Clients.csv.')+changes);
  }catch(error){
   if(dest&&!folder&&!finalized){try{await dest.stream.abort();}catch{}try{await dest.cleanup();}catch{}}
   if(staleHandle(error)){status('The drive changed while Office was writing. The backup is incomplete. Choose Password-protected ZIP to download through your browser.');return;}
   status(error.name==='AbortError'?'Backup canceled.':'Backup did not finish. '+(error.message||'Try again.'));
  }finally{window.removeEventListener('beforeunload',onLeave);running=false;controls();}
 }
 window.officeBackup={mount(host,ctx){
  view=host;host.innerHTML='<form class="panel"><h2>Download client backup</h2><p>Save Excel-readable CSVs, offline client pages and the original documents. Keep this tab open until the backup finishes.</p><label>Agency <select name="scope"><option value="both">Both agencies</option><option value="arctos">Arctos</option><option value="platinum">Platinum Financial</option></select></label><p><label>Save as <select name="format"><option value="folder">Folder on my drive</option><option value="zip">Password-protected ZIP</option></select></label></p><p data-folder-info>The folder contains readable personal information. Choose a private drive. Open Open-Backup.html inside the finished folder to find a client and their files.</p><div data-password><p><label>Backup password <input type="password" name="password" minlength="12" required autocomplete="new-password"></label> <label>Confirm password <input type="password" name="confirmation" required autocomplete="new-password"></label></p><p>Use at least 12 characters. Client folder names are visible in the ZIP file listing. Keep the password to open the ZIP in 7-Zip or another AES-compatible archive app.</p></div><button type="submit" class="primary">Download backup</button> <button type="button" data-cancel hidden>Cancel backup</button> <button type="button" data-retry-write hidden>Retry writing</button> <button type="button" data-download-zip hidden>Download finished ZIP</button><p role="status" aria-live="polite"></p></form>';
  downloadButton();
  host.querySelector('[data-download-zip]').onclick=()=>downloadZip().catch(()=>status('The browser could not download the finished ZIP. Try the download button again.'));
  const form=host.querySelector('form');
  const format=form.elements.format;
  if(!window.showDirectoryPicker){format.querySelector('[value=folder]').disabled=true;format.value='zip';}
  function formatChanged(){const encrypted=format.value==='zip';host.querySelector('[data-password]').hidden=!encrypted;host.querySelector('[data-folder-info]').hidden=encrypted;form.elements.password.required=form.elements.confirmation.required=encrypted;if(!encrypted){form.elements.password.value='';form.elements.confirmation.value='';}}
  format.onchange=formatChanged;formatChanged();
  form.onsubmit=e=>{e.preventDefault();void run(form,ctx);};
  host.querySelector('[data-retry-write]').onclick=()=>resumeWrite?.();
  host.querySelector('[data-cancel]').onclick=()=>{stop=true;resumeWrite?.();status('Canceling backup…');};
  status(progress);controls();
 }};
})();
