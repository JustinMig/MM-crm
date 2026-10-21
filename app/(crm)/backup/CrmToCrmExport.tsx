'use client'
import { useState } from 'react'
type FileEntry = { document_id: string; client_id: string; file_name: string; archive_path: string }
type Snapshot = { manifest: Record<string, any>; tables: Record<string, Record<string, any>[]>; files: FileEntry[] }
const encoder = new TextEncoder()
function put(header: Uint8Array, str: string, start: number, size: number) {
  const bytes = encoder.encode(str)
  if (bytes.length > size) throw new Error('Archive entry name exceeds limit: ' + str)
  header.set(bytes, start)
}
function oct(header: Uint8Array, value: number, offset: number, len: number) {
  put(header, Math.floor(value).toString(8).padStart(len-1,'0').slice(-(len-1))+'\0',offset,len)
}
function heading(name: string, size: number) {
  const h = new Uint8Array(512)
  put(h,name,0,100); oct(h,0o600,100,8); oct(h,0,108,8); oct(h,0,116,8)
  oct(h,size,124,12); oct(h,Math.floor(Date.now()/1000),136,12)
  h.fill(32,148,156); h[156]=48; put(h,'ustar\0',257,6);put(h,'00',263,2)
  const sum=h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')
  put(h,sum+'\0 ',148,8)
  return h
}
async function entry(writer: any, name: string, data: Uint8Array) {
  await writer.write(heading(name,data.byteLength))
  if(data.byteLength)await writer.write(data)
  const remainder=data.byteLength%512
  if(remainder)await writer.write(new Uint8Array(512-remainder))
}
function csv(rows: Record<string,any>[]) {
  const fields=Array.from(new Set(rows.flatMap(r=>Object.keys(r))))
  const escape=(v:any)=>'"'+String(v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):v).replace(/"/g,'""')+'"'
  return [fields.map(escape).join(','),...rows.map(r=>fields.map(k=>escape(r[k])).join(','))].join('\r\n')
}
export default function CrmToCrmExport() {
  const [working,setWorking]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  async function start() {
    if(working)return
    setError('');setMessage('')
    const win=window as Window & {showSaveFilePicker?:(opts:any)=>Promise<any>}
    if(!win.showSaveFilePicker){setError('Use Google Chrome or Microsoft Edge on a desktop computer to save this large archive directly to your hard drive.');return}
    let writer:any
    try{
      // File chooser opens before reading any protected client data.
      const handle=await win.showSaveFilePicker({
        suggestedName:'MM-CRM-to-CRM-Isaiah-'+new Date().toISOString().slice(0,10)+'.tar',
        types:[{description:'CRM migration archive',accept:{'application/x-tar':['.tar']}}]
      })
      writer=await handle.createWritable()
      setWorking(true);setMessage('Collecting Isaiah client records and checking sensitive field decryption…')
      const response=await fetch('/api/admin/crm-to-crm/start',{method:'POST',cache:'no-store'})
      const data=await response.json() as Snapshot & {error?:string}
      if(!response.ok)throw new Error(data.error||'Unable to create client snapshot')
      if(data.manifest.errors?.length)throw new Error('Export stopped: '+data.manifest.errors.length+' protected fields could not be decrypted. No incomplete archive will be saved.')
      await entry(writer,'manifest.json',encoder.encode(JSON.stringify(data.manifest,null,2)))
      await entry(writer,'Database/clients-complete.json',encoder.encode(JSON.stringify(data.tables)))
      await entry(writer,'Database/clients.csv',encoder.encode(csv(data.tables.clients||[])))
      let count=0
      for(const f of data.files){
        setMessage('Downloading client document '+(count+1)+' of '+data.files.length)
        const res=await fetch('/api/admin/crm-to-crm/file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:f.document_id}),cache:'no-store'})
        if(!res.ok)throw new Error('Could not download document '+f.document_id+' ('+res.status+'). Archive was canceled.')
        const bytes=new Uint8Array(await res.arrayBuffer())
        const filename=String(f.file_name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-26)
        const archivePath='Documents/'+f.client_id+'/'+f.document_id.slice(0,8)+'-'+filename
        await entry(writer,archivePath,bytes)
        count++
      }
      const summary={...data.manifest,verification:'COMPLETE',downloaded_documents:count,finished_at:new Date().toISOString()}
      await entry(writer,'verification.json',encoder.encode(JSON.stringify(summary,null,2)))
      await writer.write(new Uint8Array(1024))
      await writer.close();writer=null
      setMessage('COMPLETE — '+data.manifest.client_count+' clients, '+count+' documents. Backup saved to your selected drive.')
    }catch(e){
      if(writer)try{await writer.abort()}catch{}
      setError(e instanceof Error?e.message:'Export failed')
      setMessage('')
    }finally{setWorking(false)}
  }
  return <section className="card card-pad" style={{marginBottom:18}}>
    <h2>CRM to CRM — Isaiah Hernandez</h2>
    <p className="subtle">Export Isaiah’s clients, related records and actual uploaded documents into a portable TAR archive with JSON and CSV for future CRM imports. Files download directly to the drive you choose.</p>
    <p className="subtle"><strong>Confidential information:</strong> The extracted backup contains readable SSNs, Medicare identifiers and banking details. Store it on an encrypted, access-controlled drive. Login/recovery secrets and payment card numbers are excluded. The archive itself is not password-encrypted.</p>
    <button className="btn btn-primary" type="button" onClick={start} disabled={working}>{working?'Exporting…':'Download Isaiah Clients — CRM to CRM'}</button>
    {message?<p role="status" style={{marginTop:12}}>{message}</p>:null}
    {error?<p role="alert" style={{marginTop:12,color:'#b91c1c'}}>{error}</p>:null}
  </section>
}
