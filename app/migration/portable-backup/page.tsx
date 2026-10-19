'use client'
import {useState} from 'react'

type DirectoryHandle=FileSystemDirectoryHandle
type Writer=FileSystemWritableFileStream
const MAGIC=new TextEncoder().encode('MIGDOC1')
const b64=(buf:ArrayBuffer|Uint8Array)=>btoa(Array.from(new Uint8Array(buf instanceof ArrayBuffer?buf:buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)),b=>String.fromCharCode(b)).join(''))
async function makeDocumentKey(password:string,salt:Uint8Array){
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey'])
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt as BufferSource,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt'])
}
async function sha(input:Uint8Array){return b64(await crypto.subtle.digest('SHA-256',input as BufferSource))}
async function api(body:unknown){
 const res=await fetch('/api/migration/portable-backup',{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'})
 const data=await res.json().catch(()=>({error:'Non-JSON server response'}))
 if(!res.ok)throw Error(data.error||'Backup server failed')
 return data
}
export default function PortableBackupPage(){
 const [pass,setPass]=useState('')
 const [busy,setBusy]=useState(false)
 const [status,setStatus]=useState('Ready for a complete, encrypted backup.')
 const [report,setReport]=useState('')
 async function run(){
  setBusy(true);setReport('')
  let writer:Writer|null=null
  try{
   if(!('showDirectoryPicker' in window))throw Error('Use Chrome or Edge on a Windows or Mac desktop. Choose a folder on your external drive.')
   if(pass.length<16)throw Error('Choose a strong passphrase of at least 16 characters.')
   // This permission prompt is the only place the app can access local files.
   const picker=window as Window & {showDirectoryPicker:(opts?:unknown)=>Promise<DirectoryHandle>}
   const root=await picker.showDirectoryPicker({mode:'readwrite'})
   const stamp=new Date().toISOString().replace(/[:.]/g,'-')
   const folder=await root.getDirectoryHandle('M-and-M-Encrypted-Clients-'+stamp,{create:true})
   const files=await folder.getDirectoryHandle('documents',{create:true})
   const manifest=await api({action:'manifest'})
   const salt=crypto.getRandomValues(new Uint8Array(16))
   const docKey=await makeDocumentKey(pass,salt)
   const index=await folder.getFileHandle('backup.ndjson',{create:true})
   writer=await index.createWritable()
   const line=async(x:unknown)=>writer!.write(JSON.stringify(x)+'\n')
   await line({format:'mig-portable-v1',type:'header',source:'M&M CRM',
     client_count:manifest.clients,document_count:manifest.documents,
     created_at:manifest.created_at,document_salt:b64(salt),algorithm:'AES-256-GCM/PBKDF2-SHA256/310000'})
   let savedClients=0,savedDocs=0,failures=0
   const seen=new Set<string>()
   for(let offset=0;offset<manifest.clients;offset+=5){
    setStatus('Securing client records: '+Math.min(offset,manifest.clients)+' of '+manifest.clients)
    const batch=await api({action:'batch',offset,client_ids:manifest.client_ids.slice(offset,offset+5),passphrase:pass})
    await line({type:'batch',offset,count:batch.count,encrypted_batch:batch.encrypted_batch})
    savedClients+=batch.count
    if(!batch.count&&offset<manifest.clients)throw Error('Source records changed while backup was being created. Start a new backup.')
    for(const documentId of batch.document_ids||[]){
     if(seen.has(documentId))continue
     seen.add(documentId)
     try{
      setStatus('Saving documents: '+savedDocs+' completed ('+seen.size+' checked). Large backups may contain gigabytes of files.')
      const info=await api({action:'file-url',document_id:documentId})
      const response=await fetch(info.url,{cache:'no-store'})
      if(!response.ok)throw Error('Source storage rejected download')
      const original=new Uint8Array(await response.arrayBuffer())
      const iv=crypto.getRandomValues(new Uint8Array(12))
      const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv as BufferSource,
        additionalData:new TextEncoder().encode(documentId)},docKey,original as BufferSource)
      const bytes=new Uint8Array(MAGIC.length+iv.length+encrypted.byteLength)
      bytes.set(MAGIC);bytes.set(iv,MAGIC.length)
      bytes.set(new Uint8Array(encrypted),MAGIC.length+iv.length)
      const file=await files.getFileHandle(documentId+'.migdoc',{create:true})
      const fw=await file.createWritable();await fw.write(bytes);await fw.close()
      await line({type:'file',id:documentId,bytes:bytes.length,sha256:await sha(bytes)})
      savedDocs++
     }catch(error){
      failures++
      await line({type:'file-error',id:documentId,error:'Could not save this document'})
     }
    }
    if(batch.done&&offset+batch.count<manifest.clients)
      throw Error('Client export ended before the expected source count.')
   }
   const viewer=await fetch('/mig-portable-viewer.html',{cache:'no-store'})
   if(!viewer.ok)throw Error('Offline viewer unavailable; backup cannot be marked complete.')
   const viewerFile=await folder.getFileHandle('Open-Offline-Backup.html',{create:true})
   const vw=await viewerFile.createWritable()
   await vw.write(await viewer.text());await vw.close()
   const complete=savedClients===manifest.clients&&savedDocs===manifest.documents&&failures===0
   await line({type:'complete',clients:savedClients,documents:savedDocs,errors:failures,complete})
   await writer.close();writer=null
   setStatus(complete?'Complete encrypted backup saved on your selected drive.':'Backup saved INCOMPLETE. Do not import as a verified copy.')
   setReport('Source clients '+manifest.clients+'; saved '+savedClients+
     '. Source document records '+manifest.documents+'; saved '+savedDocs+
     '. Missing documents '+failures+'. Folder: M-and-M-Encrypted-Clients-'+stamp)
  }catch(error){
   if(writer){try{await writer.abort()}catch{}}
   setStatus('Backup was not completed: '+String(error instanceof Error?error.message:error))
  }finally{setBusy(false)}
 }
 return <main style={{fontFamily:'system-ui,Arial',maxWidth:860,margin:'32px auto',padding:24}}>
   <h1>M&amp;M — Complete Portable Client Backup</h1>
   <p>Creates a private encrypted folder directly on your selected external hard drive: every authorized agency client record, related record and linked original document. Includes encrypted sensitive identifiers and banking information. Source data is never deleted.</p>
   <p><strong>Requirements:</strong> Chrome or Edge desktop, an external drive with several gigabytes free, and a strong backup passphrase. Keep the passphrase separate from the drive. Do not disconnect the drive during export.</p>
   <label style={{display:'block'}}>Backup passphrase (16+ characters)
    <input value={pass} onChange={e=>setPass(e.target.value)} type="password" autoComplete="new-password"
    style={{display:'block',fontSize:18,width:'100%',padding:12,margin:'8px 0 16px',boxSizing:'border-box'}} />
   </label>
   <button disabled={busy||pass.length<16} onClick={run} style={{padding:'12px 22px',fontSize:16,fontWeight:750}}>{busy?'Export in progress…':'Choose external drive and export all clients'}</button>
   <p role="status">{status}</p><p>{report}</p>
   <p><strong>Offline viewing:</strong> Open the saved <code>Open-Offline-Backup.html</code> file in Chrome or Edge, select the encrypted backup and enter your passphrase. Documents remain encrypted on disk.</p>
   <p>Import into Platinum only after the completion summary reports zero missing clients or files.</p>
 </main>
}
