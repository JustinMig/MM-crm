'use client'
import {useEffect,useRef,useState} from 'react'
export type SmsPhoto={path:string;url:string}
export default function SmsPhotoAttachment({photo,onChange,disabled,onBusy}:{photo:SmsPhoto|null;onChange:(photo:SmsPhoto|null)=>void;disabled?:boolean;onBusy:(busy:boolean)=>void}){
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const active=useRef(true)
 useEffect(()=>{active.current=true;return()=>{active.current=false}},[])
 async function attach(file?:File){
  if(!file)return
  if(!['image/jpeg','image/png','image/gif'].includes(file.type)||file.size>4*1024*1024){setError('Choose a JPG, PNG or GIF smaller than 4 MB.');return}
  setBusy(true);onBusy(true);setError('')
  try{const form=new FormData();form.set('photo',file);const r=await fetch('/api/sms/media',{method:'POST',body:form});const result=await r.json();if(!r.ok)throw Error(result.error||'Upload failed.');if(active.current)onChange(result)}catch(e){if(active.current)setError(e instanceof Error?e.message:'Unable to attach photo.')}finally{if(active.current){setBusy(false);onBusy(false);}if(input.current)input.current.value=''}
 }
 return <div style={{gridColumn:'1 / -1',display:'grid',gap:8}}>
  <input ref={input} type="file" accept="image/jpeg,image/png,image/gif" hidden onChange={e=>void attach(e.target.files?.[0])}/>
  <div><button type="button" className="btn btn-secondary btn-small" disabled={disabled||busy} onClick={()=>input.current?.click()}>{busy?'Attaching…':photo?'Change Photo':'Attach Photo'}</button>{photo?<button type="button" className="btn btn-secondary btn-small" disabled={disabled||busy} onClick={()=>onChange(null)}>Remove Photo</button>:null}</div>
  {photo?<img src={photo.url} alt="Photo attached to message" style={{maxWidth:240,maxHeight:180,objectFit:'contain',borderRadius:8}}/>:null}
  <small className="subtle">JPG, PNG or GIF · up to 4 MB · Photos send as MMS.</small>{error?<div role="alert">{error}</div>:null}
 </div>
}
export function SmsPhotos({urls}:{urls?:string[]}){return <>{(urls||[]).map(url=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Message photo" style={{display:'block',maxWidth:'100%',maxHeight:260,objectFit:'contain',borderRadius:8,marginTop:6}}/></a>)}</>}
