(function(){
'use strict';let ctx=null,modal=null,modalTicket=0,inboxTicket=0;const drafts=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={arctos:'Arctos',platinum:'Platinum Financial'};
const date=v=>v?new Date(v).toLocaleString():'';
const idle=()=>{};
let stopThreadPoll=idle,stopInboxPoll=idle,refreshInbox=idle,releaseAttachment=idle,inboxChanged=false;
function poll(active,available,refresh,delay,inactive=idle){
 function tick(){
  if(!active()){stop();inactive();return;}
  if(document.visibilityState==='visible'&&available())void refresh();
 }
 const timer=setInterval(tick,delay);
 function stop(){clearInterval(timer);document.removeEventListener('visibilitychange',tick);}
 document.addEventListener('visibilitychange',tick);
 return stop;
}
function close(){
 if(modal?.dataset.sending==='true')return;
 modalTicket++;
 stopThreadPoll();stopThreadPoll=idle;
 releaseAttachment();releaseAttachment=idle;
 modal?.remove();modal=null;
 if(inboxChanged)queueMicrotask(()=>{if(!modal)refreshInbox();});
}
function panel(title){if(modal?.dataset.sending==='true')throw Error('Wait for the current messages to finish sending.');close();modal=document.createElement('div');modal.className='office-sms-modal';modal.innerHTML='<section role="dialog" aria-modal="true" aria-label="'+esc(title)+'" class="office-sms-dialog"><header><div><h2>'+esc(title)+'</h2><p data-sms-subtitle></p></div><button class="outline" data-sms-close type="button" aria-label="Close texts">Close</button></header><div data-sms-content></div><p class="office-sms-notice" data-sms-notice role="status"></p></section>';document.body.append(modal);modal.querySelector('[data-sms-close]').onclick=close;return modal;}
function notice(host,message){if(host?.isConnected)host.querySelector('[data-sms-notice]').textContent=message;}
window.addEventListener('beforeunload',e=>{if(modal?.dataset.sending==='true'){e.preventDefault();e.returnValue='';}});
const api=(p)=>{if(!ctx?.signedIn())throw Error('Sign in to Office CRM.');return ctx.request(p)};
async function thread(agency,clientId){
 const host=panel('Text conversation'),ticket=modalTicket;
 const content=host.querySelector('[data-sms-content]'),key=agency+':'+clientId;
 const draft=drafts.get(key)||{body:'',operation:null};
 const attachment=window.CrmTextAttachments.picker(document.createElement('div'),{scope:'office-'+agency,headers:()=>ctx.authHeaders()});
 releaseAttachment=attachment.clear;
 const active=()=>host.isConnected&&ticket===modalTicket&&ctx.signedIn();
 const visible=()=>active()&&document.visibilityState==='visible';
 let loaded=[],offset=0,hasMore=false,olderLoaded=false,busy=false,canSend=false,pending=null;
 let form,history,input,historySignature=null,phone=null,lastPage=[],olderPending=false;
 const markedRead=new Set();
 content.innerHTML='<p class="empty">Loading messages…</p>';

 function enableCompose(){
  input.disabled=!canSend||busy;
  form.querySelector('[type="submit"]').disabled=!canSend||busy;
  attachment.disable(!canSend||busy);
 }
 function createCompose(){
  content.innerHTML='<div class="office-sms-thread"></div><form class="office-sms-compose"><label>Message<textarea name="body" rows="3" maxlength="1500" placeholder="Write a text message"></textarea></label><div><small data-sms-count></small><button class="primary" type="submit">Send text</button></div></form>';
  history=content.querySelector('.office-sms-thread');form=content.querySelector('form');input=form.elements.body;
  input.value=draft.body;form.querySelector('[data-sms-count]').textContent=input.value.length+'/1500';
  form.append(attachment.root);
  const edited=()=>{draft.operation=null;drafts.set(key,draft);};
  attachment.root.addEventListener('change',edited);
  attachment.root.querySelector('button').addEventListener('click',edited);
  input.oninput=()=>{draft.body=input.value;edited();form.querySelector('[data-sms-count]').textContent=input.value.length+'/1500';};
  form.onsubmit=async e=>{
   e.preventDefault();if(!canSend||busy||(!input.value.trim()&&!attachment.hasFile()))return;
   busy=true;host.dataset.sending='true';enableCompose();
   draft.body=input.value;draft.operation=draft.operation||crypto.randomUUID();drafts.set(key,draft);
   try{
    const attachment_id=await attachment.upload();
    if(!active())return;
    const sent=await api({command:'send',agency,client_id:clientId,body:draft.body,attachment_id,operation_id:draft.operation});
    if(!active())return;
    if(['failed','undelivered'].includes(sent.status))throw Error('The text failed. Start a new message to retry.');
    drafts.delete(key);draft.body='';draft.operation=null;input.value='';form.querySelector('[data-sms-count]').textContent='0/1500';
    attachment.clear();inboxChanged=true;notice(host,sent.warning||'Text submitted. Delivery status will update here.');
    if(pending)await pending;
    if(active())await load();
   }catch(error){notice(host,error.message);}
   finally{busy=false;host.dataset.sending='false';if(active())enableCompose();}
  };
 }
 const messageKey=m=>m.twilio_message_sid||m.id;
 function combine(earlier,later){
  const merged=new Map(earlier.map(m=>[messageKey(m),m]));
  for(const m of later)merged.set(messageKey(m),m);
  return [...merged.values()].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
 }
 function draw(result,older){
  const client=result.client||{},number=client.phone||'',name=[client.first_name,client.last_name].filter(Boolean).join(' ')||'Client';
  const title=host.querySelector('h2'),subtitle=host.querySelector('[data-sms-subtitle]'),sub=label[agency]+' · '+(result.agent?.full_name||'')+' · '+number;
  if(title.textContent!==name)title.textContent=name;
  if(subtitle.textContent!==sub)subtitle.textContent=sub;
  const page=result.messages||[],next=result.next_offset??((older?offset:0)+page.length);
  if(older){
   loaded=combine(page,loaded);offset=next;hasMore=!!result.has_more;olderLoaded=true;
  }else{
   if(!olderLoaded||!result.has_more||number!==phone){
    loaded=page;offset=next;hasMore=!!result.has_more;olderLoaded=false;
   }else{
    // Keep the expanded history. New rows can shift an offset window forward.
    const anchor=messageKey(lastPage[lastPage.length-1]||{});
    const pivot=page.findIndex(m=>messageKey(m)===anchor);
    if(pivot<0){offset=next;hasMore=true;}else{offset+=page.length-pivot-1;}
    loaded=combine(loaded,page);
   }
   lastPage=page;phone=number;
  }
  const firstPaint=!form;
  if(firstPaint)createCompose();
  if(firstPaint||canSend!==!!result.can_send){canSend=!!result.can_send;enableCompose();}
  const signature=JSON.stringify([hasMore,loaded.map(m=>[m.id,m.direction,m.body,m.text_attachment?.kind,m.text_attachment?.name,m.text_attachment?.url,m.created_at,m.status,m.error_message])]);
  if(historySignature===signature)return;
  historySignature=signature;
  const top=history.scrollTop,height=history.scrollHeight,atBottom=height-history.clientHeight-top<12;
  history.innerHTML=(hasMore?'<button class="outline" data-sms-older>Load older messages</button>':'')+(loaded.map(m=>'<article class="office-sms-bubble '+(m.direction==='inbound'?'inbound':'outbound')+'"><p>'+esc(m.body)+'</p><div>'+window.CrmTextAttachments.history(m.text_attachment)+'</div><small>'+esc(date(m.created_at))+' · '+esc(m.status||m.direction)+(m.error_message?' · '+esc(m.error_message):'')+'</small></article>').join('')||'<p class="empty">No messages yet.</p>');
  history.scrollTop=older?top+history.scrollHeight-height:firstPaint||atBottom?history.scrollHeight:top;
  const olderButton=history.querySelector('[data-sms-older]');
  if(olderButton)olderButton.onclick=async()=>{
   if(olderPending)return;
   olderPending=true;olderButton.disabled=true;
   try{if(pending)await pending;if(active()&&hasMore)await load(true);}
   finally{olderPending=false;olderButton.disabled=false;}
  };
 }
 async function fetchPage(older){
  const result=await api({command:'thread',agency,client_id:clientId,offset:older?offset:0});
  if(!active())return;
  draw(result,older);
  const unread=(result.messages||[]).filter(m=>m.direction==='inbound'&&!m.read_at&&!markedRead.has(messageKey(m)));
  if(visible()&&unread.length){
   await api({command:'read',agency,client_id:clientId});
   if(!active())return;
   for(const m of unread)markedRead.add(messageKey(m));
   inboxChanged=true;
  }
 }
 function load(older=false){
  if(!pending)pending=fetchPage(older).catch(error=>{if(active())notice(host,error.message);}).finally(()=>{pending=null;});
  return pending;
 }
 stopThreadPoll=poll(active,()=>!busy&&!olderPending,load,15000);
 await load();
}
async function compose(agency,agentId,source){
 const host=panel(source?.title||'New text / Mass text'),ticket=modalTicket;let selected=new Set(),sending=false;
 try{
 const data=source?{clients:await source.load(),can_send:true}:await api({command:'directory',agency,agent_id:agentId});
 if(!host.isConnected||ticket!==modalTicket)return;
 const key=c=>c.agency+':'+c.id,eligible=c=>c.status!=='deceased'&&/^1?\d{10}$/.test(String(c.phone||'').replace(/\D/g,''))&&c.can_send!==false;
 const clients=Array.from(new Map((data.clients||[]).map(c=>({...c,agency:c.agency||agency})).map(c=>[key(c),c])).values());
 const recipients=clients.filter(eligible),recipientByKey=new Map(recipients.map(c=>[key(c),c]));if(source)selected=new Set(recipients.map(key));
 host.querySelector('[data-sms-subtitle]').textContent=source?'Review recipients, uncheck anyone to exclude, then write your message.':label[agency]+' · '+data.agent.full_name;
 host.querySelector('[data-sms-content]').innerHTML='<form class="office-sms-bulk"><label>Find recipients<input type="search" data-sms-find placeholder="Search name or phone"></label><div class="office-sms-toolbar"><button type="button" class="outline" data-sms-all>Select All</button><button type="button" class="outline" data-sms-none>Deselect All</button></div><div class="office-sms-recipients"></div><p data-sms-selected></p><label>Message<textarea name="body" rows="4" maxlength="1500"></textarea></label><div data-sms-file></div><label><input type="checkbox" name="consent" required> I confirm these clients have given permission to receive this message.</label><button class="primary" type="submit" data-sms-send>Send to selected clients</button></form>';
 const form=host.querySelector('form'),list=host.querySelector('.office-sms-recipients'),send=form.querySelector('[data-sms-send]');
 const attachment=window.CrmTextAttachments.picker(host.querySelector('[data-sms-file]'),{scope:()=> 'office-'+(agency||clients[0]?.agency),headers:()=>ctx.authHeaders()});
 releaseAttachment=attachment.clear;
 const uploads=new Map();attachment.root.addEventListener('change',()=>uploads.clear());attachment.root.querySelector('button').addEventListener('click',()=>uploads.clear());
 function show(){const search=host.querySelector('[data-sms-find]').value.toLowerCase();list.innerHTML=clients.filter(c=>!search||[c.first_name,c.last_name,c.phone].join(' ').toLowerCase().includes(search)).map(c=>'<label><input type="checkbox" value="'+esc(key(c))+'"'+(selected.has(key(c))?' checked':'')+(sending||!eligible(c)?' disabled':'')+'><span>'+esc([c.first_name,c.last_name].filter(Boolean).join(' '))+'<small>'+esc(label[c.agency]+' · '+(c.phone||'No phone number'))+(!eligible(c)?' · Unavailable for texting':'')+'</small></span></label>').join('')||'<p>No matching clients.</p>';
 list.querySelectorAll('input').forEach(b=>b.onchange=()=>{if(b.checked)selected.add(b.value);else selected.delete(b.value);update();});update();}
 function update(){host.querySelector('[data-sms-selected]').textContent=selected.size+' recipients selected'+(clients.length>recipients.length?' · '+(clients.length-recipients.length)+' unavailable':'');send.disabled=sending||!data.can_send||!selected.size;form.querySelector('[data-sms-all]').disabled=sending;form.querySelector('[data-sms-none]').disabled=sending;form.elements.body.disabled=sending;}
 host.querySelector('[data-sms-find]').oninput=show;form.querySelector('[data-sms-all]').onclick=()=>{selected=new Set(recipients.map(key));show();};form.querySelector('[data-sms-none]').onclick=()=>{selected.clear();show();};show();
 form.onsubmit=async e=>{e.preventDefault();if(sending||!data.can_send||!selected.size)return;if(!form.elements.consent.checked){notice(host,'Confirm recipient permission before sending.');return;}const body=form.elements.body.value.trim();if(!body&&!attachment.hasFile())return;sending=true;host.dataset.sending='true';attachment.disable(true);host.querySelector('[data-sms-close]').disabled=true;show();let sent=0,failed=0,duplicate=0;const phones=new Set();for(const recipient of Array.from(selected)){if(!host.isConnected||!ctx.signedIn())break;const c=recipientByKey.get(recipient);const phone=String(c.phone).replace(/\D/g,'').slice(-10);if(phones.has(phone)){selected.delete(recipient);duplicate++;continue;}phones.add(phone);try{let attachment_id=uploads.get(c.agency);if(!uploads.has(c.agency)){attachment_id=await attachment.upload('office-'+c.agency);uploads.set(c.agency,attachment_id);}if(!host.isConnected||!ctx.signedIn())break;const prior=drafts.get(recipient),operation=prior?.body===body&&prior.attachment_id===attachment_id&&prior.operation?prior.operation:crypto.randomUUID();drafts.set(recipient,{body,operation,attachment_id});const answer=await api({command:'send',agency:c.agency,client_id:c.id,body,attachment_id,operation_id:operation});if(!host.isConnected||ticket!==modalTicket||!ctx.signedIn())break;if(['failed','undelivered'].includes(answer.status))throw Error('Failed');selected.delete(recipient);drafts.delete(recipient);sent++;inboxChanged=true;}catch{failed++;}notice(host,sent+' submitted · '+failed+' failed · '+selected.size+' remaining');}sending=false;host.dataset.sending='false';attachment.disable(false);host.querySelector('[data-sms-close]').disabled=false;notice(host,sent+' submitted · '+failed+' failed · '+duplicate+' duplicate numbers skipped · '+selected.size+' remaining');show();};
 }catch(error){notice(host,error.message);}
}
function mount(el){
 const instance=++inboxTicket;let agency='',agent='',board='unread',conversations=[];
 el.innerHTML='<section class="panel office-sms-inbox"><div class="oc-campaign-pickers"><label>Agency<select data-sms-agency><option value="">Choose an agency</option>'+ctx.agencies().map(a=>'<option value="'+a+'">'+label[a]+'</option>').join('')+'</select></label><label>Agent<select data-sms-agent disabled><option value="">Choose an agency first</option></select></label></div><div class="office-sms-toolbar"><button class="primary" data-sms-new disabled>New text / Mass text</button><button class="outline" data-sms-refresh>Refresh</button></div><div class="office-sms-boards"><button class="primary" data-sms-board="unread">Unread</button><button class="outline" data-sms-board="read">Read</button></div><p data-sms-inbox-notice role="status"></p><div data-sms-conversations><p class="empty">Choose an agency and agent to view messages.</p></div></section>';
 const active=()=>instance===inboxTicket&&el.isConnected&&ctx.signedIn();
 const visible=()=>!modal?.isConnected&&!document.querySelector('#dialog > *');
 const list=el.querySelector('[data-sms-conversations]'),composeButton=el.querySelector('[data-sms-new]'),agentSelect=el.querySelector('[data-sms-agent]');
 const status=message=>{if(active()){const node=el.querySelector('[data-sms-inbox-notice]');if(node.textContent!==message)node.textContent=message;}};
 let generation=0,pending=null,signature=null;
 function paint(){
  if(!active())return;
  const unread=conversations.filter(c=>c.unread_count>0).length,read=conversations.filter(c=>c.unread_count===0).length;
  el.querySelectorAll('[data-sms-board]').forEach(b=>{
   const kind=b.dataset.smsBoard,title=(kind==='unread'?'Unread':'Read')+' ('+(kind==='unread'?unread:read)+')';
   if(b.textContent!==title)b.textContent=title;
   const style=kind===board?'primary':'outline';if(b.className!==style)b.className=style;
  });
  const shown=conversations.filter(c=>board==='unread'?c.unread_count>0:c.unread_count===0);
  const next=JSON.stringify([board,shown.map(c=>[c.client_id,c.client_name,c.phone,c.latest_at,c.latest_body,c.unread_count])]);
  if(next===signature)return;
  signature=next;
  list.innerHTML=shown.map(c=>'<article class="office-sms-conversation"><button data-sms-thread="'+esc(c.client_id)+'"><strong>'+esc(c.client_name)+'</strong><span>'+esc(c.phone)+' · '+esc(date(c.latest_at))+'</span><p>'+esc(c.latest_body)+'</p><small>'+c.unread_count+' unread</small></button><button class="link-btn" data-sms-client="'+esc(c.client_id)+'">Open client</button></article>').join('')||'<p class="empty">No '+board+' conversations.</p>';
 }
 list.onclick=e=>{
  const button=e.target.closest('button');
  if(button?.dataset.smsThread)void thread(agency,button.dataset.smsThread);
  else if(button?.dataset.smsClient)ctx.openClient(agency,button.dataset.smsClient);
 };
 function load(foreground=false){
  if(!active()||!agency||!agent||pending)return pending;
  const wanted=generation;
  if(foreground)status('Loading messages…');
  inboxChanged=false;
  pending=(async()=>{
   try{
    const data=await api({command:'conversations',agency,agent_id:agent});
    if(!active()||generation!==wanted)return;
    conversations=data.conversations||[];
    const disabled=!data.can_send;if(composeButton.disabled!==disabled)composeButton.disabled=disabled;
    paint();status('');
   }catch(error){if(active()&&generation===wanted)status(error.message);}
  })().finally(()=>{if(generation===wanted)pending=null;});
  return pending;
 }
 function resetSelection(){
  generation++;pending=null;signature=null;conversations=[];composeButton.disabled=true;status('');
  list.innerHTML='<p class="empty">Choose an agent.</p>';
  for(const button of el.querySelectorAll('[data-sms-board]'))button.textContent=button.dataset.smsBoard==='unread'?'Unread':'Read';
 }
 el.querySelector('[data-sms-agency]').onchange=async e=>{
  agency=e.target.value;agent='';resetSelection();
  const wanted=generation;
  agentSelect.disabled=true;agentSelect.innerHTML='<option value="">Choose an agent</option>';
  if(!agency)return;
  try{
   const data=await api({command:'agents',agency});
   if(!active()||generation!==wanted)return;
   agentSelect.innerHTML+=(data.agents||[]).map(a=>'<option value="'+esc(a.id)+'">'+esc(a.full_name)+'</option>').join('');
   agentSelect.disabled=false;
  }catch(error){if(active()&&generation===wanted)status(error.message);}
 };
 agentSelect.onchange=e=>{agent=e.target.value;resetSelection();void load(true);};
 composeButton.onclick=()=>compose(agency,agent);
 el.querySelector('[data-sms-refresh]').onclick=()=>load(true);
 el.querySelectorAll('[data-sms-board]').forEach(b=>b.onclick=()=>{board=b.dataset.smsBoard;paint();});
 stopInboxPoll();
 stopInboxPoll=poll(active,visible,()=>load(),30000,()=>{if(instance===inboxTicket){stopInboxPoll=idle;refreshInbox=idle;}});
 refreshInbox=async()=>{
  if(!inboxChanged||!active()||!visible()||document.visibilityState!=='visible')return;
  if(pending)await pending;
  if(inboxChanged&&active()&&visible()&&document.visibilityState==='visible')await load();
 };
}
window.officeSms={configure(c){ctx=c;},mount,open:thread,bulk:source=>compose(null,null,source),close,reset(){inboxChanged=false;stopInboxPoll();stopInboxPoll=idle;refreshInbox=idle;if(modal)modal.dataset.sending='false';close();drafts.clear();inboxTicket++;}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal)close();});
})();
