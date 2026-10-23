import Link from 'next/link'
import {redirect} from 'next/navigation'
import type {Metadata} from 'next'
import {getCrmSession} from '@/lib/crm-session'
import MessagesCenter from '../messages/MessagesCenter'
import NotificationsCallsPanel from '../notifications/NotificationsCallsPanel'

export const dynamic='force-dynamic'
export const revalidate=0
export const metadata:Metadata={title:'Phone | Office CRM'}

type Params=Promise<{
 tab?:string
 filter?:string
 q?:string
 agent?:string
}>

export default async function PhonePage({searchParams}:{searchParams?:Params}){
 const {profile}=await getCrmSession()
 if(!profile?.agency_id)redirect('/account-setup')
 const params=searchParams?await searchParams:{}
 const requested=String(params.tab||'').toLowerCase()
 const tab=requested==='calls'?'calls':requested==='voicemails'||requested==='voicemail'?'voicemails':'messages'
 const filter=tab==='voicemails'?'voicemail':params.filter||'all'
 const agent=params.agent==='justin'||params.agent==='isaiah'?params.agent:'all'

 const nav=[
  {key:'messages',name:'Text Messages',help:'Incoming and outgoing client texts',href:'/phone?tab=messages',glyph:'✉'},
  {key:'calls',name:'Call Data',help:'All inbound, outbound and missed calls',href:'/phone?tab=calls',glyph:'☎'},
  {key:'voicemails',name:'Voicemails',help:'Recorded RingCentral voice messages',href:'/phone?tab=voicemails',glyph:'◉'}
 ] as const

 return <div className="office-phone-shell">
  <header className="office-phone-heading">
   <span className="office-phone-eyebrow">COMMUNICATIONS</span>
   <h1>Phone</h1>
   <p>Find office phone messages, call activity and RingCentral voicemails in one place.</p>
  </header>
  <nav className="office-phone-tabs" aria-label="Phone sections">
   {nav.map(item=><Link prefetch={false} href={item.href} key={item.key}
    className={'office-phone-tab'+(tab===item.key?' is-active':'')}
    aria-current={tab===item.key?'page':undefined}>
    <span className="office-phone-symbol" aria-hidden="true">{item.glyph}</span>
    <span><strong>{item.name}</strong><small>{item.help}</small></span>
   </Link>)}
  </nav>
  <section className="office-phone-content" aria-label={tab==='messages'?'Phone text messages':tab==='voicemails'?'RingCentral voicemails':'Office call data'}>
   {tab==='messages'?<MessagesCenter viewerName={profile.full_name||''} initialAgent={agent}/>:
    <NotificationsCallsPanel filter={filter} q={params.q||''} location="phone"/>}
  </section>
  <style>{`
   .office-phone-shell{max-width:1240px;margin:0 auto;display:grid;gap:14px;min-width:0}
   .office-phone-heading{padding:2px 0 9px;border-bottom:1px solid #d7e3e9}
   .office-phone-eyebrow{font-size:10px;letter-spacing:.11em;font-weight:900;color:#668496}
   .office-phone-heading h1{font-size:28px;margin:3px 0 4px;color:#223e52}
   .office-phone-heading p{font-size:13px;margin:0;color:#607b8b}
   .office-phone-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}
   .office-phone-tab{display:flex;gap:10px;align-items:center;min-width:0;
    text-decoration:none;border:1px solid #c8d9e3;background:#f5f9fb;color:#355367;
    border-radius:11px;padding:12px;min-height:69px;box-sizing:border-box}
   .office-phone-tab:hover{border-color:#8bafc2;background:#eaf4f8}
   .office-phone-tab.is-active{background:#e5f0f6;border:1.5px solid #6894ad;box-shadow:inset 0 0 0 1px #b9d2e0}
   .office-phone-symbol{flex:0 0 auto;display:grid;place-items:center;
    width:35px;height:35px;border:1px solid #d0dfe7;background:#fff;
    border-radius:9px;font-size:20px;color:#35627c}
   .office-phone-tab strong{display:block;font-size:13px;color:#234258}
   .office-phone-tab small{display:block;margin-top:4px;font-size:10px;line-height:1.25;color:#65808f}
   .office-phone-content{min-width:0}
   @media(max-width:700px){
    .office-phone-tabs{gap:5px}
    .office-phone-tab{padding:8px 6px;gap:5px;min-height:60px;flex-direction:column;text-align:center}
    .office-phone-symbol{width:27px;height:27px;font-size:17px}
    .office-phone-tab strong{font-size:11px}
    .office-phone-tab small{display:none}
    .office-phone-heading h1{font-size:23px}
   }
  `}</style>
 </div>
}
