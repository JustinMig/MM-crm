'use client'
import { useState } from 'react'
export default function ExportPage(){
 const [password,setPassword]=useState(''),[progress,setProgress]=useState('Ready'),[running,setRunning]=useState(false)
 async function run(){
  setRunning(true);const batches:any[]=[];let offset=0,total=0,failures=0
  try{
   while(offset<2000){
    setProgress('Exporting clients '+(offset+1)+' onward…')
    const res=await fetch('/api/migration/isaiah-export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset,passphrase:password})})
    const data=await res.json()
    if(!res.ok) throw Error(data.error+(data.detail?' — '+data.detail:''))
    batches.push(data.package);total+=data.client_count;failures+=data.manifest?.failures||0
    if(data.done) break
    offset+=5
   }
   const file={format:'platinum-encrypted-isaiah-import-v1',created_at:new Date().toISOString(),source:'mm_crm',source_agent:'Isaiah Hernandez',client_count:total,encrypted_batches:batches}
   const url=URL.createObjectURL(new Blob([JSON.stringify(file)],{type:'application/octet-stream'}))
   const anchor=document.createElement('a');anchor.href=url;anchor.download='Isaiah_MandM_Full_Encrypted_Export.json';anchor.click()
   setTimeout(()=>URL.revokeObjectURL(url),120000)
   setProgress('Downloaded encrypted export: '+total+' clients. Document exceptions: '+failures+'. Keep your password safely; it cannot be recovered.')
  }catch(e){setProgress('Stopped at '+offset+' clients: '+String((e as Error).message))}
  finally{setRunning(false)}
 }
 return <main style={{maxWidth:750,margin:'4rem auto',padding:26,fontFamily:'Arial,sans-serif'}}><h1>Isaiah — Complete Client Export</h1><p>Copies only Isaiah Hernandez’s client data and uploaded files. No M&amp;M records are changed or deleted. Sensitive values are encrypted into a password-protected export.</p><p>Choose a strong password (at least 16 characters). You will need this same password to import into Platinum. Do not share it in chat.</p><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Backup encryption password" style={{width:'100%',padding:12}}/><p><button type="button" disabled={running||password.length<16} onClick={run} style={{padding:14}}>{running?'Export in progress…':'Download encrypted Isaiah backup'}</button></p><p role="status">{progress}</p><p>Note: file attachments larger than 8 MB or failed downloads require a separate retry. The export reports these exceptions; do not treat a backup with exceptions as a complete transfer.</p></main>
}