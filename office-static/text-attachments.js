(function(){
  const endpoint='https://crm.mayerig.com/api/crm-text-attachments';
  const accept='.jpg,.jpeg,.png,.gif,.pdf,.docx,.xlsx,.txt,.csv';
  function picker(host,{scope,headers}){
    const root=document.createElement('div');
    root.className='text-attachment-picker';
    root.innerHTML='<label>Photo or file <input type="file" accept="'+accept+'"></label><span data-file-name></span> <button type="button" class="btn secondary" data-remove-file hidden>Remove attachment</button><small style="display:block">Up to 4 MB. Photos send as MMS. Documents send as a download link that expires after 7 days.</small>';
    host.append(root);
    const input=root.querySelector('input'),name=root.querySelector('[data-file-name]'),remove=root.querySelector('button');
    let file=null,id='',preview='',uploading=null,uploadScope='';
    function clear(){if(preview)URL.revokeObjectURL(preview);preview='';file=null;id='';input.value='';name.textContent='';remove.hidden=true;root.querySelector('img')?.remove();}
    input.onchange=()=>{
      const chosen=input.files[0];clear();
      if(!chosen)return;
      if(chosen.size>4*1024*1024){name.textContent='Choose a file up to 4 MB.';return;}
      file=chosen;name.textContent=chosen.name;remove.hidden=false;
      if(['image/jpeg','image/png','image/gif'].includes(chosen.type)){
        const img=document.createElement('img');preview=URL.createObjectURL(chosen);img.src=preview;img.alt='Selected photo';img.style.cssText='display:block;max-width:160px;max-height:120px;margin:8px 0';root.append(img);
      }
    };
    remove.onclick=clear;
    return {root,hasFile:()=>!!file,clear,disable(value){input.disabled=value;remove.disabled=value;},
      async upload(scopeOverride){
        if(!file)return '';
        const activeScope=scopeOverride||(typeof scope==='function'?scope():scope);
        if(id&&uploadScope===activeScope)return id;
        if(uploading)return uploading;
        const chosen=file;
        uploading=(async()=>{
          const response=await fetch(endpoint,{method:'POST',headers:{...(await headers()),'Content-Type':'application/octet-stream','X-CRM-Scope':activeScope,'X-File-Name':encodeURIComponent(chosen.name)},body:chosen});
          const data=await response.json().catch(()=>({}));
          if(!response.ok)throw Error(data.error||'Attachment upload failed.');
          id=data.id;uploadScope=activeScope;return id;
        })().finally(()=>uploading=null);
        return uploading;
      }
    };
  }
  function history(value){
    if(!value||!/^https:\/\/crm\.mayerig\.com\/f\/[\w-]{24}$/.test(value.url||''))return '';
    const a=document.createElement('a');a.href=value.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=(value.kind==='photo'?'Photo · ':'File · ')+(value.name||'Download attachment');return a.outerHTML;
  }
  window.CrmTextAttachments={picker,history};
})();
