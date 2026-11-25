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
 function controls(){
  if(!view?.isConnected)return;
  for(const el of view.querySelectorAll('input,select,[type=submit]'))el.disabled=running;
  view.querySelector('[data-cancel]').hidden=!running;
 }
 async function run(form,ctx){
  if(running)return;
  const password=form.elements.password.value;
  if(password!==form.elements.confirmation.value){status('The passwords must match.');return;}
  const selected=form.elements.scope.value,scopes=selected==='both'?Object.keys(labels):[selected];
  if(scopes.some(s=>!ctx.allowed(s))){status('Full Office access is required for each selected agency.');return;}
  running=true;stop=false;controls();let dest,finalized=false;
  const started=new Date(),name='Office-CRM-'+selected+'-'+started.toISOString().replace(/[:.]/g,'-')+'.zip';
  const onLeave=e=>{e.preventDefault();e.returnValue='';};
  window.addEventListener('beforeunload',onLeave);
  try{
   dest=await destination(name);
   const archive=new zip.ZipWriter(dest.stream,{password,encryptionStrength:3,level:0,useWebWorkers:false});
   const manifest={format:1,started:started.toISOString(),agencies:{},clients:[],files:[]};
   const addJson=(path,value)=>archive.add(path,new zip.TextReader(JSON.stringify(value,null,2)));
   for(const scope of scopes){
    check();status('Checking '+labels[scope]+' client directory…');
    const {clients}=await ctx.request(scope,'backup_index');
    const counts=manifest.agencies[scope]={clients:0,documents:0,messageFiles:0};
    for(let i=0;i<clients.length;i+=5){
     check();const ids=clients.slice(i,i+5).map(c=>c.id);
     status(labels[scope]+' · '+counts.clients+' of '+clients.length+' clients saved · '+counts.documents+' documents');
     const payload=await ctx.request(scope,'backup_clients',{ids});
     const comm=await ctx.sms({command:'backup_messages',agency:scope,ids});
     for(const record of payload.records){
      check();const key=scope+'/'+record.client.id;
      record.related.shared_messages=comm.byClient[record.client.id]||[];
      await addJson(key+'/record.json',record);
      manifest.clients.push({agency:scope,id:record.client.id,firstName:record.client.first_name,lastName:record.client.last_name,status:record.client.status,record:key+'/record.json'});
      counts.clients++;
     }
     for(const [category,files] of [['documents',payload.files],['messageFiles',comm.files]]){
      for(const f of files){
       check();const response=await fetch(f.url,{cache:'no-store',credentials:'omit'});
       if(!response.ok||!response.body)throw Error('Could not download a saved file. Please retry the backup.');
       const path=scope+'/'+f.client_id+'/'+category+'/'+f.id+safeExt(f.name);
       await archive.add(path,response.body);
       counts[category]++;manifest.files.push({path,originalName:f.name});
      }
     }
    }
    const after=await ctx.request(scope,'backup_index');
    if(JSON.stringify(clients)!==JSON.stringify(after.clients))throw Error('The '+labels[scope]+' client directory changed during the backup. Please try again.');
   }
   check();manifest.finished=new Date().toISOString();
   await addJson('manifest.json',manifest);await archive.close();finalized=true;await dest.done();
   const total=Object.values(manifest.agencies).reduce((n,a)=>n+a.clients,0);
   form.reset();status('Backup complete. '+total+' clients and '+manifest.files.length+' files saved in '+name+'.');
  }catch(error){
   if(dest&&!finalized){try{await dest.stream.abort();}catch{}try{await dest.cleanup();}catch{}}
   status(error.name==='AbortError'?'Backup canceled.':'Backup did not finish. '+(error.message||'Try again.'));
  }finally{window.removeEventListener('beforeunload',onLeave);running=false;controls();}
 }
 window.officeBackup={mount(host,ctx){
  view=host;host.innerHTML='<form class="panel"><h2>Download client backup</h2><p>Save client records, including deceased clients, and their uploaded documents in a password-protected ZIP. Keep the tab open until the download finishes.</p><label>Agency <select name="scope"><option value="both">Both agencies</option><option value="arctos">Arctos</option><option value="platinum">Platinum Financial</option></select></label><p><label>Backup password <input type="password" name="password" minlength="12" required autocomplete="new-password"></label> <label>Confirm password <input type="password" name="confirmation" required autocomplete="new-password"></label></p><p>Use at least 12 characters. Keep the password to open the ZIP in 7-Zip or another AES-compatible archive app.</p><button type="submit" class="primary">Download backup</button> <button type="button" data-cancel hidden>Cancel backup</button><p role="status" aria-live="polite"></p></form>';
  const form=host.querySelector('form');
  form.onsubmit=e=>{e.preventDefault();void run(form,ctx);};
  host.querySelector('[data-cancel]').onclick=()=>{stop=true;status('Canceling backup…');};
  status(progress);controls();
 }};
})();
