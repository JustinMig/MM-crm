'use client'

import {useState} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'

type Props = {
 kind:'call'|'voicemail'
 id:string
 clientId:string|null
 phone:string
 label:string
 initialNote:string|null
 recordingId?:string|null
}
export default function OfficeRingCentralActions({kind,id,clientId,phone,label,initialNote,recordingId}:Props){
 const router=useRouter()
 const [note,setNote]=useState(initialNote||'')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const params=new URLSearchParams({from_call:'1',call_kind:kind,call_phone:phone,call_label:label.slice(0,60)})
 if(clientId)params.set('call_client',clientId)
 const appointmentUrl='/calendar?'+params.toString()
 async function saveNote(){
  if(busy)return
  setBusy(true);setMessage('Saving note…')
  try{
   const response=await fetch('/api/ringcentral/review-note',{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({kind,id,note})
   })
   const result=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(result.error||'Unable to save note.')
   setMessage('Note saved to this call.')
   router.refresh()
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save note.')}
  finally{setBusy(false)}
 }
 async function remove(){
  if(busy)return
  if(!window.confirm('Delete this '+(kind==='voicemail'?'voicemail':'call')+
   ' from the Office CRM? It will NOT come back during future RingCentral syncs. The original RingCentral record remains untouched.'))return
  setBusy(true);setMessage('Deleting from Office CRM…')
  try{
   const url=kind==='voicemail'?'/api/ringcentral/voicemails/':'/api/ringcentral/calls/'
   const response=await fetch(url+encodeURIComponent(id),{method:'DELETE'})
   const result=await response.json().catch(()=>({}))
   if(!response.ok)throw new Error(result.error||'Delete failed.')
   setMessage('Deleted from Office CRM.')
   router.refresh()
  }catch(error){setMessage(error instanceof Error?error.message:'Could not delete this record.')}
  finally{setBusy(false)}
 }
 return <div className="office-ring-actions">
   <div className="office-ring-action-buttons">
     <Link className="btn btn-secondary" href={appointmentUrl}>+ Appointment</Link>
     <button className="btn btn-secondary office-ring-delete" type="button" onClick={()=>void remove()} disabled={busy}>
       Delete
     </button>
   </div>
   {kind==='call'&&recordingId?(
     <audio aria-label="RingCentral call recording" controls preload="none" src={'/api/ringcentral/recordings/'+encodeURIComponent(recordingId)}>
       Your browser does not support audio playback.
     </audio>
   ):null}
   {kind==='voicemail'?(
     <audio aria-label="RingCentral voicemail" controls preload="none" src={'/api/ringcentral/voicemails/'+encodeURIComponent(id)}>
       Your browser does not support audio playback.
     </audio>
   ):null}
   <details className="office-ring-note">
     <summary>Notes{initialNote?' • Saved':''}</summary>
     <div className="office-ring-note-content">
       <label><span>Note on this {kind==='call'?'call':'voicemail'}</span>
         <textarea rows={3} maxLength={4000} value={note} onChange={event=>setNote(event.target.value)}
          placeholder="Optional details about this call or follow-up" /></label>
       <button className="btn btn-secondary" type="button" onClick={()=>void saveNote()} disabled={busy}>Save Note</button>
     </div>
   </details>
   {message?<p className="office-ring-feedback" role="status">{message}</p>:null}
 </div>
}
