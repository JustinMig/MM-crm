'use client'
import { useState } from 'react'

export default function ExportPage(){
 const [password,setPassword]=useState(''),[progress,setProgress]=useState('Ready'),[running,setRunning]=useState(false)
 async function run(){
  setRunning(true);let offset=0,total=0,failures=0,writer:FileSystemWritableFileStream|null=null
  try{
   if(!('showSaveFilePicker' in window))throw Error('Use Microsoft Edge or Chrome on a desktop computer for large encrypted backups.')
   // @ts-expect-error modern File System Access API
   const handle=await window.showSaveFilePicker({suggestedName:'Isaiah_MandM_Encrypted_Backup.ndjson',types:[{description:'Encrypted CRM backup',accept:{'application/x-ndjson':['.ndjson']}}]})
   writer=await handle.createWritable()
   await writer!.write(JSON.stringify({format:'platinum-encrypted-isaiah-import-stream-v1',source:'mm_crm',source_agent:'Isaiah Hernandez'})+'\n')
   for(;offset<2000;offset+=5){
    setProgress('Writing encrypted backup to disk: '+total+' clients exported…')
    const res=await fetch('/api/migration/isaiah-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset,passphrase:password}),cache:'no-store'})
    const data=await res.json()
    if(!res.ok)throw Error((data.error||'Server error')+(data.detail?' — '+data.detail:''))
    await writer!.write(JSON.stringify({type:'batch',offset,client_count:data.client_count,manifest:data.manifest,encrypted_batch:data.package})+'\n')
    total+=data.client_count;failures+=data.manifest?.failures||0
    if(data.done)break
   }
   await writer!.write(JSON.stringify({type:'complete',clients:total,file_exceptions:failures})+'\n')
   await writer!.close();writer=null
   setProgress('Export finished: '+total+' clients saved to disk. File exceptions: '+failures+'. Use this .ndjson file with Platinum importer. Do not share your password.')
  }catch(e){
   if(writer){try{await writer.abort()}catch{}}
   setProgress('Export stopped at '+total+' clients: '+String((e as Error).message)+'. Incomplete file should not be imported.')
  }finally{setRunning(false)}
 }
 return <main style={{maxWidth:750,margin:'4rem auto',padding:26,fontFamily:'Arial,sans-serif'}}><h1>Isaiah — Complete Client Export</h1><p>This tool securely copies Isaiah Hernandez’s client records and eligible attachments. It does not change or delete M&amp;M client data.</p><p>On Microsoft Edge or Chrome on your computer, choose where to save the encrypted backup. The export writes directly to disk in small batches to avoid running out of browser memory.</p><label>Backup encryption password (16+ characters)<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',padding:12,width:'100%',boxSizing:'border-box'}} /></label><p><button type="button" disabled={running||password.length<16} onClick={run} style={{padding:14}}>{running?'Exporting…':'Save encrypted Isaiah backup'}</button></p><p role="status">{progress}</p><p>Files larger than 8 MB and failed downloads are reported as exceptions. This transfer must be checked against original source counts before calling it complete.</p></main>
}