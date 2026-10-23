import Link from 'next/link'
import {getCrmSession} from '@/lib/crm-session'
import {createAdminClient} from '@/lib/supabase/admin'
import {isRingCentralConfigured} from '@/lib/ringcentral'
import CallsSyncButton from '../calls/CallsSyncButton'
import OfficeRingCentralActions from './OfficeRingCentralActions'

type CallRow={
 id:string;client_id:string|null;direction:string;result:string|null;started_at:string
 duration_seconds:number|null;contact_phone:string|null;from_phone:string|null;to_phone:string|null
 recording_id:string|null;staff_note:string|null
}
type VmRow={
 id:string;client_id:string|null;received_at:string;from_phone:string|null
 duration_seconds:number|null;audio_attachment_id:string|null;read_status:string|null;staff_note:string|null
}
type Person={id:string;first_name:string|null;last_name:string|null;phone:string|null}
type Item={id:string;kind:'call'|'voicemail';category:'inbound'|'outbound'|'missed'|'voicemail';
 occurred:string;phone:string;direction:string;result:string;seconds:number;
 client_id:string|null;recording_id:string|null;staff_note:string|null;read_status:string|null
}
const SECTIONS=[
 ['all','All Activity'],['inbound','Inbound Answered'],['outbound','Outbound'],
 ['missed','Missed Calls'],['voicemail','Voicemails']
] as const
type Section=typeof SECTIONS[number][0]
function time(value:string){
 const date=new Date(value)
 return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'
 }).format(date)
}
function dateKey(value:string|Date){
 const parts=new Intl.DateTimeFormat('en-US',{
  timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(value instanceof Date?value:new Date(value))
 const data=Object.fromEntries(parts.map(x=>[x.type,x.value]))
 return data.year+'-'+data.month+'-'+data.day
}
function dateLabel(key:string){
 const date=new Date(key+'T12:00:00Z')
 return new Intl.DateTimeFormat('en-US',{
  timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'
 }).format(date)
}
function phone(value:string){
 const digits=String(value||'').replace(/\D/g,'').slice(-10)
 return digits.length===10?'('+digits.slice(0,3)+') '+digits.slice(3,6)+'-'+digits.slice(6):value||'Unknown number'
}
function duration(value:number){
 const v=Math.max(0,Math.round(value||0))
 return Math.floor(v/60)+':'+String(v%60).padStart(2,'0')
}
function missedResult(result:string|null){
 return /missed|no answer|unanswered|abandoned|rejected|busy|voicemail/i.test(String(result||''))
}
function name(person?:Person){
 if(!person)return 'Unknown Caller'
 return [person.first_name,person.last_name].filter(Boolean).join(' ')||'Client'
}
const byNewest=(a:Item,b:Item)=>new Date(b.occurred).getTime()-new Date(a.occurred).getTime()
export default async function NotificationsCallsPanel({filter='all',q='',location='notifications'}:{filter?:string;q?:string;location?:'notifications'|'phone'}){
 const {profile}=await getCrmSession()
 if(!profile?.agency_id)return null
 const active=(SECTIONS.map(item=>item[0]) as string[]).includes(filter)?filter as Section:'all'
 const search=q.trim().toLowerCase()
 const admin=createAdminClient()
 const [callsResult,voicemailResult]=await Promise.all([
  admin.from('ringcentral_calls').select('id,client_id,direction,result,started_at,duration_seconds,contact_phone,from_phone,to_phone,recording_id,staff_note')
   .eq('agency_id',profile.agency_id).is('hidden_at',null)
   .order('started_at',{ascending:false}).limit(1500),
  admin.from('ringcentral_office_voicemails').select('id,client_id,received_at,from_phone,duration_seconds,audio_attachment_id,read_status,staff_note')
   .eq('agency_id',profile.agency_id).is('hidden_at',null)
   .order('received_at',{ascending:false}).limit(1500)
 ])
 if(callsResult.error)throw new Error('Unable to read office RingCentral calls: '+callsResult.error.message)
 if(voicemailResult.error)throw new Error('Unable to read RingCentral voicemails: '+voicemailResult.error.message)
 const calls=(callsResult.data||[]) as CallRow[]
 const voicemails=(voicemailResult.data||[]) as VmRow[]
 const ids=[...new Set([...calls,...voicemails].map(row=>row.client_id).filter(Boolean))] as string[]
 const clientMap=new Map<string,Person>()
 for(let i=0;i<ids.length;i+=150){
  const {data,error}=await admin.from('clients').select('id,first_name,last_name,phone')
   .eq('agency_id',profile.agency_id).in('id',ids.slice(i,i+150))
  if(error)throw new Error('Unable to match saved client names: '+error.message)
  for(const person of (data||[]) as Person[])clientMap.set(person.id,person)
 }
 const items:Item[]=[
  ...calls.map(row=>({
   id:row.id,kind:'call' as const,
   category:(row.direction==='Outbound'?'outbound':missedResult(row.result)?'missed':'inbound') as Item['category'],
   occurred:row.started_at,phone:row.contact_phone||(row.direction==='Inbound'?row.from_phone:row.to_phone)||'',
   direction:row.direction,result:row.result||row.direction,seconds:row.duration_seconds||0,
   client_id:row.client_id,recording_id:row.recording_id,staff_note:row.staff_note,read_status:null
  })),
  ...voicemails.map(row=>({
   id:row.id,kind:'voicemail' as const,category:'voicemail' as const,
   occurred:row.received_at,phone:row.from_phone||'',direction:'Inbound',
   result:'Voicemail',seconds:row.duration_seconds||0,client_id:row.client_id,
   recording_id:row.audio_attachment_id,staff_note:row.staff_note,read_status:row.read_status
  }))
 ].sort(byNewest)
 const totals={
  all:items.length,inbound:items.filter(x=>x.category==='inbound').length,
  outbound:items.filter(x=>x.category==='outbound').length,
  missed:items.filter(x=>x.category==='missed').length,
  voicemail:items.filter(x=>x.category==='voicemail').length
 }
 const today=dateKey(new Date())
 const todays=items.filter(row=>dateKey(row.occurred)===today).length
 const rows=items.filter(row=>{
  if(active!=='all'&&row.category!==active)return false
  if(!search)return true
  const person=row.client_id?clientMap.get(row.client_id):undefined
  return [name(person),row.phone,row.result,row.direction,row.category].join(' ').toLowerCase().includes(search)
 })
 const groups=new Map<string,Item[]>()
 for(const item of rows){
  const key=dateKey(item.occurred)
  groups.set(key,[...(groups.get(key)||[]),item])
 }
 const href=(tab:Section)=>{
  const base=location==='phone'
   ? '/phone?tab='+(tab==='voicemail'?'voicemails':'calls')+'&filter='+tab
   : '/notifications?tab=calls&filter='+tab
  return base+(q?'&q='+encodeURIComponent(q):'')
 }
 return <div className="office-ringcentral">
  <div className="office-ring-head">
   <div><h2>Office RingCentral Call Data</h2>
    <p className="subtle">All accessible office-extension calls and voicemail messages — including numbers not saved as clients. Each day's activity stays collapsed until you open it.</p></div>
   <CallsSyncButton configured={isRingCentralConfigured()}/>
  </div>
  <div className="office-ring-metrics">
   <div><span>Today</span><strong>{todays}</strong></div>
   <div><span>Inbound Answered</span><strong>{totals.inbound}</strong></div>
   <div><span>Outbound</span><strong>{totals.outbound}</strong></div>
   <div><span>Missed Calls</span><strong>{totals.missed}</strong></div>
   <div><span>Voicemails</span><strong>{totals.voicemail}</strong></div>
  </div>
  <div className="office-ring-tabs" aria-label="Call activity sections">
   {SECTIONS.map(([key,label])=><Link href={href(key)} key={key}
    aria-current={active===key?'page':undefined}
    className={'office-ring-tab'+(active===key?' selected':'')}>{label}<b>{totals[key]}</b></Link>)}
  </div>
  <form className="office-ring-search" action={location==='phone'?'/phone':'/notifications'} method="get">
   <input type="hidden" name="tab" value={location==='phone' && active==='voicemail'?'voicemails':'calls'}/>
   <input type="hidden" name="filter" value={active}/>
   <input type="search" name="q" defaultValue={q} placeholder="Search by number or client name" aria-label="Search office calls"/>
   <button type="submit" className="btn btn-secondary">Search</button>
   {search?<Link href={href(active).split('&q=')[0]} className="btn btn-secondary">Clear</Link>:null}
  </form>
  <div className="office-ring-notice">Delete removes a record from the Office CRM and prevents it reappearing on sync. It does not remove the original RingCentral call or voicemail. RingCentral determines available history and recording access.</div>
  <div className="office-ring-days">
   {groups.size===0?<p className="card card-pad subtle">No RingCentral activity matches this section yet. Use Sync RingCentral to retrieve available history.</p>:null}
   {[...groups].map(([day,entries])=><details className="office-ring-day" key={active+'-'+day}>
     <summary><span><strong>{dateLabel(day)}</strong><small>{entries.length} {entries.length===1?'record':'records'}</small></span><span className="office-ring-chevron" aria-hidden="true">⌄</span></summary>
     <div className="office-ring-day-body">
      {entries.map(row=>{
       const person=row.client_id?clientMap.get(row.client_id):undefined
       const label=row.category==='inbound'?'Inbound Answered':row.category==='outbound'?'Outbound':
        row.category==='missed'?'Missed Call':'Voicemail'
       return <article key={row.kind+'-'+row.id} className={'office-ring-item is-'+row.category}>
        <div className="office-ring-item-main">
         <div className="office-ring-item-heading"><strong>{name(person)}</strong><span>{label}</span></div>
         <div className="office-ring-item-meta">
          <span>{phone(row.phone)}</span><span>{time(row.occurred)}</span>
          <span>{duration(row.seconds)}</span>
          {row.kind==='call'?<span>{row.result}</span>:null}
          {row.kind==='voicemail'&&row.read_status?<span>{row.read_status}</span>:null}
         </div>
         {person?<Link className="office-ring-client-link" href={'/clients/'+person.id}>Open Client Record ↗</Link>:
          <Link className="office-ring-client-link" href={'/clients/new?phone='+encodeURIComponent(row.phone)+'&source=ringcentral'}>+ Make New Client ↗</Link>}
        </div>
        <OfficeRingCentralActions kind={row.kind} id={row.id} clientId={person?.id||null} phone={row.phone}
          label={label} initialNote={row.staff_note} recordingId={row.kind==='call'?row.recording_id:null}/>
       </article>
      })}
     </div>
    </details>)}
  </div>
  <style>{`
   .office-ringcentral{display:grid;gap:13px;margin-top:16px;min-width:0}
   .office-ring-head{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
   .office-ring-head h2{font-size:1.2rem;margin:0 0 5px;color:#203648}
   .office-ring-head p{font-size:.79rem;max-width:720px;margin:0;line-height:1.45}
   .office-ring-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
   .office-ring-metrics>div{min-width:0;display:grid;gap:5px;padding:13px 12px;border:1px solid #cfdbe3;background:#f8fbfd;border-radius:10px}
   .office-ring-metrics span{color:#547080;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.03em}
   .office-ring-metrics strong{font-size:1.5rem;color:#183c54}
   .office-ring-tabs{display:flex;flex-wrap:wrap;gap:6px}
   .office-ring-tab{display:inline-flex;align-items:center;gap:7px;border:1px solid #b9cad5;background:#f7fafc;color:#38546a;
      text-decoration:none;border-radius:9px;font-size:.75rem;font-weight:850;min-height:37px;padding:7px 10px}
   .office-ring-tab.selected{background:#244963;border-color:#244963;color:#fff}
   .office-ring-tab b{color:inherit;background:rgba(128,156,170,.17);border-radius:8px;padding:2px 6px}
   .office-ring-search{display:flex;flex-wrap:wrap;gap:8px}
   .office-ring-search input{flex:1;min-width:210px;padding:10px 12px;border:1px solid #aabfcb;background:#fff;color:#20394b;border-radius:9px;font:inherit}
   .office-ring-notice{padding:9px 11px;border:1px solid #d5e1e8;border-radius:9px;font-size:11px;line-height:1.5;background:#f4f8fa;color:#516b7b}
   .office-ring-days{display:grid;gap:8px}
   .office-ring-day{border:1px solid #cbdbe4;border-radius:11px;background:#fff;overflow:hidden}
   .office-ring-day>summary{cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;list-style:none;
      min-height:55px;padding:10px 14px;color:#203e53;background:#edf4f7}
   .office-ring-day>summary::-webkit-details-marker{display:none}
   .office-ring-day>summary strong{font-size:.89rem;font-weight:900}
   .office-ring-day>summary small{display:block;color:#667e8c;font-size:11px;margin-top:4px}
   .office-ring-chevron{font-size:23px;color:#567a91;line-height:1}
   .office-ring-day[open] .office-ring-chevron{transform:rotate(180deg)}
   .office-ring-day>summary:focus-visible{outline:2px solid #37779b;outline-offset:-2px}
   .office-ring-day-body{display:grid;gap:8px;padding:11px 12px;background:#fafcfd}
   .office-ring-item{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,.9fr);gap:13px;padding:11px 12px;
      border:1px solid #cfdae1;border-left:4px solid #7d9cac;border-radius:9px;background:#fff;min-width:0}
   .office-ring-item.is-missed{border-left-color:#bd7976}
   .office-ring-item.is-voicemail{border-left-color:#8e7cab}
   .office-ring-item.is-outbound{border-left-color:#718fa9}
   .office-ring-item-main{min-width:0;display:grid;align-content:start;gap:7px}
   .office-ring-item-heading{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
   .office-ring-item-heading strong{font-size:13px;color:#19394b}
   .office-ring-item-heading span{font-size:10px;background:#eaf1f6;border-radius:7px;color:#405f72;padding:3px 7px;font-weight:850}
   .office-ring-item-meta{display:flex;flex-wrap:wrap;gap:5px 12px;color:#556e7d;font-size:11px;font-weight:650}
   .office-ring-client-link{font-size:11px;font-weight:800;color:#166080;text-decoration:underline;width:max-content;max-width:100%}
   .office-ring-actions{display:grid;gap:8px;min-width:0;align-content:start}
   .office-ring-action-buttons{display:flex;flex-wrap:wrap;gap:6px}
   .office-ring-actions .btn{font-size:11px!important;min-height:34px!important;padding:7px 10px!important;font-weight:800!important;color:#234b65!important;background:#ecf4f8!important}
   .office-ring-actions .office-ring-delete{border-color:#d8acaa!important;color:#8d4343!important;background:#fff2f1!important}
   .office-ring-actions audio{width:100%;height:34px;max-width:380px}
   .office-ring-note{border:1px solid #d3e0e7;background:#f7fafb;border-radius:8px;min-width:0}
   .office-ring-note summary{cursor:pointer;padding:8px 10px;font-size:11px;color:#254c63;font-weight:850}
   .office-ring-note-content{display:grid;gap:7px;padding:9px 10px;border-top:1px solid #d3e0e7}
   .office-ring-note-content label{display:grid;gap:5px;font-size:11px;color:#496475;font-weight:850}
   .office-ring-note textarea{width:100%;min-width:0;box-sizing:border-box;resize:vertical;min-height:70px;
      border:1px solid #a7c0cf;border-radius:7px;padding:9px;font:inherit;color:#193a50;background:#fff}
   .office-ring-note-content button{justify-self:start}
   .office-ring-feedback{font-size:11px;color:#285b48;margin:0}
   .ringcentral-calls-sync{display:grid;gap:6px;justify-items:end}
   @media(max-width:920px){.office-ring-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}
    .office-ring-item{grid-template-columns:1fr}.ringcentral-calls-sync{justify-items:start}}
   @media(max-width:600px){.office-ring-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
    .office-ring-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
    .office-ring-tab{justify-content:space-between;font-size:11px}
    .office-ring-search input{min-width:0;flex-basis:100%}
    .office-ring-item{padding:10px}.office-ring-day-body{padding:8px}
    .office-ring-action-buttons>.btn{flex:1}
   }
  `}</style>
 </div>
}
