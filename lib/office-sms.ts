// Shared pure helpers and verified Twilio webhook persistence for Office CRM.
export const OFFICE_SMS_ORIGINS=new Set(['https://office.mayerig.com','https://office-crm-sand.vercel.app','https://office-crm-msccv965z2-2421s-projects.vercel.app'])
export const OFFICE_SMS_BRIDGES={arctos:'https://bogusfmvdrlvxscopgaw.supabase.co/functions/v1/office-crm-bridge',platinum:'https://sggzshbdfgkyyvxbebul.supabase.co/functions/v1/office-crm-bridge'} as const
export const smsPhone=(v:unknown)=>{const n=String(v||'').replace(/\D/g,'');return n.length===10?'+1'+n:n.length===11&&n[0]==='1'?'+'+n:''}
export const smsName=(v:unknown)=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase()
export function matchingLegacyClient(client:any,remoteAgentName:string,candidates:any[]){
 const phone=smsPhone(client.phone),name=smsName([client.first_name,client.last_name].filter(Boolean).join(' '))
 const matches=candidates.filter(c=>phone&&smsPhone(c.phone)===phone&&smsName([c.first_name,c.last_name].filter(Boolean).join(' '))===name&&smsName(c.agent_name)===smsName(remoteAgentName))
 return matches.length===1?matches[0]:null
}
export function mergeSmsMessages(messages:any[],phone:string){
 const seen=new Set<string>();return messages.filter(m=>smsPhone(m.direction==='inbound'?m.from_number:m.to_number)===smsPhone(phone)).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id))).filter(m=>{const key=m.twilio_message_sid||m.id;if(seen.has(key))return false;seen.add(key);return true})
}
export async function saveOfficeInbound(admin:any,params:URLSearchParams){
 const from=smsPhone(params.get('From')),to=smsPhone(params.get('To')),sid=params.get('MessageSid')||params.get('SmsMessageSid')
 if(!from||!sid)return false
 const {data:outbound,error:lookupError}=await admin.from('office_sms_messages').select('thread_id,created_at').eq('direction','outbound').eq('to_number',from).not('twilio_message_sid','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(lookupError)throw Error('Office reply lookup failed')
 if(!outbound?.thread_id)return false
 const {data:legacyOutbound,error:legacyError}=await admin.from('client_sms_messages').select('created_at').eq('direction','outbound').eq('to_number',from).not('twilio_message_sid','is',null).order('created_at',{ascending:false}).limit(1).maybeSingle()
 if(legacyError)throw Error('Office reply routing failed')
 if(legacyOutbound&&legacyOutbound.created_at>outbound.created_at)return false
 const {data:thread,error:threadError}=await admin.from('office_sms_threads').select('id,phone').eq('id',outbound.thread_id).maybeSingle()
 if(threadError)throw Error('Office reply thread lookup failed')
 if(!thread||smsPhone(thread.phone)!==from)return false
 const {error}=await admin.from('office_sms_messages').upsert({id:crypto.randomUUID(),thread_id:thread.id,direction:'inbound',body:String(params.get('Body')||''),from_number:from,to_number:to||null,twilio_message_sid:sid,status:'received'},{onConflict:'twilio_message_sid',ignoreDuplicates:true})
 if(error)throw Error('Office reply could not be saved')
 return true
}
