/* The source Arctos SOA dialogs use Office's authorized agency bridge. */
(()=>{'use strict';
window.officeArctosCoverageSoaBind=(modal,form)=>{
 const api=window.officeCrmClientBridge,current=api.current();if(!current)return;
 const request=(action,data={})=>api.request(current.agency,action,{client_id:current.id,...data});
 let contextPromise;const context=()=>contextPromise||=(request('coverage_soa_context'));
 const pending=new Map();let agencyContext;
 const result=task=>Promise.resolve().then(task).then(data=>({data,error:null}),error=>({data:null,error}));
 const supabase={
  auth:{getUser:()=>context().then(value=>({data:{user:value.user}}))},
  from(table){
   let insert=null;const q={select(){return q;},eq(){return q;},in(){return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},single(){return q;},insert(value){insert=value;return q;},then(resolve,reject){return result(async()=>{
    if(table==='clients'){agencyContext=await context();return agencyContext.client;}
    if(table==='profiles')return (await context()).agent;
    if(table==='soa_signature_requests'&&insert){await request('coverage_soa_request',{payload:insert});return null;}
    if(table==='documents'&&insert){
     const selected=pending.get(insert.storage_path);if(!selected)throw Error('The signed SOA file was not available.');
     const file=selected.file,data={document_id:selected.id,category:'soa',file_name:file.name,file_size:file.size,mime_type:'image/png',soa:{appointment_date:insert.appointment_date,coverage_year:insert.coverage_year}};
     const start=await request('coverage_upload_start',data);
     if(start.upload_url){
      const url=new URL(start.upload_url),origin=current.agency==='arctos'?'https://bogusfmvdrlvxscopgaw.supabase.co':'https://sggzshbdfgkyyvxbebul.supabase.co';
      if(url.origin!==origin||!url.pathname.startsWith('/storage/v1/object/upload/sign/'))throw Error('The secure signing destination was not recognized.');
      const uploaded=await fetch(url.href,{method:'PUT',headers:{'Content-Type':'image/png','Cache-Control':'3600'},body:file});if(!uploaded.ok)throw Error('The signed SOA could not upload. Keep the signer open and retry.');
     }
     const saved=start.saved?start:await request('coverage_upload_complete',data);if(!saved.saved)throw Error('The signed SOA was not confirmed.');pending.delete(insert.storage_path);return {...saved.document,storage_path:'office-doc:'+saved.document.id};
    }
    if(table==='documents'){const value=await request('coverage_documents');const rows=(value.documents||[]).filter(row=>['soa','scope_of_appointment'].includes(row.category));const row=rows[0];return row?{...row,storage_path:'office-doc:'+row.id}:null;}
    throw Error('This signing operation is not supported.');
   }).then(resolve,reject);}};return q;
  },
  storage:{from:()=>({
   upload:(path,file)=>{pending.set(path,{id:crypto.randomUUID(),file});return Promise.resolve({data:{path},error:null});},
   remove:paths=>{paths.forEach(path=>pending.delete(path));return Promise.resolve({data:[],error:null});},
   createSignedUrl:path=>result(async()=>{if(!String(path).startsWith('office-doc:'))throw Error('Unknown SOA document.');const value=await request('document_url',{document_id:path.slice(11)});return {signedUrl:value.url};})
  })}
 };
 const repository={get profile(){return agencyContext?.agent||null;}};
 const ui=window.officeArctosSoaUi({supabase,repository,signOrigin:current.agency==='arctos'?'https://mh.mayerig.com':'https://office-crm-sand.vercel.app/platinum'});
 const status=form.querySelector('[data-soa-group-status]');
 const opened=new Set();
 const cleanup=new MutationObserver(()=>{if(!modal.isConnected){for(const dialog of opened){dialog.close();dialog.remove();}opened.clear();pending.clear();cleanup.disconnect();}});cleanup.observe(document.body,{childList:true,subtree:true});
 for(const button of form.querySelectorAll('[data-sign-soa],[data-text-soa],[data-view-soa]')){
  button.dataset.soaClientId=current.id;
  button.addEventListener('click',async()=>{
   try{
    if(api.current()?.id!==current.id||api.current()?.agency!==current.agency)throw Error('Reopen this client before signing.');
    if(button.hasAttribute('data-view-soa')){const latest=await ui.latest(current.id);if(!latest)throw Error('No signed SOA is saved.');await ui.open(latest);}
    else {if(!current.permissions?.edit)throw Error('Editing is not authorized');await (button.hasAttribute('data-text-soa')?ui.text(button):ui.sign(button));const dialog=[...document.querySelectorAll('.mh-soa-dialog')].at(-1);if(dialog){opened.add(dialog);if(!modal.isConnected){dialog.close();dialog.remove();}}}
   }catch(error){status.textContent=error.message;status.classList.add('error');}
  });
 }
};
})();
