(function(){
"use strict";
var MM_URL="https://aefdewkiqgiwkquklnvr.supabase.co",PUBLIC_KEY="sb_publishable_3dEzyrV3AvaxDMQDMTsvKw_mT7M_vqx";
var ENDPOINTS={arctos:"https://bogusfmvdrlvxscopgaw.supabase.co/functions/v1/office-crm-bridge",platinum:"https://sggzshbdfgkyyvxbebul.supabase.co/functions/v1/office-crm-bridge"};
var LABEL={arctos:"Arctos",platinum:"Platinum Financial",office:"Office Staff"};
var AGENT={arctos:"Justin",platinum:"Isaiah",office:"Sheena"};
var access=null,agency="all",tab="dashboard",activeClient=null,selectedCampaign=null;
var clientLookupView="search",clientLookupTicket=0,clientLookupController=null,clientLookupPaging={},clientLookupStatsTicket=0,clientLookupStatsCache=null,clientLookupMonthLabel="";
var connected={},clients=[],campaigns=[],appointments=[],savedSearch="",screen=document.getElementById("office-root"),mobile=false;
var officePhoneData={calls:[],texts:[],voicemails:[]},officePhoneSection="missed",officePhoneLoading=false;
var officePhoneSyncMessage="",officePhoneLastSync=0,officePhoneRequestId=0;
var officePhoneMatchCache=new Map(),officePhoneMatchBusy=0,officePhoneMatchQueue=[];
var officePhoneAudioUrls=new Set(),officePhoneOpenDays=new Set();
var campaignAgency="",campaignAgent="",campaignAgents=[],campaignSelectionResults=[],campaignLoading=false,campaignError="",campaignRequestId=0;
var leadAgency="",leadAgent="",leadAgents=[],leadResults=[],leadLoading=false,leadError="",leadRequestId=0;
var calendarView="month",calendarDate=new Date(),calendarLoading=false,calendarErrors=[],calendarLoaded=false,calendarRequestId=0;
var esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
var dateISO=(offset=0)=>{let d=new Date();d.setDate(d.getDate()+offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
var fmt=v=>{if(!v)return "—";let d=new Date(v.length===10?v+"T12:00:00":v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})};
var tag=a=>'<span class="agency-tag '+esc(a)+'">'+esc(LABEL[a]||a)+'</span>';
var status=v=>'<span class="status-pill">'+esc(v||"Unknown")+'</span>';
function setError(s){let e=document.getElementById("auth-error");if(e)e.textContent=s}
function loading(s){screen.innerHTML='<div class="loading-state">'+esc(s||"Loading Office CRM…")+'</div>'}
function token(){return access&&access.access_token||""}
function headers(){return {"Content-Type":"application/json","authorization":"Bearer "+token()}}
async function refresh(){
 if(!access?.refresh_token)throw Error("Please sign in again");
 let response=await fetch(MM_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":PUBLIC_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:access.refresh_token}),cache:"no-store"});
 if(!response.ok)throw Error("Your session has expired. Please sign in again");
 access=await response.json();
 sessionStorage.setItem("office_login_session",JSON.stringify(access));
}
async function request(which,action,params={},retried=false,options={}){
 if(!access)throw Error("Sign in first");
 let response=await fetch(ENDPOINTS[which],{method:"POST",headers:headers(),body:JSON.stringify({action,...params}),cache:"no-store",signal:options.signal});
 if(response.status===401&&!retried){await refresh();return request(which,action,params,true,options)}
 let body;try{body=await response.json()}catch{throw Error("Invalid reply from "+LABEL[which])}
 if(!response.ok)throw Error(body.error||"Unable to access "+LABEL[which]);
 return body;
}
window.officeCrmClientBridge=Object.freeze({
 request:(which,action,params={},options={})=>request(which,action,params,false,options),
 current:()=>activeClient?{agency:activeClient.agency,id:activeClient.id,client:activeClient.client,details:activeClient.details,errors:activeClient.errors,permissions:connected[activeClient.agency]?.permissions}:null
});
async function checkConnections(){
 const res=await Promise.allSettled(["arctos","platinum"].map(which=>request(which,"session")));
 connected={};
 for(let i=0;i<2;i++){let which=["arctos","platinum"][i],r=res[i];connected[which]=r.status==="fulfilled"?r.value:null}
 if(!connected.arctos&&!connected.platinum)throw Error("Office sign-in succeeded, but no agency permissions could be verified");
 connected.office={permissions:{edit:true}};
}
function showLogin(message=""){
 officePhoneRequestId++;officePhoneLoading=false;officePhoneLastSync=0;officePhoneSyncMessage="";
 officePhoneData={calls:[],texts:[],voicemails:[]};
 officePhoneMatchCache.clear();officePhoneMatchQueue.length=0;
 for(const url of officePhoneAudioUrls)URL.revokeObjectURL(url);
 officePhoneAudioUrls.clear();
 access=null;
 sessionStorage.removeItem("office_login_session");
 screen.innerHTML='<div class="auth-screen"><section class="auth-card"><div class="brand-inline"><div class="brand-mark">O<span>+</span></div><strong>Office CRM</strong></div><h1 class="auth-title">Welcome to the office</h1><p class="auth-subtitle">Secure access to Arctos and Platinum Financial. Use your existing M&amp;M CRM email and password.</p><form id="login-form"><div class="field"><label>Email address</label><input type="email" name="email" autocomplete="username" required></div><div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password" required></div><div id="auth-error" class="auth-error">'+esc(message)+'</div><button class="primary" type="submit">Sign in securely</button></form><p class="muted" style="font-size:11px;margin-top:20px">Client information is not stored in this browser. Access is limited to approved office staff.</p></section></div>';
}
function shell(){
 const connectionTags=["arctos","platinum"].map(a=>'<span class="small-pill '+(connected[a]?"online":"offline")+'">'+esc(LABEL[a])+": "+(connected[a]?"connected":"unavailable")+'</span>').join("");
 screen.innerHTML='<div class="app-shell"><aside class="sidebar" id="officeSidebar"><div class="brand"><div class="brand-mark">O<span>+</span></div><div><strong>Office CRM</strong><small>Secure Office Workspace</small></div></div><div class="workspace-label">WORKSPACE</div><nav class="navigation">'+
 ['dashboard|▦|Dashboard','clients|⌕|Clients','calendar|▣|Calendar','phone|☎|Phone','campaigns|◉|Campaigns','notes|☰|Notes','leads|◎|Leads','people|♙|Office Staff'].map(x=>{let [id,icon,label]=x.split("|");return '<button type="button" data-tab="'+id+'" class="'+(id===tab?"active":"")+'"><span class="nav-icon">'+icon+'</span> '+label+'</button>'}).join("")+
 '<div class="nav-separator"></div><button type="button" id="logout"><span class="nav-icon">↪</span> Sign Out</button></nav><div class="session-name">Authorized office account</div></aside><div class="shell-right"><header class="topbar"><button class="mobile-nav" id="mobileNav">☰</button><div><b>Office CRM</b><div class="current-indicator">● Authenticated session</div></div><div class="top-actions"><div class="filter-wrap '+(["campaigns","leads","notes","phone"].includes(tab)?"oc-campaign-global-hidden":"")+'"><label>AGENCY</label><select id="filterAgency"><option value="all">All Agencies</option><option value="arctos" '+(agency==="arctos"?"selected":"")+'>Arctos</option><option value="platinum" '+(agency==="platinum"?"selected":"")+'>Platinum Financial</option></select></div><div class="office-top-tools"><button class="primary office-action" type="button" id="officeNewAppointment" title="Set appointment"><span class="office-action-icon">▦</span><span class="office-action-label">Appointment</span></button><button class="secondary office-action" type="button" id="officeNewClient" title="New client"><span class="office-action-icon">＋</span><span class="office-action-label">New Client</span></button></div><button class="outline" id="signoutTop">Sign out</button></div></header><div class="live-banner"><b>SECURE OFFICE CONNECTIONS</b><div class="connection-dots">'+connectionTags+'</div></div><main id="main" class="main-content"></main><footer>Office CRM · Arctos: Justin · Platinum Financial: Isaiah · Office Staff: Sheena</footer></div></div><div id="dialog" class="modal-root"></div><div id="alert" class="toast"></div>';
 document.getElementById("logout").addEventListener("click",()=>showLogin());
 document.getElementById("signoutTop").addEventListener("click",()=>showLogin());
 document.getElementById("officeNewAppointment").addEventListener("click",()=>ocOpenAppointmentForm());
 document.getElementById("officeNewClient").addEventListener("click",()=>ocOpenNewClientForm());
 document.getElementById("mobileNav").addEventListener("click",()=>document.getElementById("officeSidebar").classList.toggle("open"));
 document.getElementById("filterAgency").addEventListener("change",e=>{agency=e.target.value;if(tab==="clients")clientLookupStatsCache=null;render();if(tab==="clients"){if(clientLookupView!=="search")void loadClientLookupView(clientLookupView);else if(savedSearch)void searchClients(savedSearch);}else if(["calendar","campaigns","dashboard"].includes(tab))loadTab()});
 document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;if(tab==="campaigns")resetCampaignPicker();if(tab==="leads")resetLeadPicker();document.getElementById("officeSidebar").classList.remove("open");shell();render();loadTab()}));
}
function toast(v){const e=document.getElementById("alert");if(!e)return;e.textContent=v;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),3500)}
function head(title,subtitle){return '<div class="page-heading"><div><div class="eyebrow">OFFICE WORKSPACE</div><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></div></div>'}
function available(){return Object.keys(ENDPOINTS).filter(a=>connected[a]&&(agency==="all"||agency===a))}
function render(){
 let body="";
 if(tab==="dashboard")body=head("Office Dashboard","One secure workspace for your agencies.")+'<div class="office-grid"><div class="metric"><small>Connected Agencies</small><b>'+["arctos","platinum"].filter(a=>!!connected[a]).length+'</b></div><div class="metric"><small>Appointments in View</small><b>'+appointments.length+'</b></div><div class="metric"><small>Agency Campaigns</small><b>'+campaigns.length+'</b></div></div><div class="panel"><div class="panel-header"><h2>Quick Actions</h2></div><div class="quick-actions"><button class="quick-action" data-open="clients"><span>⌕</span>Find client</button><button class="quick-action" data-open="calendar"><span>▣</span>View calendar</button><button class="quick-action" data-open="campaigns"><span>◉</span>Work campaigns</button></div></div>';
 if(tab==="clients")body=head("Client Directory","Search both agencies without copying their client records.")+officeClientLookupMarkup();
 if(tab==="phone")body=head("Phone","Office telephone calls, text messages and RingCentral voicemails.")+
 '<section class="panel office-phone-panel"><div class="panel-header"><h2>Phone Communications</h2><button type="button" class="outline" id="officePhoneRefresh">Refresh</button></div>'+
 '<p class="muted office-phone-tip">View available phone messages and call history for the Office CRM. Tap a date to open its calls. Numbers do not need a saved client record to appear.</p>'+
 '<div id="officePhoneSections" class="office-phone-tabs"></div><div id="officePhoneStatus" class="muted" role="status" aria-live="polite"></div><div id="officePhoneRecords" class="office-phone-days"></div></section>';
 if(tab==="calendar")body=head("Office Calendar","Month, week, and day views across authorized agencies.")+'<div class="notice">Use Appointment above, or select a calendar date, to book a new appointment. You can view existing appointments here. Edit existing appointments in the agency CRM.</div><section class="panel oc-calendar-panel" style="margin-top:17px"><div id="calendarResults"><div class="loading-state">Loading calendar…</div></div></section>';
 if(tab==="campaigns")body=head("Campaign Center","Choose an agency and an agent to view their campaigns.")+'<section class="panel"><div class="panel-header"><h2>Agent Campaigns</h2></div><div class="oc-campaign-pickers"><div class="oc-campaign-picker"><label for="campaignAgency">Select Agency</label><select id="campaignAgency"><option value="">Choose an agency</option>'+["arctos","platinum"].filter(a=>connected[a]).map(a=>'<option value="'+esc(a)+'"'+(campaignAgency===a?" selected":"")+'>'+esc(LABEL[a])+'</option>').join("")+'</select></div><div class="oc-campaign-picker"><label for="campaignAgent">Select Agent</label><select id="campaignAgent" disabled><option value="">Choose an agency first</option></select></div></div><div id="campaignResults" class="oc-campaign-results"><div class="empty">Choose an agency, then an agent to view campaigns.</div></div></section>';
 if(tab==="notes")body=head("Notes","Choose an agency and agent to see saved notes, or open your personal office notes.")+'<section class="panel" id="noteWorkspace"></section>';
 if(tab==="leads")body=head("Leads","View leads in Arctos and Platinum Financial without copying records.")+'<section class="panel"><div class="panel-header"><h2>Agency Leads</h2></div><div class="oc-campaign-pickers"><div class="oc-campaign-picker"><label for="leadAgency">Select Agency</label><select id="leadAgency"><option value="">Choose an agency</option>'+["arctos","platinum"].filter(a=>connected[a]).map(a=>'<option value="'+esc(a)+'"'+(leadAgency===a?" selected":"")+'>'+esc(LABEL[a])+'</option>').join("")+'</select></div><div class="oc-campaign-picker"><label for="leadAgent">Select Agent</label><select id="leadAgent" disabled><option value="">Choose an agency first</option></select></div></div><div id="leadResults" class="oc-campaign-results"><div class="empty">Choose an agency, then an agent to view their leads.</div></div></section>';
 if(tab==="people")body=head("Agencies & People","Appointments and records stay assigned to the right agents.")+'<section class="panel">'+Object.entries(AGENT).map(([a,n])=>'<div class="person-row"><div class="avatar">'+esc(n[0])+'</div><div><b>'+esc(n)+'</b><small>'+esc(LABEL[a])+'</small></div><span class="status-pill">'+(connected[a]?"Connected":a==="office"?"Office Staff":"Pending")+'</span></div>').join("")+'</section>';
 document.getElementById("main").innerHTML=body;
 document.querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.open;if(tab==="campaigns")resetCampaignPicker();if(tab==="leads")resetLeadPicker();shell();render();loadTab()}));
 let cAgency=document.getElementById("campaignAgency");if(cAgency)cAgency.addEventListener("change",e=>chooseCampaignAgency(e.target.value));
 let cAgent=document.getElementById("campaignAgent");if(cAgent)cAgent.addEventListener("change",e=>chooseCampaignAgent(e.target.value));
 let lAgency=document.getElementById("leadAgency");if(lAgency)lAgency.addEventListener("change",e=>chooseLeadAgency(e.target.value));
 let lAgent=document.getElementById("leadAgent");if(lAgent)lAgent.addEventListener("change",e=>chooseLeadAgent(e.target.value));
 let field=document.getElementById("clientSearch"),searchForm=document.getElementById("officeClientSearch");
 if(searchForm)searchForm.addEventListener("submit",e=>{e.preventDefault();clearTimeout(window.searchTimeout);void searchClients(field.value);});
 if(field)field.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();clearTimeout(window.searchTimeout);void searchClients(field.value);}});
 if(field)field.addEventListener("input",e=>{savedSearch=e.target.value;clearTimeout(window.searchTimeout);if(savedSearch.trim().length>=2)window.searchTimeout=setTimeout(()=>searchClients(savedSearch),330);});
 document.querySelectorAll('[data-office-client-view]').forEach(button=>button.onclick=()=>{clearTimeout(window.searchTimeout);const view=button.dataset.officeClientView;if(clientLookupView===view)returnToClientSearch();else void loadClientLookupView(view);});
 const back=document.getElementById('clientLookupBack');if(back)back.onclick=returnToClientSearch;
 const more=document.getElementById('clientLookupMore');if(more)more.onclick=()=>void loadClientLookupView(clientLookupView,true);
 if(tab==="clients"){updateClientLookupControls();void loadClientLookupStats();}
 let find=document.getElementById("notesFindClient");if(find)find.onclick=()=>{tab="clients";shell();render()};
 if(tab==="phone")officePhoneWire();
}

/* Office Phone: scoped to the active manager/admin login through secure
   Postgres RPC. The frontend never holds a service-role credential. */
var officePhoneKinds=[
 ["all","All Calls"],["inbound","Inbound Answered"],["outbound","Outbound"],
 ["missed","Missed Calls"],["voicemails","Voicemails"],["texts","Text Messages"]
];
function officePhoneDay(value){
 const d=new Date(value);if(Number.isNaN(d.getTime()))return "Unknown date";
 const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const o=Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
 return o.year+"-"+o.month+"-"+o.day;
}
function officePhoneDateLabel(key){
 if(key==="Unknown date")return key;
 return new Date(key+"T12:00:00Z").toLocaleDateString("en-US",{
  timeZone:"UTC",weekday:"long",month:"long",day:"numeric",year:"numeric"
 });
}
function officePhoneTime(date){
 const d=new Date(date);if(Number.isNaN(d.getTime()))return "";
 return d.toLocaleTimeString("en-US",{timeZone:"America/Chicago",hour:"numeric",minute:"2-digit"});
}
function officePhoneCategory(row){
 if(String(row.direction).toLowerCase()==="outbound")return "outbound";
 return /missed|no answer|unanswered|abandoned|rejected|busy|voicemail/i.test(String(row.result||""))?"missed":"inbound";
}
function officePhoneItems(kind){
 let calls=officePhoneData.calls||[],voice=officePhoneData.voicemails||[],texts=officePhoneData.texts||[];
 if(kind==="texts")return texts.map(r=>({kind:"text",row:r,at:r.created_at}));
 if(kind==="voicemails")return voice.map(r=>({kind:"voicemail",row:r,at:r.received_at}));
 if(kind==="all")return [...calls.map(r=>({kind:"call",row:r,at:r.started_at})),...voice.map(r=>({kind:"voicemail",row:r,at:r.received_at}))];
 return calls.filter(r=>officePhoneCategory(r)===kind).map(r=>({kind:"call",row:r,at:r.started_at}));
}

/* Office Phone: recording access stays behind the authenticated M&M API.
   Browser never sees or stores RingCentral login credentials. */
const officePhoneMediaEndpoint="https://crm.mayerig.com/api/office-ringcentral/media";
function officePhoneDigits(number){
 const digits=String(number||"").replace(/\D/g,"");
 return digits.length>=10?digits.slice(-10):"";
}
function officePhoneSourceNumber(row,kind){
 return kind==="voicemail"?String(row.from_phone||""):
 String(row.contact_phone||((row.direction==="Inbound")?row.from_phone:row.to_phone)||"");
}
function officePhoneLimitedLookup(work){
 return new Promise((resolve,reject)=>{
  officePhoneMatchQueue.push({work,resolve,reject});
  officePhoneDrainLookup();
 });
}
function officePhoneDrainLookup(){
 while(officePhoneMatchBusy<3&&officePhoneMatchQueue.length){
  const task=officePhoneMatchQueue.shift();
  officePhoneMatchBusy++;
  Promise.resolve().then(task.work).then(task.resolve,task.reject).finally(()=>{
   officePhoneMatchBusy--;officePhoneDrainLookup();
  });
 }
}
function officePhoneLookup(number){
 const digits=officePhoneDigits(number);
 if(!digits)return Promise.resolve({matches:[],message:"No complete phone number available to match."});
 if(officePhoneMatchCache.has(digits))return officePhoneMatchCache.get(digits);
 const task=officePhoneLimitedLookup(async()=>{
  const agencies=["arctos","platinum"].filter(a=>!!connected[a]);
  if(!agencies.length)return {matches:[],message:"Agency client lookup is not connected."};
  const normalized="("+digits.slice(0,3)+") "+digits.slice(3,6)+"-"+digits.slice(6);
  const hyphen=digits.slice(0,3)+"-"+digits.slice(3,6)+"-"+digits.slice(6);
  const patterns=[digits,hyphen,normalized,digits.slice(-7)];
  const found=[],errors=[];
  await Promise.all(agencies.map(async agencyName=>{
   let matched=[];
   for(const pattern of patterns){
    try{
     const result=await request(agencyName,"search",{search:pattern});
     const clients=Array.isArray(result.clients)?result.clients:[];
     matched=clients.filter(c=>officePhoneDigits(c.phone)===digits&&c.id);
     if(matched.length)break;
    }catch(error){errors.push(agencyName+": "+String(error?.message||error));break;}
   }
   for(const c of matched)found.push({
    agency:agencyName,id:String(c.id),
    name:[c.first_name,c.last_name].filter(Boolean).join(" ").trim()||"Client"
   });
  }));
  const seen=new Set();
  const matches=found.filter(c=>{
   const key=c.agency+":"+c.id;
   if(seen.has(key))return false;
   seen.add(key);return true;
  });
  return {matches,message:errors.length?"Could not check every agency. "+errors.join("; "):""};
 });
 officePhoneMatchCache.set(digits,task);
 return task;
}
function officePhoneMatchDay(day){
 if(!day?.isConnected||!day.open)return;
 day.querySelectorAll("[data-phone-match-number]").forEach(async box=>{
  if(box.dataset.matchPending==="true"||box.dataset.matchDone==="true")return;
  box.dataset.matchPending="true";box.textContent="Checking Arctos and Platinum for a matching client…";
  try{
   const result=await officePhoneLookup(box.dataset.phoneMatchNumber);
   if(!box.isConnected)return;
   box.dataset.matchDone="true";
   const matches=result.matches||[];
   if(!matches.length){
    box.textContent=result.message||"No matching Arctos or Platinum client found.";
    return;
   }
   box.innerHTML='<span class="office-phone-match-summary">'+matches.length+
    (matches.length===1?' matching client':' matching clients')+'</span>'+
    matches.map(c=>'<button type="button" class="outline office-phone-open-client" data-phone-action="open-client" '+
      'data-phone-agency="'+esc(c.agency)+'" data-phone-client="'+esc(c.id)+'">'+
      'Open Client · '+esc(c.name)+' ('+esc(LABEL[c.agency])+') ↗</button>').join("")+
    (result.message?'<small class="muted">'+esc(result.message)+'</small>':"");
  }catch(error){
   if(box.isConnected){box.dataset.matchDone="true";box.textContent="Client matching unavailable: "+String(error?.message||error);}
  }finally{if(box.isConnected)box.dataset.matchPending="false";}
 });
}
async function officePhoneGetRecording(kind,id,again=false){
 const endpoint=officePhoneMediaEndpoint+"?kind="+encodeURIComponent(kind)+"&id="+encodeURIComponent(id);
 const response=await fetch(endpoint,{headers:{Authorization:"Bearer "+token()},cache:"no-store"});
 if(response.status===401&&!again){await refresh();return officePhoneGetRecording(kind,id,true);}
 if(!response.ok){
  const payload=await response.json().catch(()=>({}));
  throw Error(payload.error||"RingCentral recording is unavailable ("+response.status+").");
 }
 const file=await response.blob();
 if(!file.size)throw Error("RingCentral returned an empty audio file.");
 return file;
}
function officePhoneResetAudio(){
 for(const url of officePhoneAudioUrls)URL.revokeObjectURL(url);
 officePhoneAudioUrls.clear();
}

function officePhoneWire(){
 const tabs=document.getElementById("officePhoneSections"),list=document.getElementById("officePhoneRecords");
 if(!tabs||!list)return;
 tabs.addEventListener("click",e=>{
  let b=e.target.closest("[data-phone-section]");
  if(!b)return;officePhoneSection=b.dataset.phoneSection;officePhonePaint();
 });
 document.getElementById("officePhoneRefresh").addEventListener("click",()=>officePhoneLoad(true));
 list.addEventListener("click",async e=>{
  const b=e.target.closest("[data-phone-action]");if(!b)return;
  const kind=b.dataset.phoneKind,id=b.dataset.phoneId,action=b.dataset.phoneAction;
  if(action==="open-client"){
   const target=b.dataset.phoneAgency,client=b.dataset.phoneClient;
   if(!["arctos","platinum"].includes(target)||!connected[target]||!client){
    toast("The matched client is unavailable in this agency.");return;
   }
   await openClient(target,client);
   return;
  }
  if(action==="play"){
   const wrap=b.closest(".office-phone-card");
   const holder=wrap?.querySelector("[data-phone-audio]");
   if(!holder||!["call","voicemail"].includes(kind))return;
   b.disabled=true;b.textContent="Loading recording…";
   try{
    const blob=await officePhoneGetRecording(kind,id);
    if(!holder.isConnected)return;
    const url=URL.createObjectURL(blob);
    officePhoneAudioUrls.add(url);
    const audio=document.createElement("audio");
    audio.controls=true;audio.preload="metadata";audio.src=url;
    audio.setAttribute("aria-label",kind==="call"?"Call recording":"Voicemail recording");
    holder.replaceChildren(audio);
    audio.play().catch(()=>{});
   }catch(error){
    if(b.isConnected){b.disabled=false;b.textContent="▶ Play Recording";}
    toast(error.message||"Could not play the recording.");
    if(holder.isConnected)holder.querySelector("[data-phone-play-error]")?.remove();
    if(holder.isConnected){
     const p=document.createElement("p");p.className="office-phone-play-error";
     p.dataset.phonePlayError="true";p.textContent=error.message||"Playback unavailable.";
     holder.append(p);
    }
   }
   return;
  }
  if(action==="appointment"){
   const source=(kind==="call"?officePhoneData.calls:officePhoneData.voicemails).find(x=>x.id===id);
   if(!source)return;
   ocOpenAppointmentForm(undefined,source.contact_phone||source.from_phone||source.to_phone||"");
   return;
  }
  if(!["note","delete"].includes(action))return;
  const collection=kind==="call"?officePhoneData.calls:officePhoneData.voicemails;
  const item=collection.find(x=>x.id===id);if(!item)return;
  if(action==="delete"&&!confirm("Delete this "+kind+" from the Office CRM? It will stay hidden after RingCentral sync. The original RingCentral record will not be deleted."))return;
  const note=action==="note"?b.closest(".office-phone-card").querySelector("[data-phone-note]").value:"";
  b.disabled=true;
  try{
   await officePhoneRPC("office_phone_update_item",{p_kind:kind,p_id:id,p_action:action,p_note:note});
   if(action==="delete"){
    officePhoneData[kind==="call"?"calls":"voicemails"]=collection.filter(x=>x.id!==id);
    officePhonePaint();
   }else{
    item.staff_note=note.trim();toast("Note saved to phone record.");
   }
  }catch(error){toast(error.message||"Unable to save phone change.");}
  finally{if(b.isConnected)b.disabled=false;}
 });
}
async function officePhoneRPC(fn,args,once=false){
 let response=await fetch(MM_URL+"/rest/v1/rpc/"+fn,{
  method:"POST",cache:"no-store",headers:{
   "apikey":PUBLIC_KEY,"authorization":"Bearer "+token(),"Content-Type":"application/json"
  },body:JSON.stringify(args||{})
 });
 if(response.status===401&&!once){await refresh();return officePhoneRPC(fn,args,true)}
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.message||result.error||"Could not load phone data.");
 return result;
}
async function officePhoneSync(once=false){
 const response=await fetch("https://crm.mayerig.com/api/office-ringcentral/sync",{
  method:"POST",cache:"no-store",headers:headers(),signal:AbortSignal.timeout(65000)
 });
 if(response.status===401&&!once){await refresh();return officePhoneSync(true)}
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error||"RingCentral could not be synced.");
 return result;
}
async function officePhoneReadFeed(requestId){
 const result=await officePhoneRPC("office_phone_feed",{});
 if(requestId!==officePhoneRequestId)return false;
 officePhoneData={calls:Array.isArray(result.calls)?result.calls:[],
  texts:Array.isArray(result.texts)?result.texts:[],
  voicemails:Array.isArray(result.voicemails)?result.voicemails:[]};
 if(tab==="phone")officePhonePaint();
 return true;
}
async function officePhoneLoad(force=false){
 if(officePhoneLoading||tab!=="phone")return;
 officePhoneLoading=true;
 const requestId=++officePhoneRequestId;
 const statusNode=document.getElementById("officePhoneStatus");
 const button=document.getElementById("officePhoneRefresh");
 if(button)button.disabled=true;
 if(statusNode)statusNode.textContent="Loading calls, texts and voicemails from your Office CRM records…";
 try{
  if(!await officePhoneReadFeed(requestId))return;
  if(force||Date.now()-officePhoneLastSync>=5*60*1000){
   officePhoneSyncMessage="Checking RingCentral for new calls and voicemails…";
   if(tab==="phone")officePhonePaint();
   try{
    const result=await officePhoneSync();
    if(requestId!==officePhoneRequestId)return;
    officePhoneLastSync=Date.now();
    officePhoneSyncMessage=result.voicemail_warning?"Voicemail sync needs attention: "+result.voicemail_warning:
     "RingCentral checked just now · "+Number(result.voicemails||0)+" voicemails synced.";
    if(!await officePhoneReadFeed(requestId))return;
   }catch(error){
    if(requestId!==officePhoneRequestId)return;
    officePhoneSyncMessage="RingCentral sync failed: "+(error.name==="TimeoutError"?"The connection timed out. Try Refresh again.":error.message)+" Saved records are still available.";
   }
   if(tab==="phone")officePhonePaint();
  }
 }catch(error){
  if(requestId===officePhoneRequestId&&statusNode?.isConnected)statusNode.textContent="Unable to load phone activity: "+error.message;
 }finally{if(requestId===officePhoneRequestId){officePhoneLoading=false;if(button?.isConnected)button.disabled=false}}
}
function officePhonePaint(){
 officePhoneResetAudio();
 const tabs=document.getElementById("officePhoneSections"),list=document.getElementById("officePhoneRecords"),statusNode=document.getElementById("officePhoneStatus");
 if(!tabs||!list||tab!=="phone")return;
 tabs.innerHTML=officePhoneKinds.map(([key,label])=>
  '<button type="button" data-phone-section="'+key+'" class="'+(officePhoneSection===key?'active':'')+'">'+
  esc(label)+' <span>'+officePhoneItems(key).length+'</span></button>'
 ).join("");
 const items=officePhoneItems(officePhoneSection).sort((a,b)=>new Date(b.at)-new Date(a.at));
 if(statusNode)statusNode.textContent=items.length+" "+(officePhoneSection==="texts"?"messages":"phone records")+
  " available. Choose a day to open it. "+officePhoneSyncMessage;
 if(!items.length){list.innerHTML='<div class="empty">No saved records in this section yet. Refresh checks RingCentral for new calls and voicemails.</div>';return;}
 const days=new Map();
 for(const item of items){const date=officePhoneDay(item.at);if(!days.has(date))days.set(date,[]);days.get(date).push(item)}
 list.innerHTML=[...days].map(([date,items])=>
  '<details class="office-phone-day" data-phone-day="'+esc(date)+'"'+(officePhoneOpenDays.has(date)?' open':'')+'><summary><strong>'+esc(officePhoneDateLabel(date))+'</strong><span>'+
  items.length+' '+(items.length===1?'record':'records')+'</span><b aria-hidden="true">⌄</b></summary><div class="office-phone-day-body">'+
  items.map(item=>{
   const r=item.row,isText=item.kind==="text",isVoice=item.kind==="voicemail";
   const num=isText?(r.direction==="inbound"?r.from_number:r.to_number)||r.client_phone:
    isVoice?r.from_phone:r.contact_phone||r.from_phone||r.to_phone;
   const person=String(r.client_name||"").trim()||"Unknown caller";
   const type=isText?(r.direction==="inbound"?"Incoming Text":"Sent Text"):isVoice?"Voicemail":
    officePhoneCategory(r)==="outbound"?"Outbound":officePhoneCategory(r)==="missed"?"Missed Call":"Inbound Answered";
   const note=isText?'':String(r.staff_note||"");
   const canPlay=!isText&&(isVoice?!!r.audio_attachment_id:!!r.recording_id);
   const recording=isText?"":'<div class="office-phone-audio" data-phone-audio>'+
    (canPlay?'<button type="button" class="outline office-phone-play" data-phone-action="play" data-phone-kind="'+item.kind+'" data-phone-id="'+esc(r.id)+'">▶ Play '+(isVoice?'Voicemail':'Call Recording')+'</button>':
     '<small class="office-phone-no-audio">No recording attached to this '+(isVoice?'voicemail':'call')+'.</small>')+'</div>';
   const match=isText?"":'<div class="office-phone-matches" data-phone-match-number="'+esc(num||"")+'">'+
    '<small>Open this day to check for matching Arctos or Platinum clients.</small></div>';
   const actions=isText?'<p class="muted office-phone-message-status">Status: '+esc(r.status||"Received")+'</p>':
    '<div class="office-phone-actions"><button type="button" class="outline" data-phone-action="appointment" data-phone-kind="'+item.kind+'" data-phone-id="'+esc(r.id)+'">+ Appointment</button>'+
    '<button type="button" class="outline office-phone-delete" data-phone-action="delete" data-phone-kind="'+item.kind+'" data-phone-id="'+esc(r.id)+'">Delete from CRM</button></div>'+
    '<details class="office-phone-note"><summary>Notes'+(note?' • Saved':'')+'</summary><div><textarea data-phone-note rows="3" maxlength="4000" placeholder="Add a call or voicemail note…">'+esc(note)+'</textarea>'+
    '<button type="button" class="outline" data-phone-action="note" data-phone-kind="'+item.kind+'" data-phone-id="'+esc(r.id)+'">Save Note</button></div></details>';
   return '<article class="office-phone-card"><div class="office-phone-card-top"><strong>'+esc(person)+'</strong><span>'+esc(type)+'</span></div>'+
    '<div class="office-phone-meta"><span>'+esc(num||"Unknown number")+'</span><span>'+esc(officePhoneTime(item.at))+'</span>'+
    (!isText?'<span>'+esc(r.result||"")+'</span>':'')+'</div>'+
    (isText?'<p class="office-phone-text-body">'+esc(r.body||"")+'</p>':'')+
    recording+match+actions+'</article>';
  }).join("")+'</div></details>'
 ).join("");
 list.querySelectorAll(".office-phone-day").forEach(day=>{
  day.addEventListener("toggle",()=>{
   const key=day.dataset.phoneDay;
   if(day.open){officePhoneOpenDays.add(key);officePhoneMatchDay(day);}
   else officePhoneOpenDays.delete(key);
  });
  if(day.open)officePhoneMatchDay(day);
 });
}

async function loadTab(){
 if(tab==="phone"){await officePhoneLoad();return}
 if(tab==="dashboard"){await Promise.all([fetchCalendar(),fetchCampaigns()]);render();return}
 if(tab==="calendar"){calendarLoading=true;showCalendar();await fetchCalendar();showCalendar();return}
 if(tab==="campaigns"){showCampaignControls();return}
 if(tab==="leads"){showLeadControls();return}
 if(tab==="notes"){mountNotes();return}
 if(tab==="clients"){if(clientLookupView!=="search")await loadClientLookupView(clientLookupView);else if(savedSearch)await searchClients(savedSearch);}
}
function officeClientLookupMarkup(){
 const icons={deceased:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 9h14M7 21h10"/></svg>',birthdays:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M4 14h16M12 10V5M9 5a1.4 1.4 0 0 1 3 0m0 0a1.4 1.4 0 0 1 3 0"/></svg>'};
 return '<section class="office-client-lookup"><section class="client-summary-grid" aria-label="Client record filters">'+['birthdays','deceased'].map(kind=>'<button type="button" class="client-summary-card is-'+kind+'" data-office-client-view="'+kind+'" aria-expanded="false" aria-controls="clientResults" title="'+(kind==='birthdays'?'Open birthdays this month':'Open deceased client records')+'"><span class="client-summary-icon">'+icons[kind]+'</span><strong data-office-client-count="'+kind+'">—</strong><span class="client-summary-label">'+(kind==='birthdays'?'Birthdays':'Deceased Clients')+'</span></button>').join('')+'</section><p id="clientLookupStatsStatus" class="muted" role="status"></p><section class="panel"><form id="officeClientSearch" class="office-client-search"><label class="search-field"><span aria-hidden="true">⌕</span><input id="clientSearch" aria-label="Search clients" enterkeyhint="search" placeholder="Enter first name, last name, or phone…" value="'+esc(savedSearch)+'"></label><button type="submit" class="primary" id="clientSearchButton">Search</button></form><header id="clientLookupArchive" class="client-deceased-head" hidden><div><h2 id="clientLookupTitle"></h2><p id="clientLookupDescription"></p></div><button type="button" class="outline" id="clientLookupBack">← Back to Client Search</button></header><p class="muted" id="countClients" role="status">Search to find clients</p><div class="table-wrap" id="clientResults"><div class="empty">Enter at least two characters to search your client records.</div></div><div class="office-client-more"><button type="button" class="outline" id="clientLookupMore" hidden>Load More</button></div></section></section>';
}
function updateClientLookupControls(){
 const form=document.getElementById('officeClientSearch'),archive=document.getElementById('clientLookupArchive'),more=document.getElementById('clientLookupMore');if(!form||!archive)return;
 form.hidden=clientLookupView!=='search';archive.hidden=clientLookupView==='search';if(more)more.hidden=true;
 document.querySelectorAll('[data-office-client-view]').forEach(button=>button.setAttribute('aria-expanded',String(button.dataset.officeClientView===clientLookupView)));
 const title=document.getElementById('clientLookupTitle'),description=document.getElementById('clientLookupDescription');
 title.textContent=clientLookupView==='birthdays'?(clientLookupMonthLabel||new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'long',year:'numeric'}).format(new Date()))+' Birthdays':'Deceased Clients';
 description.textContent=clientLookupView==='birthdays'?'Clients celebrating birthdays this month. Deceased clients are excluded.':'Archived client records remain intact, including coverage history, documents and files.';
}
async function loadClientLookupStats(){
 const active=available(),key=active.join(',')+'|'+new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'2-digit',year:'numeric'}).format(new Date()),ticket=++clientLookupStatsTicket;
 if(clientLookupStatsCache?.key===key&&Date.now()-clientLookupStatsCache.time<30000){paintClientLookupStats(clientLookupStatsCache.data);return;}
 const results=await Promise.allSettled(active.map(a=>request(a,'client_lookup',{view:'stats'})));
 if(tab!=='clients'||ticket!==clientLookupStatsTicket||active.join(',')!==available().join(','))return;
 const data={birthdays:0,deceased:0,errors:[]};results.forEach((result,i)=>{if(result.status==='fulfilled'){data.birthdays+=Number(result.value.birthdays)||0;data.deceased+=Number(result.value.deceased)||0;clientLookupMonthLabel=result.value.month_label||clientLookupMonthLabel;}else data.errors.push(LABEL[active[i]]);});
 if(!data.errors.length)clientLookupStatsCache={key,time:Date.now(),data};paintClientLookupStats(data);
}
function paintClientLookupStats(data){
 for(const key of ['birthdays','deceased']){const count=document.querySelector('[data-office-client-count="'+key+'"]');if(count)count.textContent=data.errors.length?data[key]+'+':String(data[key]);}
 const message=document.getElementById('clientLookupStatsStatus');if(message)message.textContent=data.errors.length?'Counts are unavailable for '+data.errors.join(' and ')+'. Open a list to retry.':'';
}
function returnToClientSearch(){clientLookupView='search';clientLookupController?.abort();clientLookupTicket++;updateClientLookupControls();void searchClients(document.getElementById('clientSearch')?.value||savedSearch);}
function paintClientLookupRows(error=''){
 const element=document.getElementById('clientResults');if(!element)return;
 const sorted=clients.slice().sort((a,b)=>(clientLookupView==='birthdays'?Number(a.birthday_day||String(a.date_of_birth||'').slice(-2))-Number(b.birthday_day||String(b.date_of_birth||'').slice(-2)):0)||String(a.last_name||'').localeCompare(String(b.last_name||''))||String(a.first_name||'').localeCompare(String(b.first_name||'')));
 const html=clientLookupView==='birthdays'?'<div class="client-birthday-list">'+sorted.map(c=>'<div class="client-birthday-row"><button type="button" class="client-birthday-client" data-client="'+esc(c.agency)+':'+esc(c.id)+'"><span class="birthday-day">'+esc(c.birthday_day||String(c.date_of_birth||'').slice(-2))+'</span><span class="birthday-client-name"><strong>'+esc([c.first_name,c.last_name].filter(Boolean).join(' ')||'Client')+'</strong><small>'+esc(c.phone||'No phone saved')+'</small></span>'+tag(c.agency)+'<span class="birthday-arrow" aria-hidden="true">›</span></button></div>').join('')+'</div>':'<table class="data-table"><thead><tr><th>Client</th><th>Agency</th><th>Agent</th><th>Phone</th><th>Status</th><th></th></tr></thead><tbody>'+sorted.map(c=>'<tr><td><b>'+esc([c.first_name,c.last_name].filter(Boolean).join(' '))+'</b><div class="muted">'+esc(c.city||'')+'</div></td><td>'+tag(c.agency)+'</td><td>'+esc(AGENT[c.agency])+'</td><td>'+esc(c.phone||'')+'</td><td>'+status(c.status)+'</td><td><button class="link-btn" data-client="'+esc(c.agency)+':'+esc(c.id)+'">Open →</button></td></tr>').join('')+'</tbody></table>';
 element.innerHTML=(clients.length?html:'<div class="empty">'+(clientLookupView==='birthdays'?'No clients with birthdays this month.':clientLookupView==='deceased'?'No deceased clients found.':'No matching records found.')+'</div>')+(error?'<div class="auth-warn" role="alert">'+esc(error)+'</div>':'');
 element.querySelectorAll('[data-client]').forEach(button=>button.onclick=()=>{const [agency,id]=button.dataset.client.split(':');void openClient(agency,id);});
 const count=document.getElementById('countClients');if(count){const total=Object.values(clientLookupPaging).reduce((sum,page)=>sum+(page.total||0),0);count.textContent=clientLookupView==='search'?clients.length+' matching clients':clients.length+(total>clients.length?' of '+total:'')+(clientLookupView==='birthdays'?' birthday clients':' deceased clients');}
 const more=document.getElementById('clientLookupMore');if(more){more.hidden=clientLookupView==='search'||!Object.values(clientLookupPaging).some(page=>page.failed||page.offset<page.total);more.disabled=false;more.textContent=Object.values(clientLookupPaging).some(page=>page.failed)?'Retry / Load More':'Load More';}
}
async function loadClientLookupView(view,append=false){
 if(!append)void loadClientLookupStats();
 if(!['birthdays','deceased'].includes(view))return;clearTimeout(window.searchTimeout);clientLookupController?.abort();clientLookupController=new AbortController();const signal=clientLookupController.signal,ticket=++clientLookupTicket;
 clientLookupView=view;updateClientLookupControls();const element=document.getElementById('clientResults');if(!element||tab!=='clients')return;
 if(!append){clients=[];clientLookupPaging={};element.innerHTML='<div class="loading-state">Loading '+(view==='birthdays'?'birthdays':'deceased clients')+'…</div>';}
 const active=available().filter(a=>!append||!clientLookupPaging[a]||clientLookupPaging[a].failed||clientLookupPaging[a].offset<clientLookupPaging[a].total),problems=[];
 const results=await Promise.allSettled(active.map(a=>request(a,'client_lookup',{view,offset:append?clientLookupPaging[a]?.offset||0:0,limit:200},false,{signal})));
 if(signal.aborted||ticket!==clientLookupTicket||tab!=='clients'||clientLookupView!==view)return;
 results.forEach((result,i)=>{const a=active[i];if(result.status==='fulfilled'){const rows=result.value.clients||[],previous=append?clientLookupPaging[a]?.offset||0:0;clientLookupPaging[a]={offset:previous+rows.length,total:result.value.total||0,failed:false};clientLookupMonthLabel=result.value.month_label||clientLookupMonthLabel;for(const c of rows)if(!clients.some(row=>row.id===c.id&&row.agency===a))clients.push({...c,agency:a});}else{clientLookupPaging[a]={...(clientLookupPaging[a]||{offset:0,total:0}),failed:true};problems.push(LABEL[a]+': '+result.reason.message);}});
 updateClientLookupControls();paintClientLookupRows(problems.join('; '));
}
async function searchClients(s){
 clearTimeout(window.searchTimeout);savedSearch=s;clientLookupView='search';clientLookupController?.abort();clientLookupController=new AbortController();const signal=clientLookupController.signal,ticket=++clientLookupTicket;
 updateClientLookupControls();const element=document.getElementById('clientResults');if(!element||tab!=='clients')return;
 if(s.trim().length<2){clients=[];element.innerHTML='<div class="empty">Enter at least two characters.</div>';document.getElementById('countClients').textContent='Search to find clients';return;}
 element.innerHTML='<div class="loading-state">Searching authorized agency records…</div>';const active=available();
 const results=await Promise.allSettled(active.map(a=>request(a,'search',{search:s,exclude_deceased:true},false,{signal})));
 if(signal.aborted||ticket!==clientLookupTicket||!document.getElementById('clientResults')||tab!=='clients'||s!==savedSearch)return;
 clients=results.flatMap((r,i)=>r.status==='fulfilled'?(r.value.clients||[]).map(c=>({...c,agency:active[i]})):[]);clientLookupPaging={};paintClientLookupRows(results.filter(r=>r.status==='rejected').map(r=>r.reason.message).join('; '));
}

/* Office Calendar: local-date handling keeps date-only appointments on the right day. */
function ocISO(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function ocDate(v){if(v instanceof Date)return new Date(v.getFullYear(),v.getMonth(),v.getDate());let s=String(v||"");let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3])):new Date()}
function ocAdd(d,n){let v=ocDate(d);v.setDate(v.getDate()+n);return v}
function ocWeekStart(d){return ocAdd(d,-d.getDay())}
function ocRange(){
 const d=ocDate(calendarDate);
 if(calendarView==="day")return {start:d,end:d};
 if(calendarView==="week")return {start:ocWeekStart(d),end:ocAdd(ocWeekStart(d),6)};
 let first=new Date(d.getFullYear(),d.getMonth(),1),last=new Date(d.getFullYear(),d.getMonth()+1,0);
 return {start:ocWeekStart(first),end:ocAdd(last,6-last.getDay())};
}
function ocEventDate(a){
 if(a.event_date){let s=String(a.event_date);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10)}
 if(a.starts_at){let d=new Date(a.starts_at);if(!Number.isNaN(d.getTime()))return ocISO(d)}
 return "";
}
function ocEventMinutes(a){
 let s=String(a.start_time||"").trim();
 let m=s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
 if(m){let h=Number(m[1]);if(m[3])h=(h%12)+(m[3].toUpperCase()==="PM"?12:0);return h*60+Number(m[2])}
 if(a.starts_at){let d=new Date(a.starts_at);if(!Number.isNaN(d.getTime()))return d.getHours()*60+d.getMinutes()}
 return 9*60;
}
function ocEventTime(a){
 let mins=ocEventMinutes(a),hour=Math.floor(mins/60),minute=mins%60;
 return (hour%12||12)+":"+String(minute).padStart(2,"0")+(hour<12?" AM":" PM");
}
function ocEvents(date){
 let k=ocISO(date);
 return appointments.filter(a=>ocEventDate(a)===k).sort((a,b)=>ocEventMinutes(a)-ocEventMinutes(b));
}
function ocChip(a,compact=false){
 const id=appointments.indexOf(a),label=String(a.title||a.client_name||"Appointment");
 return '<button type="button" class="oc-event '+esc(a.agency||"office")+(compact?' compact':'')+'" data-cal-event="'+id+'" title="'+esc((LABEL[a.agency]||a.agency)+" · "+(AGENT[a.agency]||"")+" · "+ocEventTime(a)+" · "+label)+'" aria-label="'+esc(ocEventTime(a)+" "+label+" for "+(AGENT[a.agency]||LABEL[a.agency]||"staff"))+'"><span class="oc-event-time">'+esc(ocEventTime(a))+'</span><span class="oc-event-title">'+esc(label)+'</span></button>';
}
function ocLongDate(d,options){return d.toLocaleDateString("en-US",options)}
function ocTitle(){
 const d=ocDate(calendarDate);
 if(calendarView==="month")return ocLongDate(d,{month:"long",year:"numeric"});
 if(calendarView==="day")return ocLongDate(d,{weekday:"long",month:"long",day:"numeric",year:"numeric"});
 const r=ocRange(),sameMonth=r.start.getMonth()===r.end.getMonth(),sameYear=r.start.getFullYear()===r.end.getFullYear();
 if(sameMonth)return ocLongDate(r.start,{month:"long",day:"numeric"})+"–"+r.end.getDate()+", "+r.end.getFullYear();
 return ocLongDate(r.start,{month:"short",day:"numeric",year:sameYear?undefined:"numeric"})+" – "+ocLongDate(r.end,{month:"short",day:"numeric",year:"numeric"});
}
function ocMonthMarkup(){
 const range=ocRange(),today=ocISO(new Date()),currentMonth=calendarDate.getMonth();
 let html='<div class="oc-scroll"><div class="oc-month"><div class="oc-days-header">'+["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(s=>'<div>'+s+'</div>').join("")+'</div><div class="oc-month-grid">';
 for(let d=ocDate(range.start);d<=range.end;d=ocAdd(d,1)){
  const date=ocISO(d),all=ocEvents(d),inMonth=d.getMonth()===currentMonth;
  html+='<div class="oc-date-cell'+(!inMonth?' oc-outside':'')+(date===today?' oc-today':'')+'" data-cal-cell="'+date+'"><button type="button" class="oc-date-number" data-cal-date="'+date+'" aria-label="Open '+esc(ocLongDate(d,{month:"long",day:"numeric",year:"numeric"}))+'">'+d.getDate()+'</button><div class="oc-date-events">'+all.slice(0,3).map(a=>ocChip(a,true)).join("")+(all.length>3?'<button type="button" class="oc-more" data-cal-date="'+date+'">+'+(all.length-3)+' more</button>':'')+'</div></div>';
 }
 return html+'</div></div></div>';
}
function ocHours(){
 const minutes=appointments.map(ocEventMinutes);
 const min=Math.min(8,...minutes.map(v=>Math.floor(v/60)));
 const max=Math.max(20,...minutes.map(v=>Math.floor(v/60)));
 let hours=[];for(let h=Math.max(0,min);h<=Math.min(23,max);h++)hours.push(h);
 return hours;
}
function ocHourLabel(h){return (h%12||12)+(h<12?" AM":" PM")}
function ocWeekMarkup(){
 const range=ocRange(),today=ocISO(new Date()),days=Array.from({length:7},(_,i)=>ocAdd(range.start,i));
 let html='<div class="oc-scroll"><div class="oc-week-grid"><div class="oc-corner">Time</div>'+days.map(d=>'<button type="button" class="oc-week-head'+(ocISO(d)===today?' oc-today':'')+'" data-cal-date="'+ocISO(d)+'"><span>'+ocLongDate(d,{weekday:"short"})+'</span><strong>'+d.getDate()+'</strong></button>').join("");
 for(const h of ocHours()){
  html+='<div class="oc-hour">'+ocHourLabel(h)+'</div>';
  for(const day of days){
   const events=ocEvents(day).filter(a=>Math.floor(ocEventMinutes(a)/60)===h);
   html+='<div class="oc-week-slot'+(ocISO(day)===today?' oc-current-day':'')+'">'+events.map(a=>ocChip(a)).join("")+'</div>';
  }
 }
 return html+'</div></div>';
}
function ocDayMarkup(){
 const d=ocDate(calendarDate),eventList=ocEvents(d);
 let html='<div class="oc-day-header">'+ocLongDate(d,{weekday:"long",month:"short",day:"numeric"})+'<div class="oc-day-summary"><span>'+eventList.length+' appointment'+(eventList.length===1?'':'s')+'</span><button type="button" class="oc-day-popup-btn" data-cal-date="'+ocISO(d)+'">View daily appointments ▸</button></div></div><div class="oc-day-grid">';
 for(const h of ocHours()){
  const events=eventList.filter(a=>Math.floor(ocEventMinutes(a)/60)===h);
  html+='<div class="oc-day-hour">'+ocHourLabel(h)+'</div><div class="oc-day-slot">'+events.map(a=>ocChip(a)).join("")+'</div>';
 }
 return html+'</div>';
}
function ocDetails(a){
 const dialog=document.getElementById("dialog");if(!dialog||!a)return;
 dialog.dataset.dayPopup="";
 const date=ocEventDate(a),day=date?ocDate(date):new Date();
 dialog.innerHTML='<section class="modal-card oc-detail" role="dialog" aria-modal="true" aria-label="Appointment details"><button type="button" class="close-button" id="ocCloseDetails" aria-label="Close">×</button><div class="eyebrow">APPOINTMENT DETAILS</div><h2>'+esc(a.title||a.client_name||"Appointment")+'</h2><div class="oc-detail-line"><b>When</b><span>'+esc(ocLongDate(day,{weekday:"long",month:"long",day:"numeric",year:"numeric"})+" at "+ocEventTime(a))+'</span></div><div class="oc-detail-line"><b>Agency</b><span>'+tag(a.agency)+'</span></div><div class="oc-detail-line"><b>Agent</b><span>'+esc(AGENT[a.agency]||"Staff")+'</span></div><div class="oc-detail-line"><b>Status</b><span>'+status(a.status)+'</span></div><p class="muted">This appointment is shown directly from the agency or Office Staff calendar. To edit an existing appointment, use the agency CRM.</p></section>';
 document.getElementById("ocCloseDetails").onclick=()=>{dialog.innerHTML=""};
 dialog.onclick=e=>{if(e.target===dialog)dialog.innerHTML=""};
}
function ocNavigate(action){
 if(action==="today")calendarDate=ocDate(new Date());
 else if(action==="prev"||action==="next"){
  let amount=action==="prev"?-1:1,d=ocDate(calendarDate);
  if(calendarView==="month")calendarDate=new Date(d.getFullYear(),d.getMonth()+amount,1);
  else calendarDate=ocAdd(d,amount*(calendarView==="week"?7:1));
 }
 calendarLoading=true;showCalendar();fetchCalendar().then(()=>showCalendar());
}

/* Daily appointment popup: separate, initially collapsed accordion for each agency. */
async function ocOpenDay(date){
 const day=ocDate(date),key=ocISO(day),dialog=document.getElementById("dialog");
 if(!dialog)return;
 dialog.dataset.dayPopup=key;
 const scopes=[
  {id:"arctos",name:"Arctos",person:"Justin",enabled:!!connected.arctos},
  {id:"platinum",name:"Platinum Financial",person:"Isaiah",enabled:!!connected.platinum},
  {id:"office",name:"Office Staff",person:"Sheena",enabled:!!connected.office}
 ];
 const markup=scopes.map(s=>{
  const msg=!s.enabled?"Calendar connection unavailable.":"Loading appointments…";
  return '<details class="oc-agency-section '+s.id+'" data-oc-agency="'+s.id+'"><summary><span class="oc-agency-title"><i class="oc-agency-marker '+s.id+'" aria-hidden="true"></i><b>'+esc(s.name)+'</b><small>'+esc(s.person)+'</small></span><span class="oc-agency-right"><span class="oc-agency-count" data-oc-count="'+s.id+'">'+(s.enabled?"Loading":"Unavailable")+'</span><span class="oc-chevron" aria-hidden="true">⌄</span></span></summary><div class="oc-agency-body" data-oc-body="'+s.id+'"><p class="oc-empty">'+esc(msg)+'</p></div></details>';
 }).join("");
 dialog.innerHTML='<section class="modal-card oc-day-popup" role="dialog" aria-modal="true" aria-label="Daily appointments for '+esc(ocLongDate(day,{month:"long",day:"numeric",year:"numeric"}))+'"><header class="oc-popup-header"><div><div class="eyebrow">OFFICE APPOINTMENTS</div><h2>'+esc(ocLongDate(day,{weekday:"long",month:"long",day:"numeric",year:"numeric"}))+'</h2><p>Choose an agency to see that day’s appointments.</p></div><button type="button" class="close-button" id="ocCloseDayPopup" aria-label="Close appointments">×</button></header><div class="oc-popup-groups">'+markup+'</div><footer class="oc-popup-actions"><button type="button" class="primary" id="ocScheduleDay">Set Appointment</button><button type="button" class="outline" id="ocShowFullDay">Open full day calendar</button></footer></section>';
 const close=()=>{dialog.dataset.dayPopup="";dialog.innerHTML=""};
 document.getElementById("ocCloseDayPopup").onclick=close;
 dialog.onclick=e=>{if(e.target===dialog)close()};
 document.getElementById("ocScheduleDay").onclick=()=>ocOpenAppointmentForm(key);
 document.getElementById("ocShowFullDay").onclick=()=>{
  close();calendarDate=day;calendarView="day";calendarLoading=true;showCalendar();fetchCalendar().then(showCalendar);
 };
 dialog.__dayAppts={};
 for(const s of scopes){
  if(!s.enabled)continue;
  const result=await Promise.resolve().then(()=>(s.id==="office"?requestSchedule("office","appointments",{from:key,to:key}):request(s.id,"appointments",{from:key,to:key}))).then(v=>({ok:true,appointments:v.appointments})).catch(e=>({ok:false,error:e?.message||"Unable to load appointments"}));
  if(dialog.dataset.dayPopup!==key||!dialog.querySelector(".oc-day-popup"))return;
  const body=dialog.querySelector('[data-oc-body="'+s.id+'"]');
  const count=dialog.querySelector('[data-oc-count="'+s.id+'"]');
  if(!body||!count)continue;
  if(!result.ok){
   count.textContent="Load failed";
   body.innerHTML='<p class="oc-popup-error">Could not load '+esc(s.name)+' appointments: '+esc(result.error)+'</p>';
   continue;
  }
  const items=(Array.isArray(result.appointments)?result.appointments:[]).map(a=>({...a,agency:s.id})).sort((a,b)=>ocEventMinutes(a)-ocEventMinutes(b));
  dialog.__dayAppts[s.id]=items;
  count.textContent=items.length+" appointment"+(items.length===1?"":"s");
  if(!items.length){body.innerHTML='<p class="oc-empty">No appointments scheduled for this day.</p>';continue}
  body.innerHTML=items.map((a,i)=>'<button type="button" class="oc-popup-appointment '+s.id+'" data-popup-event="'+s.id+':'+i+'"><span class="oc-popup-time">'+esc(ocEventTime(a))+'</span><span class="oc-popup-title">'+esc(a.title||a.client_name||"Appointment")+'</span><span class="oc-popup-status">'+esc(a.status||"Scheduled")+'</span></button>').join("");
  body.querySelectorAll("[data-popup-event]").forEach(btn=>btn.onclick=()=>{
   const [who,pos]=btn.dataset.popupEvent.split(":");
   const event=dialog.__dayAppts?.[who]?.[Number(pos)]; if(event)ocDetails(event);
  });
 }
}

async function fetchCalendar(){
 const id=++calendarRequestId,scope=tab==="calendar"?ocRange():{start:ocAdd(new Date(),-7),end:ocAdd(new Date(),50)};
 const active=available();
 if(tab==="calendar"){calendarLoading=true;showCalendar()}
 const [result,staffResult]=await Promise.all([Promise.allSettled(active.map(a=>request(a,"appointments",{from:ocISO(scope.start),to:ocISO(scope.end)}))),(connected.office&&agency==="all")?requestSchedule("office","appointments",{from:ocISO(scope.start),to:ocISO(scope.end)}).then(v=>({ok:true,data:v})).catch(e=>({ok:false,error:e.message})):Promise.resolve(null)]);
 if(id!==calendarRequestId)return;
 calendarErrors=result.map((r,i)=>r.status==="rejected"?LABEL[active[i]]+": "+String(r.reason&&r.reason.message||"Could not load"):null).filter(Boolean);
 appointments=result.flatMap((r,i)=>r.status==="fulfilled"&&Array.isArray(r.value.appointments)?r.value.appointments.map(x=>({...x,agency:active[i]})):[]);
 if(staffResult?.ok&&Array.isArray(staffResult.data.appointments)) appointments.push(...staffResult.data.appointments.map(a=>({...a,agency:"office"})));
 if(staffResult&&!staffResult.ok)calendarErrors.push("Office Staff: "+staffResult.error);
 appointments.sort((a,b)=>(ocEventDate(a)+String(ocEventMinutes(a)).padStart(4,"0")).localeCompare(ocEventDate(b)+String(ocEventMinutes(b)).padStart(4,"0")));
 calendarLoading=false;calendarLoaded=true;
}
function showCalendar(){
 const target=document.getElementById("calendarResults");if(!target||tab!=="calendar")return;
 const legend='<div class="calendar-legend" aria-label="Appointment agency colors"><span class="legend-item"><i class="legend-dot arctos" aria-hidden="true"></i> Arctos — Justin</span><span class="legend-item"><i class="legend-dot platinum" aria-hidden="true"></i> Platinum Financial — Isaiah</span><span class="legend-item"><i class="legend-dot office" aria-hidden="true"></i> Office Staff — Sheena</span></div>';
 const toolbar='<div class="oc-toolbar"><div class="oc-nav"><button type="button" class="oc-icon-btn" data-cal-nav="prev" aria-label="Previous '+calendarView+'">‹</button><button type="button" class="oc-icon-btn" data-cal-nav="next" aria-label="Next '+calendarView+'">›</button><button type="button" class="oc-today-btn" data-cal-nav="today">Today</button><h2>'+esc(ocTitle())+'</h2></div><div class="oc-view-tabs" role="group" aria-label="Calendar view">'+["month","week","day"].map(v=>'<button type="button" data-cal-view="'+v+'" class="'+(calendarView===v?'active':'')+'" aria-pressed="'+(calendarView===v?'true':'false')+'">'+v[0].toUpperCase()+v.slice(1)+'</button>').join("")+'</div></div>';
 let content;
 if(calendarLoading)content='<div class="loading-state">Loading '+esc(calendarView)+' appointments…</div>';
 else if(!available().length)content='<div class="empty">No authorized agency calendar is connected.</div>';
 else content=(calendarView==="month"?ocMonthMarkup():calendarView==="week"?ocWeekMarkup():ocDayMarkup());
 const warning=calendarErrors.length&&!calendarLoading?'<div class="oc-fetch-warning" role="status">Some appointments could not be loaded: '+esc(calendarErrors.join(" · "))+'</div>':'';
 const sourceCounts=!calendarLoading&&available().length?'<div class="oc-source-counts" aria-label="Appointments loaded from each agency">'+["arctos","platinum","office"].filter(k=>(agency==="all"||agency===k)&&connected[k]).map(k=>'<span class="oc-source-count '+k+'">'+esc(LABEL[k])+": "+appointments.filter(a=>a.agency===k).length+' in view</span>').join("")+'</div>':"";
 target.innerHTML=toolbar+legend+warning+sourceCounts+content;
 target.querySelectorAll("[data-cal-nav]").forEach(btn=>btn.onclick=()=>ocNavigate(btn.dataset.calNav));
 target.querySelectorAll("[data-cal-view]").forEach(btn=>btn.onclick=()=>{calendarView=btn.dataset.calView;calendarLoading=true;showCalendar();fetchCalendar().then(()=>showCalendar())});
 target.querySelectorAll("[data-cal-date]").forEach(btn=>btn.onclick=()=>ocOpenDay(btn.dataset.calDate));
 target.querySelectorAll("[data-cal-cell]").forEach(cell=>cell.addEventListener("click",e=>{
  if(e.target.closest("[data-cal-date],[data-cal-event]"))return;
  ocOpenDay(cell.dataset.calCell);
 }));
 target.querySelectorAll("[data-cal-event]").forEach(btn=>btn.onclick=()=>ocDetails(appointments[Number(btn.dataset.calEvent)]));
}
async function fetchCampaigns(){
 let active=available(),res=await Promise.allSettled(active.map(a=>request(a,"campaigns")));
 campaigns=res.flatMap((r,i)=>r.status==="fulfilled"?r.value.campaigns.map(x=>({...x,agency:active[i]})):[]);
}



function mountNotes(){
 const el=document.getElementById("noteWorkspace");if(!el)return;
 el.innerHTML='<div class="office-note-tabs"><button type="button" class="selected" data-notetab="agency">Agency Notes</button><button type="button" data-notetab="personal">My Office Notes</button></div><div id="noteControls"></div><p id="noteMessage" class="muted" role="status"></p><div id="noteList"></div>';
 const controls=el.querySelector("#noteControls"),message=el.querySelector("#noteMessage"),list=el.querySelector("#noteList");
 const say=m=>message.textContent=m;
 const source={arctos:"https://bogusfmvdrlvxscopgaw.supabase.co",platinum:"https://sggzshbdfgkyyvxbebul.supabase.co"};
 let mode="agency",agency="",selectedAgent="",agents=[],notes=[],personal=[],owner=null,editId="",req=0;
 const safeDate=d=>d?new Date(d).toLocaleDateString("en-US"):"";
 const noteHTML=(n,privateNote)=>'<article class="oc-note-entry"><details><summary><b>'+esc(privateNote?String(n.title||"").replace(/^Office CRM: /,""):n.title||"Note")+'</b><small>'+esc(safeDate(n.updated_at||n.created_at))+'　⌄</small></summary><div class="oc-note-text">'+esc(n.body||"")+(n.client_name?'<p class="oc-note-client">Client: '+esc(n.client_name)+'</p>':"")+'</div></details>'+(privateNote?'<div class="oc-note-buttons"><button type="button" data-noteedit="'+esc(n.id)+'">Edit</button><button type="button" data-notedelete="'+esc(n.id)+'">Delete</button></div>':"")+'</article>';
 async function agencyAPI(s,id){
  let r=await fetch(source[s]+"/functions/v1/office-agent-notes",{method:"POST",headers:headers(),body:JSON.stringify({agent_id:id}),cache:"no-store"});
  let j=await r.json().catch(()=>({error:"Invalid response"}));if(!r.ok)throw Error(j.error||"Unable to load notes");return j;
 }
 async function mmAPI(path,method,body){
  const h={apikey:PUBLIC_KEY,authorization:"Bearer "+token(),accept:"application/json"};
  if(body){h["content-type"]="application/json";h.Prefer="return=representation"}
  const r=await fetch(MM_URL+"/rest/v1/"+path,{method:method||"GET",headers:h,body:body?JSON.stringify(body):undefined,cache:"no-store"});
  const j=await r.json().catch(()=>null);if(!r.ok)throw Error(j?.message||j?.error||"Office note request failed");return j;
 }
 async function who(){
  if(owner)return owner;
  const id=access?.user?.id;if(!id)throw Error("Please sign in again");
  const records=await mmAPI("profiles?"+new URLSearchParams({select:"id,agency_id",id:"eq."+id,limit:"1"}));
  if(!records?.[0]?.agency_id)throw Error("Office profile not found");owner=records[0];return owner;
 }
 function showAgency(){
  list.innerHTML=notes.length?notes.map(n=>noteHTML(n,false)).join(""):'<div class="empty">No notes found for this agent.</div>';
 }
 async function getPersonal(){
  say("Loading your office notes…");list.innerHTML="";
  try{
   const u=await who();
   personal=await mmAPI("dashboard_notes?"+new URLSearchParams({select:"id,title,body,created_at,updated_at",owner_id:"eq."+u.id,title:"like.Office CRM: %",order:"updated_at.desc",limit:"200"}));
   list.innerHTML=personal.length?personal.map(n=>noteHTML(n,true)).join(""):'<div class="empty">You have no saved office notes yet.</div>';
   list.querySelectorAll("[data-noteedit]").forEach(b=>b.onclick=()=>editNote(b.dataset.noteedit));
   list.querySelectorAll("[data-notedelete]").forEach(b=>b.onclick=()=>deleteNote(b.dataset.notedelete));
   say(personal.length+" saved office notes.");
  }catch(e){say("Cannot load office notes: "+e.message)}
 }
 function clearForm(){
  editId="";const f=controls.querySelector("form");if(f){f.reset();f.querySelector("[type=submit]").textContent="Save Office Note";f.querySelector("[data-notecancel]").hidden=true}
 }
 function editNote(id){
  let n=personal.find(v=>v.id===id),f=controls.querySelector("form");if(!n||!f)return;
  editId=id;f.elements.title.value=n.title.replace(/^Office CRM: /,"");f.elements.body.value=n.body;
  f.querySelector("[type=submit]").textContent="Update Office Note";f.querySelector("[data-notecancel]").hidden=false;f.scrollIntoView({behavior:"smooth"});
 }
 async function deleteNote(id){
  if(!window.confirm("Delete this office note?"))return;
  try{let u=await who();await mmAPI("dashboard_notes?"+new URLSearchParams({id:"eq."+id,owner_id:"eq."+u.id}),"DELETE");await getPersonal();say("Office note deleted.");if(editId===id)clearForm()}catch(e){say("Delete failed: "+e.message)}
 }
 function agencyControls(){
  controls.innerHTML='<div class="oc-campaign-pickers"><div class="oc-campaign-picker"><label>Agency</label><select id="officeNotesAgency"><option value="">Select agency</option>'+["arctos","platinum"].filter(x=>connected[x]).map(x=>'<option value="'+x+'">'+esc(LABEL[x])+'</option>').join("")+'</select></div><div class="oc-campaign-picker"><label>Agent</label><select id="officeNotesAgent" disabled><option value="">Choose agency first</option></select></div></div>';
  const ag=controls.querySelector("#officeNotesAgency"),person=controls.querySelector("#officeNotesAgent");
  ag.onchange=async()=>{
   const n=++req;agency=ag.value;selectedAgent="";notes=[];showAgency();person.disabled=true;person.innerHTML='<option value="">Loading agents…</option>';say("Loading agents…");
   if(!agency){person.innerHTML='<option value="">Choose agency first</option>';say("Choose an agency and agent.");return}
   try{const data=await request(agency,"lead_agents");if(n!==req)return;agents=data.agents||[];person.innerHTML='<option value="">Choose agent</option>'+agents.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>').join("");person.disabled=false;say("Select an agent.");}catch(e){if(n===req)say("Could not load agents: "+e.message)}
  };
  person.onchange=async()=>{
   selectedAgent=person.value;const n=++req;if(!selectedAgent){notes=[];showAgency();return}
   say("Loading agency notes…");list.innerHTML="";
   try{const data=await agencyAPI(agency,selectedAgent);if(n!==req)return;notes=data.notes||[];showAgency();say(notes.length+" saved notes in "+LABEL[agency]+(data.truncated?" (recent only)":"")+".");}catch(e){if(n===req)say("Unable to load notes: "+e.message)}
  };
  say("Select an agency and agent to see saved notes.");list.innerHTML="";
 }
 function personalControls(){
  controls.innerHTML='<p class="muted">Private office notes saved to your signed-in account, separate from agency records.</p><form id="privateOfficeNotes"><label class="field">Note Title<input name="title" maxlength="145" required></label><label class="field">Note<textarea name="body" rows="6" maxlength="8000" required></textarea></label><div class="oc-note-buttons"><button type="button" data-notecancel hidden>Cancel Edit</button><button type="submit" class="primary">Save Office Note</button></div></form><h2>My Saved Notes</h2>';
  const f=controls.querySelector("form");f.querySelector("[data-notecancel]").onclick=clearForm;
  f.onsubmit=async e=>{
   e.preventDefault();const btn=f.querySelector("[type=submit]");btn.disabled=true;
   try{
    const u=await who(),val={title:"Office CRM: "+f.elements.title.value.trim().slice(0,145),body:f.elements.body.value.trim().slice(0,8000)};
    if(!val.body||val.title==="Office CRM: ")throw Error("Title and note are required");
    if(editId)await mmAPI("dashboard_notes?"+new URLSearchParams({id:"eq."+editId,owner_id:"eq."+u.id}),"PATCH",val);
    else await mmAPI("dashboard_notes","POST",{...val,owner_id:u.id,agency_id:u.agency_id});
    clearForm();await getPersonal();say("Office note saved.");
   }catch(e){say("Save failed: "+e.message)}finally{btn.disabled=false}
  };
  getPersonal();
 }
 el.querySelectorAll("[data-notetab]").forEach(b=>b.onclick=()=>{
  if(mode===b.dataset.notetab)return;mode=b.dataset.notetab;req++;
  el.querySelectorAll("[data-notetab]").forEach(t=>t.classList.toggle("selected",t===b));
  mode==="agency"?agencyControls():personalControls();
 });
 agencyControls();
}

function resetLeadPicker(){
 leadRequestId++;
 leadAgency="";leadAgent="";leadAgents=[];leadResults=[];leadLoading=false;leadError="";
}
function showLeadControls(){
 if(tab!=="leads")return;
 const agencySelect=document.getElementById("leadAgency"),agentSelect=document.getElementById("leadAgent"),output=document.getElementById("leadResults");
 if(!agencySelect||!agentSelect||!output)return;
 agencySelect.value=leadAgency;
 agentSelect.disabled=!leadAgency||leadLoading&&!leadAgents.length||!!leadError||!leadAgents.length;
 const options=leadAgents.map(a=>'<option value="'+esc(a.id)+'"'+(leadAgent===a.id?' selected':'')+'>'+esc(a.full_name||"Agent")+'</option>').join("");
 agentSelect.innerHTML='<option value="">'+(!leadAgency?"Choose an agency first":leadLoading&&!leadAgents.length?"Loading agents…":leadError?"Agents unavailable":!leadAgents.length?"No active agents found":"Choose an agent")+'</option>'+options;
 if(leadAgent&&leadAgents.some(a=>a.id===leadAgent))agentSelect.value=leadAgent;else agentSelect.value="";
 if(leadError){output.innerHTML='<div class="oc-campaign-warning" role="alert">'+esc(leadError)+'</div>';return}
 if(leadLoading){output.innerHTML='<div class="loading-state">'+esc(leadAgent?"Loading selected agent’s leads…":"Loading agents…")+'</div>';return}
 if(!leadAgency){output.innerHTML='<div class="empty">Choose an agency, then an agent to view their leads.</div>';return}
 if(!leadAgents.length){output.innerHTML='<div class="empty">No active agents are available for this agency.</div>';return}
 if(!leadAgent){output.innerHTML='<div class="empty">Now choose an agent to see their leads.</div>';return}
 showLeads();
}
async function chooseLeadAgency(value){
 const which=connected[value]&&["arctos","platinum"].includes(value)?value:"";
 const callId=++leadRequestId;
 leadAgency=which;leadAgent="";leadAgents=[];leadResults=[];leadError="";leadLoading=!!which;
 showLeadControls();
 if(!which)return;
 try{
  const data=await request(which,"lead_agents");
  if(callId!==leadRequestId||tab!=="leads")return;
  leadAgents=(Array.isArray(data.agents)?data.agents:[]).filter(a=>a&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(a.id))&&a.full_name);
 }catch(e){
  if(callId!==leadRequestId||tab!=="leads")return;
  leadError="Unable to retrieve agents for "+LABEL[which]+": "+(e.message||"Try again");
 }
 if(callId!==leadRequestId||tab!=="leads")return;
 leadLoading=false;
 showLeadControls();
}
async function chooseLeadAgent(value){
 const person=leadAgents.find(a=>a.id===value);
 const callId=++leadRequestId;
 leadAgent=person?person.id:"";leadResults=[];leadLoading=!!person;leadError="";
 const which=leadAgency;
 showLeadControls();
 if(!person||!connected[which])return;
 try{
  const data=await request(which,"leads",{agent_id:person.id});
  if(callId!==leadRequestId||tab!=="leads")return;
  leadResults=(Array.isArray(data.leads)?data.leads:[]).filter(l=>String(l.assigned_agent_id||"")===person.id).map(l=>({...l,agency:which}));
 }catch(e){
  if(callId!==leadRequestId||tab!=="leads")return;
  leadError="Unable to retrieve leads for "+(person.full_name||"agent")+": "+(e.message||"Try again");
 }
 if(callId!==leadRequestId||tab!=="leads")return;
 leadLoading=false;showLeadControls();
}
function leadProduct(l){
 const tags=[l.is_medicare?"Medicare":null,l.is_life?"Life":null,l.is_retirement?"Retirement":null].filter(Boolean);
 return tags.join(", ")||String(l.product_type||"—");
}
function showLeads(){
 const root=document.getElementById("leadResults");
 if(!root||!leadAgency||!leadAgent)return;
 const person=leadAgents.find(a=>a.id===leadAgent),items=leadResults;
 const heading='<div class="oc-campaign-result-heading"><b>'+esc(person?.full_name||AGENT[leadAgency]||"Agent")+' · '+esc(LABEL[leadAgency])+'</b><span>'+items.length+' lead'+(items.length===1?"":"s")+'</span></div>';
 if(!items.length){root.innerHTML=heading+'<div class="empty">No leads are assigned to this agent in '+esc(LABEL[leadAgency])+' yet.</div>';return}
 root.innerHTML=heading+'<div class="table-wrap oc-leads-wrap"><table class="data-table"><thead><tr><th>Lead</th><th>Phone</th><th>Product</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>'+
 items.map((l,i)=>'<tr><td><strong>'+esc([l.first_name,l.last_name].filter(Boolean).join(" ")||"Unnamed lead")+'</strong></td><td>'+esc(l.phone||"—")+'</td><td>'+esc(leadProduct(l))+'</td><td>'+status(l.status)+'</td><td>'+esc(fmt(l.created_at))+'</td><td><button type="button" class="link-btn" data-open-lead="'+i+'">View details →</button></td></tr>').join("")+'</tbody></table></div>';
 root.querySelectorAll("[data-open-lead]").forEach(btn=>btn.onclick=()=>showLeadDetails(items[Number(btn.dataset.openLead)]));
}
function showLeadDetails(l){
 if(!l)return;
 const dialog=document.getElementById("dialog");if(!dialog)return;
 const person=leadAgents.find(a=>a.id===leadAgent);
 const fields=[
  ["Agency",LABEL[l.agency]||l.agency],
  ["Agent",person?.full_name||AGENT[l.agency]||"—"],
  ["Phone",l.phone],
  ["Date of birth",l.date_of_birth?fmt(l.date_of_birth):""],
  ["Product",leadProduct(l)],
  ["Status",l.status],
  ["Added",l.created_at?fmt(l.created_at):""],
  ["Converted",l.converted_at?fmt(l.converted_at):""]
 ];
 dialog.innerHTML='<section class="modal-card wide oc-lead-dialog" role="dialog" aria-modal="true" aria-label="Lead details"><div class="modal-header"><div><div class="eyebrow">AGENCY LEAD</div><h2>'+esc([l.first_name,l.last_name].filter(Boolean).join(" ")||"Unnamed lead")+'</h2><p>Read-only record from '+esc(LABEL[l.agency]||l.agency)+'</p></div><button type="button" class="close-button" id="closeLeadDetails" aria-label="Close lead details">×</button></div><div class="record-grid">'+
 fields.map(([label,value])=>'<div class="oc-lead-field"><strong>'+esc(label)+'</strong><span>'+esc(value||"—")+'</span></div>').join("")+
 '</div><div class="oc-lead-notes"><strong>Notes</strong><p>'+esc(l.notes||"No notes on this lead.")+'</p></div><p class="muted oc-lead-readonly">This view reads directly from the source agency. Lead editing and conversion from Office CRM are not enabled yet.</p></section>';
 document.getElementById("closeLeadDetails").onclick=()=>{dialog.innerHTML=""};
 dialog.onclick=e=>{if(e.target===dialog)dialog.innerHTML=""};
}
function resetCampaignPicker(){
 campaignRequestId++;
 campaignAgency="";campaignAgent="";campaignAgents=[];campaignSelectionResults=[];campaignLoading=false;campaignError="";
}
function showCampaignControls(){
 if(tab!=="campaigns")return;
 const agencySelect=document.getElementById("campaignAgency"),agentSelect=document.getElementById("campaignAgent"),result=document.getElementById("campaignResults");
 if(!agencySelect||!agentSelect||!result)return;
 agencySelect.value=campaignAgency;
 agentSelect.disabled=!campaignAgency||campaignLoading&&campaignAgents.length===0||!!campaignError||!campaignAgents.length;
 const options=campaignAgents.map(a=>'<option value="'+esc(a.id)+'"'+(campaignAgent===a.id?' selected':'')+'>'+esc(a.full_name||"Agent")+'</option>').join("");
 agentSelect.innerHTML='<option value="">'+(!campaignAgency?"Choose an agency first":campaignLoading&&!campaignAgents.length?"Loading agents…":campaignError?"Agents unavailable":!campaignAgents.length?"No agents available":"Choose an agent")+'</option>'+options;
 if(campaignAgent && campaignAgents.some(a=>a.id===campaignAgent))agentSelect.value=campaignAgent;
 else agentSelect.value="";
 if(campaignError){result.innerHTML='<div class="oc-campaign-warning" role="alert">'+esc(campaignError)+'</div>';return}
 if(campaignLoading){result.innerHTML='<div class="loading-state">'+esc(campaignAgent?"Loading selected agent’s campaigns…":"Loading agents…")+'</div>';return}
 if(!campaignAgency){result.innerHTML='<div class="empty">Choose an agency, then an agent to view campaigns.</div>';return}
 if(!campaignAgents.length){result.innerHTML='<div class="empty">No active agents are available for this agency.</div>';return}
 if(!campaignAgent){result.innerHTML='<div class="empty">Now choose an agent to see their campaigns.</div>';return}
 showCampaigns();
}
async function chooseCampaignAgency(value){
 const selected=connected[value]&&["arctos","platinum"].includes(value)?value:"";
 const callId=++campaignRequestId;
 campaignAgency=selected;campaignAgent="";campaignAgents=[];campaignSelectionResults=[];campaignError="";campaignLoading=!!selected;
 showCampaignControls();
 if(!selected)return;
 try{
  const data=await request(selected,"campaign_agents");
  if(callId!==campaignRequestId||tab!=="campaigns")return;
  campaignAgents=(Array.isArray(data.agents)?data.agents:[]).filter(a=>a&&/^[0-9a-f-]{36}$/i.test(String(a.id))&&a.full_name);
 }catch(e){
  if(callId!==campaignRequestId||tab!=="campaigns")return;
  campaignError="Unable to load agents for "+LABEL[selected]+": "+(e.message||"Please try again");
 }
 if(callId!==campaignRequestId||tab!=="campaigns")return;
 campaignLoading=false;
 showCampaignControls();
}
async function chooseCampaignAgent(value){
 const agent=campaignAgents.find(a=>a.id===value);
 const callId=++campaignRequestId;
 campaignAgent=agent?agent.id:"";campaignSelectionResults=[];campaignLoading=!!agent;campaignError="";
 const selectedAgency=campaignAgency;
 showCampaignControls();
 if(!agent||!connected[selectedAgency])return;
 try{
  const data=await request(selectedAgency,"campaigns",{agent_id:agent.id});
  if(callId!==campaignRequestId||tab!=="campaigns")return;
  // Verify the selected agent owns every displayed assignment, even if an API response changes.
  campaignSelectionResults=(Array.isArray(data.campaigns)?data.campaigns:[]).filter(c=>String(c.assigned_agent_id||"")===agent.id).map(c=>({...c,agency:selectedAgency}));
 }catch(e){
  if(callId!==campaignRequestId||tab!=="campaigns")return;
  campaignError="Unable to load campaigns for "+(agent.full_name||"agent")+": "+(e.message||"Please try again");
 }
 if(callId!==campaignRequestId||tab!=="campaigns")return;
 campaignLoading=false;
 showCampaignControls();
}
function showCampaigns(){
 const el=document.getElementById("campaignResults");if(!el||!campaignAgency||!campaignAgent)return;
 const selected=campaignAgents.find(a=>a.id===campaignAgent);
 const list=campaignSelectionResults;
 el.innerHTML='<div class="oc-campaign-result-heading"><b>'+esc(selected?.full_name||AGENT[campaignAgency]||"Agent")+'</b><span>'+list.length+' campaign'+(list.length===1?"":"s")+'</span></div>'+
 (list.map(c=>'<div class="list-row"><div class="row-main"><div class="avatar">◉</div><div><b>'+esc(c.name)+'</b><small>'+esc(selected?.full_name||AGENT[c.agency])+' · '+esc(c.topic||c.description||"Campaign")+'</small></div></div><div class="row-right">'+tag(c.agency)+'<small><button class="link-btn" data-campaign="'+esc(c.agency)+":"+esc(c.id)+'">Open contacts →</button></small></div></div>').join("")||'<div class="empty">No campaigns are assigned to this agent.</div>');
 el.querySelectorAll("[data-campaign]").forEach(b=>b.onclick=async()=>{let [a,id]=b.dataset.campaign.split(":");await showMembers(a,id)});
}
async function showMembers(a,id){
 const el=document.getElementById("campaignResults");if(!el)return;
 el.dataset.activeCampaign=a+":"+id;
 const isPlatinum=a==="platinum",pageSize=100;
 let nextOffset=0,loadingPage=false;
 el.innerHTML='<button class="outline" id="backCampaigns">← Back to campaigns</button>'+
  '<div class="notice" style="margin:15px 0">Campaign updates are read-only until contact status write tests are complete.</div>'+
  '<div class="table-wrap"><table class="data-table"><thead><tr><th>Client ID</th><th>Status</th><th>Attempts</th><th>Last Note</th></tr></thead><tbody id="officeCampaignRows"></tbody></table></div>'+
  '<div class="oc-page-controls" id="officeCampaignPage"><span class="muted">Loading contacts…</span></div>';
 el.querySelector("#backCampaigns").onclick=showCampaigns;
 const body=el.querySelector("#officeCampaignRows"),nav=el.querySelector("#officeCampaignPage");
 const rowMarkup=m=>'<tr><td>'+esc(String(m.client_id||"").slice(0,8))+'…</td><td>'+status(m.contact_status)+'</td><td>'+esc(m.attempt_count||0)+'</td><td>'+esc(m.last_note||"")+'</td></tr>';
 async function nextPage(){
  if(loadingPage||el.dataset.activeCampaign!==a+":"+id||!body.isConnected)return;
  loadingPage=true;
  nav.innerHTML='<span class="muted">Loading contacts…</span>';
  try{
   const params={campaign_id:id,...(isPlatinum?{offset:nextOffset,page_size:pageSize}:{})};
   const answer=await request(a,"campaign_members",params);
   if(!body.isConnected||el.dataset.activeCampaign!==a+":"+id)return;
   const members=Array.isArray(answer.members)?answer.members:[];
   body.insertAdjacentHTML("beforeend",members.map(rowMarkup).join(""));
   nextOffset+=members.length;
   if(isPlatinum&&answer.has_more){
    nav.innerHTML='<span class="muted">'+nextOffset+' loaded</span><button type="button" class="outline" id="officeLoadCampaignMore">Load next 100 contacts</button>';
    nav.querySelector("#officeLoadCampaignMore").onclick=nextPage;
   }else{
    nav.innerHTML='<span class="muted">'+nextOffset+(nextOffset===1?" contact":" contacts")+' loaded'+(!isPlatinum&&members.length===200?" · Only the first 200 are available through this agency connection.":"")+'</span>';
   }
   if(!nextOffset)body.innerHTML='<tr><td colspan="4">No contacts are assigned to this campaign.</td></tr>';
  }catch(e){if(body.isConnected&&el.dataset.activeCampaign===a+":"+id)nav.innerHTML='<div class="auth-warn">'+esc(e.message)+'</div><button class="outline" id="retryCampaignPage" type="button">Retry</button>';
   nav.querySelector("#retryCampaignPage")?.addEventListener("click",nextPage);
  }finally{loadingPage=false}
 }
 await nextPage();
}

const protectedLabels={ssn:"Social Security number",medicare_number:"Medicare number",medicaid_number:"Medicaid number",drivers_license_number:"Driver's license number",bank_name:"Bank name",account_name:"Account holder",account_number:"Bank account number",routing_number:"Routing number",payment_method:"Payment method",card_last4:"Card last four digits",username:"Medicare.gov username",password:"Medicare.gov password",security_answer:"Verification answer",verification_type:"Verification method",verification_destination:"Verification destination"};
async function revealClientProtected(a,id,kind){
 const dlg=document.getElementById("dialog");
 const pane=dlg?.querySelector('[data-secure-result="'+kind+'"]');
 const btn=dlg?.querySelector('[data-protected="'+kind+'"]');
 if(!pane||!btn||!activeClient||activeClient.id!==id||activeClient.agency!==a)return;
 btn.disabled=true;
 pane.innerHTML='<span class="muted">Retrieving protected information…</span>';
 try{
  const result=await request(a,"secure_client",{client_id:id,kind});
  if(!pane.isConnected||!activeClient||activeClient.id!==id||activeClient.agency!==a)return;
  const data=result?.data;
  dlg.dispatchEvent(new CustomEvent("office:protected",{detail:{agency:a,clientId:id,kind,data:data&&typeof data==="object"?data:{}}}));
  if(!data||typeof data!=="object"||!Object.keys(data).some(k=>data[k]!==null&&data[k]!==""&&data[k]!==undefined)){
   pane.innerHTML='<span class="muted">No saved information is available in this protected section.</span>';
   return;
  }
  const rows=Object.entries(data).filter(([key,val])=>val!==undefined&&val!==null&&val!=="").map(([key,val])=>'<div class="oc-protected-field"><strong>'+esc(protectedLabels[key]||key.replace(/_/g," "))+'</strong><span>'+esc(typeof val==="object"?JSON.stringify(val):String(val))+'</span></div>').join("");
  pane.innerHTML='<div class="oc-protected-grid">'+rows+'</div><button type="button" class="outline oc-hide-sensitive">Hide now</button><p class="oc-protected-expiry">Automatically hides after 60 seconds. Do not leave the screen unattended.</p>';
  const hide=()=>{if(pane.isConnected)pane.innerHTML='<span class="muted">Protected information hidden. Choose Reveal to view again.</span>'};
  pane.querySelector(".oc-hide-sensitive")?.addEventListener("click",hide,{once:true});
  setTimeout(hide,60000);
 }catch(err){
  if(pane.isConnected)pane.innerHTML='<div class="oc-protected-error" role="alert">'+esc(err.message||"Secure read failed")+'</div>';
 }finally{if(btn.isConnected)btn.disabled=false}
}


/* Office client records intentionally mirror the four visible Arctos sections.
   Private and sensitive values continue through existing audited agency bridges;
   read-only insurance details are never silently saved as fake client fields. */
const ocClientTabs=[
 ["overview","Overview"],["coverage","Coverage"],
 ["medical","Medical"],["files","Notes & Files"]
];
function ocClientAge(dob){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob||""));
 if(!m)return null;
 const now=new Date(),year=+m[1],month=+m[2],day=+m[3];
 if(month<1||month>12||day<1||day>31)return null;
 const valid=new Date(year,month-1,day,12);
 if(valid.getFullYear()!==year||valid.getMonth()+1!==month||valid.getDate()!==day)return null;
 let age=now.getFullYear()-year;
 if(now.getMonth()+1<month||(now.getMonth()+1===month&&now.getDate()<day))age--;
 return age>=0?age:null;
}
function ocClientField(name,title,value="",type="text",extra=""){
 const fieldType=["email","tel","date","number","text"].includes(type)?type:"text";
 return '<label class="oc-client-field"><span>'+esc(title)+'</span><input name="'+esc(name)+
  '" type="'+fieldType+'" value="'+esc(value??"")+'" '+extra+'></label>';
}
function ocClientSelect(name,title,value,choices){
 return '<label class="oc-client-field"><span>'+esc(title)+'</span><select name="'+esc(name)+'">'+
 choices.map(item=>'<option value="'+esc(item)+'"'+(String(item)===String(value||"")?' selected':'')+'>'+
 esc(item||"Select…")+'</option>').join("")+'</select></label>';
}
function ocClientAccordion(title,description,body,tone="overview"){
 return '<details class="oc-client-category tone-'+esc(tone)+'"><summary><span><strong>'+esc(title)+
  '</strong><small>'+esc(description||"")+'</small></span><span aria-hidden="true" class="oc-client-chevron">⌄</span></summary>'+
  '<div class="oc-client-category-body">'+body+'</div></details>';
}
function ocClientSub(title,body){
 return '<section class="oc-client-subsection"><h4>'+esc(title)+'</h4>'+body+'</section>';
}
function ocClientSafeEntries(obj){
 if(!obj||typeof obj!=="object")return "";
 const hidden=/^(id|client_id|user_id|assigned_agent_id|created_at|updated_at|uploaded_by|author_id|file_path|storage_path|file_url|document_url)$/i;
 const secure=/(ssn|medicare_number|medicaid_number|bank|routing|account_number|cvv|credit_card|password|token|encrypted|secret|pin_number|access_key|card_number|security_code)/i;
 return Object.entries(obj).filter(([key,value])=>
   value!==null&&value!==undefined&&value!==""&&!hidden.test(key)&&!secure.test(key)
 ).map(([key,value])=>'<div class="oc-client-datum"><dt>'+esc(key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()))+'</dt><dd>'+
 esc(typeof value==="object"?JSON.stringify(value):String(value))+'</dd></div>').join("");
}
function ocClientRecords(rows,emptyText){
 if(!Array.isArray(rows)||!rows.length)return '<p class="oc-client-empty">'+esc(emptyText||"No records in this section.")+'</p>';
 return rows.map(row=>{
  const data=ocClientSafeEntries(row);
  return '<dl class="oc-client-record">'+(data||'<p class="oc-client-empty">No additional details.</p>')+'</dl>';
 }).join("");
}
const ocMedicaidLevels=[
 ['', 'Select…'],['None','None'],['QMB','QMB'],['QMB+','QMB+'],['SLMB','SLMB'],
 ['SLMB+','SLMB+'],['QI','QI'],['QDWI','QDWI'],['FBDE','FBDE / Full Medicaid']
];
function ocMedicaidLevelEditor(value=""){
 const saved=String(value||"");
 const choices=ocMedicaidLevels.some(([key])=>key===saved)?ocMedicaidLevels:[...ocMedicaidLevels,[saved,saved+' (current saved value)']];
 return '<form class="oc-medicaid-level-editor" data-medicaid-level-editor><label class="oc-client-field"><span>Medicaid Level</span><select name="medicaid_level">'+
  choices.map(([key,label])=>'<option value="'+esc(key)+'"'+(key===saved?' selected':'')+'>'+esc(label)+'</option>').join('')+
  '</select></label><div class="oc-medicaid-level-actions"><button type="submit" class="primary">Save Medicaid Level</button>'+
  '<span data-medicaid-level-status>Uses the same Medicaid levels as Arctos.</span></div></form>';
}
function ocHealthInput(field,title,value="",type="text",extra=""){
 const tag=type==="textarea"
  ?'<textarea data-health-field="'+esc(field)+'" rows="3" '+extra+'>'+esc(value??"")+'</textarea>'
  :'<input data-health-field="'+esc(field)+'" type="'+esc(type)+'" value="'+esc(value??"")+'" '+extra+'>';
 return '<label class="oc-client-field"><span>'+esc(title)+'</span>'+tag+'</label>';
}
function ocDoctorEditorCard(row={},index=0){
 return '<article class="oc-health-edit-card" data-health-row data-record-id="'+esc(row.id||"")+'">'+
  '<div class="oc-health-card-heading"><strong>'+(row.doctor_name?esc(row.doctor_name):'New Doctor')+'</strong><button type="button" class="outline" data-remove-health-row>Remove</button></div>'+
  '<div class="oc-client-form-grid">'+
  ocHealthInput('doctor_name','Doctor Name *',row.doctor_name||'','text','required maxlength="180"')+
  ocHealthInput('specialty','Specialty',row.specialty||'','text','maxlength="150"')+
  ocHealthInput('practice_name','Practice / Facility',row.practice_name||'','text','maxlength="180"')+
  ocHealthInput('phone','Phone',row.phone||'','tel','maxlength="50"')+
  ocHealthInput('fax','Fax',row.fax||'','tel','maxlength="50"')+
  ocHealthInput('address','Address',row.address||'','text','maxlength="220"')+
  ocHealthInput('city','City',row.city||'','text','maxlength="100"')+
  ocHealthInput('state','State',row.state||'','text','maxlength="40"')+
  ocHealthInput('zip_code','ZIP Code',row.zip_code||'','text','maxlength="15"')+
  ocHealthInput('notes','Doctor Notes',row.notes||'','textarea','maxlength="2000"')+
  '</div></article>';
}
function ocMedicationEditorCard(row={},index=0){
 return '<article class="oc-health-edit-card" data-health-row data-record-id="'+esc(row.id||"")+'">'+
  '<div class="oc-health-card-heading"><strong>'+(row.medication_name?esc(row.medication_name):'New Medication')+'</strong><button type="button" class="outline" data-remove-health-row>Remove</button></div>'+
  '<div class="oc-client-form-grid">'+
  ocHealthInput('medication_name','Medication *',row.medication_name||'','text','required maxlength="180"')+
  ocHealthInput('strength','Strength',row.strength||'','text','maxlength="100"')+
  ocHealthInput('dosage','Dosage',row.dosage||'','text','maxlength="100"')+
  ocHealthInput('frequency','Frequency',row.frequency||'','text','maxlength="100"')+
  ocHealthInput('prescribing_doctor','Prescribing Doctor',row.prescribing_doctor||'','text','maxlength="180"')+
  ocHealthInput('purpose','Purpose / Condition',row.purpose||'','text','maxlength="180"')+
  ocHealthInput('status','Status',row.status||'active','text','maxlength="30"')+
  ocHealthInput('notes','Medication Notes',row.notes||'','textarea','maxlength="2000"')+
  '</div></article>';
}
function ocHealthEditor(kind,rows){
 const list=Array.isArray(rows)?rows:[];
 const renderer=kind==="doctors"?ocDoctorEditorCard:ocMedicationEditorCard;
 const label=kind==="doctors"?'Doctor':'Medication';
 return '<form class="oc-health-editor" data-health-editor="'+kind+'">'+
  '<div data-health-edit-list>'+list.map(renderer).join('')+'</div>'+
  '<div class="oc-health-edit-actions"><button type="button" class="outline" data-add-health-row="'+kind+'">+ Add '+label+'</button>'+
  '<button type="submit" class="primary">Save '+label+'s</button></div>'+
  '<p class="oc-health-edit-status" data-health-status>'+(list.length?list.length+' saved '+label.toLowerCase()+(list.length===1?'':'s'):'No '+label.toLowerCase()+'s saved yet.')+'</p></form>';
}
function ocPharmacyEditor(rows){
 const row=Array.isArray(rows)&&rows.length?rows[0]:{};
 return '<form class="oc-health-editor" data-health-editor="pharmacies"><article class="oc-health-edit-card" data-health-row data-record-id="'+esc(row.id||'')+'">'+
  '<div class="oc-client-form-grid">'+
  ocHealthInput('pharmacy_name','Primary Pharmacy',row.pharmacy_name||'','text','maxlength="180"')+
  ocHealthInput('pharmacy_location','Primary Pharmacy Location',row.pharmacy_location||'','text','maxlength="220"')+
  ocHealthInput('pharmacy_name_2','Second Pharmacy',row.pharmacy_name_2||'','text','maxlength="180"')+
  ocHealthInput('pharmacy_location_2','Second Pharmacy Location',row.pharmacy_location_2||'','text','maxlength="220"')+
  ocHealthInput('medication_notes','Pharmacy / Medication Notes',row.medication_notes||'','textarea','maxlength="2000"')+
  '</div></article><div class="oc-health-edit-actions"><button type="submit" class="primary">Save Pharmacies</button></div>'+
  '<p class="oc-health-edit-status" data-health-status>Pharmacy fields save directly to the agency client record.</p></form>';
}
function ocClientDocuments(rows){
 if(!Array.isArray(rows)||!rows.length)return '<p class="oc-client-empty">No uploaded documents found for this client.</p>';
 return rows.map(doc=>'<div class="oc-client-doc"><div><strong>'+esc(doc.file_name||"Client document")+'</strong>'+
  '<small>'+esc(doc.category||"Document")+' · '+esc(fmt(doc.created_at))+'</small></div>'+
  (doc.id?'<button type="button" class="outline" data-office-doc="'+esc(doc.id)+'">Open secure document ↗</button>':'')+'</div>').join("");
}
function ocClientHeader(title,subtitle){
 return '<div class="modal-header oc-client-modal-header"><div><div class="eyebrow">CLIENT INFORMATION</div>'+
  '<h2>'+esc(title)+'</h2><p>'+esc(subtitle)+'</p></div>'+
  '<button class="close-button" type="button" data-office-client-close aria-label="Close client record">×</button></div>';
}
function ocClientNav(){
 return '<nav class="oc-client-main-tabs" role="tablist" aria-label="Client record sections">'+ocClientTabs.map(([key,label],i)=>
 '<button type="button" role="tab" data-oc-client-tab="'+key+'" aria-selected="'+(i===0?'true':'false')+
 '" tabindex="'+(i===0?'0':'-1')+'">'+esc(label)+'</button>').join("")+'</nav>';
}
function ocClientPanel(key,contents){
 return '<section class="oc-client-tabpanel" role="tabpanel" data-oc-client-panel="'+key+'"'+(key==="overview"?'':' hidden')+'>'+contents+'</section>';
}
function ocClientDisplayDate(value){
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value||""));
 return match?Number(match[2])+"/"+Number(match[3])+"/"+match[1]:String(value||"");
}
function ocClientGlance(client,agencyName,isNew=false){
 const name=[client.first_name,client.last_name].filter(Boolean).join(" ").trim();
 const age=ocClientAge(client.date_of_birth), dob=client.date_of_birth;
 const meta=[
  dob?"DOB: "+ocClientDisplayDate(dob)+(age===null?"":" (Age: "+age+")"):"",
  client.phone||"",client.city&&client.state?client.city+", "+client.state:client.city||client.state||"",
  client.zip_code?"ZIP: "+client.zip_code:""
 ].filter(Boolean);
 return '<div class="oc-client-overview-card"><div><span class="oc-client-kicker">CLIENT AT A GLANCE</span>'+
  '<strong data-office-client-name>'+esc(name||"New Client")+'</strong>'+
  '<p data-office-client-meta>'+esc(meta.join(" · ")||"Enter or review the client information below.")+'</p></div>'+
  '<div class="oc-client-overview-actions">'+(isNew?'<span class="oc-client-new-badge">New Client</span>':
  '<button type="button" class="outline" data-oc-client-appointment>+ Set Appointment</button>')+'</div></div>';
}
function ocClientGeneralFields(c,mode){
 const creating=mode==="new";
 const agencyBlock=creating?'<div class="oc-client-form-grid oc-client-agency-grid">'+
  '<label class="oc-client-field"><span>Agency *</span><select id="onAgency" name="agency" required>'+ocAgencyMarkup(false)+'</select></label>'+
  '<label class="oc-client-field"><span>Agent *</span><select id="onAgent" name="agent_id" required disabled><option value="">Choose agency first</option></select></label></div>':"";
 const fields=[
  ocClientField("first_name","First Name *",c.first_name||"","text",'required maxlength="100"'),
  ocClientField("last_name","Last Name *",c.last_name||"","text",'required maxlength="100"'),
  ocClientField("date_of_birth","Date of Birth",c.date_of_birth||"","date"),
  ocClientField("phone","Phone Number",c.phone||"","tel",'maxlength="40"'),
  ocClientField("email","Email",c.email||"","email",'maxlength="180"'),
  ocClientField("address1","Street Address",c.address1||"","text",'maxlength="200"'),
  ...(!creating?[ocClientField("address2","Address Line 2",c.address2||"","text",'maxlength="200"')]:[]),
  ocClientField("city","City",c.city||"","text",'maxlength="100"'),
  ocClientField("state","State",c.state||"","text",'maxlength="60"'),
  ocClientField("zip_code","ZIP Code",c.zip_code||"","text",'maxlength="15"'),
  ocClientField("county","County",c.county||"","text",'maxlength="100"')
 ];
 const extra=creating?"":'<div class="oc-client-form-grid">'+
   ocClientSelect("gender","Gender",c.gender,["","Male","Female","Other","Not specified"])+
   ocClientField("spouse","Spouse",c.spouse||"","text",'maxlength="150"')+
   ocClientSelect("veteran","Veteran",String(c.veteran??""),["","true","false"])+
   ocClientSelect("smoker","Smoker",String(c.smoker??""),["","true","false"])+
   ocClientField("height_feet","Height (ft)",c.height_feet??"","number",'min="0" max="8"')+
   ocClientField("height_inches","Height (in)",c.height_inches??"","number",'min="0" max="11"')+
   ocClientField("weight_lbs","Weight (lbs)",c.weight_lbs??"","number",'min="0" max="1200"')+
   '</div>';
 return ocClientAccordion("Personal & Contact Information","Name, DOB, phone, address and agency",agencyBlock+
  '<div class="oc-client-form-grid">'+fields.join("")+'</div>',"overview")+
  (extra?ocClientAccordion("Additional Client Information","Gender, family, height and weight",extra,"identity"):"");
}
function ocClientBindTabs(root,requested="overview"){
 const buttons=[...root.querySelectorAll("[data-oc-client-tab]")];
 const panels=[...root.querySelectorAll("[data-oc-client-panel]")];
 const choose=(key)=>{
  // Same reset behavior as Arctos: nested dropdowns close on tab changes.
  root.querySelectorAll("details[open]").forEach(item=>item.open=false);
  buttons.forEach(b=>{const active=b.dataset.ocClientTab===key;b.setAttribute("aria-selected",String(active));b.tabIndex=active?0:-1;});
  panels.forEach(p=>{p.hidden=p.dataset.ocClientPanel!==key;});
  const flags=root.querySelector('.office-client-flags');if(flags)flags.hidden=key!=="overview";
 };
 buttons.forEach(b=>b.addEventListener("click",()=>choose(b.dataset.ocClientTab)));
 choose(ocClientTabs.some(([key])=>key===requested)?requested:"overview");
}
function ocClientProtected(a){
 if(!connected[a]?.permissions?.sensitive)
  return '<p class="sensitive-banner">Protected identifiers are available only to separately authorized agency staff.</p>';
 return '<p class="oc-client-readonly-hint">Protected values are revealed only on request and are automatically hidden again.</p>'+
  [["identifiers","SSN, Medicare, Medicaid and Driver License"],["banking","Banking & Payment Information"],["medicare_gov","Medicare.gov Credentials"]].map(([kind,label])=>
  '<div class="oc-protected-group"><div class="oc-protected-heading"><strong>'+esc(label)+'</strong>'+
  '<button type="button" class="outline" data-protected="'+esc(kind)+'">Reveal</button></div>'+
  '<div class="oc-protected-result" data-secure-result="'+esc(kind)+'"><span class="muted">Protected — select Reveal to view.</span></div></div>').join("");
}
function ocClientDetailMarkup(details,a,id){
 const ds=key=>Array.isArray(details[key])?details[key]:[];
 const medicareDetails=ds("medicare_details"),medicaidLevel=medicareDetails[0]?.medicaid_level||"";
 const medicareDisplay=medicareDetails.map(row=>{const copy={...row};delete copy.medicaid_level;return copy;});
 const review=ds("client_review_manual");
 const reviewMarkup='<div class="oc-client-review"><strong>Completed Reviews</strong><span>'+
  (review.length?review.map(row=>esc(String(row.review_year||""))+": "+(row.completed?"Complete":"Not completed")).join(" · "):
  'No manual review completion recorded.')+'</span></div>';
 const overviewOther=ocClientAccordion("Identification & Protected Information",
  "Secure identifiers, banking and Medicare.gov credentials",ocClientProtected(a),"identity");
 const coverage=ocClientAccordion("Medicare & Current Coverage","Medicare, Medicaid, current plans and reviews",
  ocClientSub("Medicare Information",ocClientRecords(medicareDisplay,"No Medicare details saved.")+ocMedicaidLevelEditor(medicaidLevel))+
  ocClientSub("Medicare Advantage / Health Plans",ocClientRecords(ds("health_plans"),"No health plan records saved."))+
  ocClientSub("Annual Medicare Reviews",ocClientRecords(ds("athena_medicare_reviews"),"No completed Medicare review forms saved.")), "medicare")+
  ocClientAccordion("Life Insurance","Life policies, premiums and beneficiaries",
   ocClientRecords(ds("life_policies"),"No life insurance policies saved."),"life")+
  ocClientAccordion("Hospital Indemnity","Hospital and supplemental policies",
   ocClientRecords(ds("hospital_indemnity_plans"),"No hospital indemnity plans saved."),"hospital")+
  ocClientAccordion("Retirement","Retirement accounts and products",
   '<p class="oc-client-empty">Retirement records are managed in '+esc(LABEL[a])+'.</p>',"retirement");
 const medical=ocClientAccordion("Doctors","Add, edit or remove providers and office locations",
  ocHealthEditor("doctors",ds("client_doctors")),"doctors")+
  ocClientAccordion("Medications & Pharmacies","Add, edit or remove prescriptions and pharmacy information",
   ocClientSub("Pharmacies",ocPharmacyEditor(ds("client_pharmacies")))+
   ocClientSub("Medications",ocHealthEditor("medications",ds("client_medications"))),"medications");
 const notes=ocClientAccordion("Client Notes","Saved office and agency notes",
  ocClientRecords(ds("client_notes"),"No client notes saved.")+
  '<form id="newClientNote" class="oc-client-new-note"><label class="oc-client-field"><span>Add Office Note</span>'+
  '<textarea name="note" required maxlength="4000" rows="4" placeholder="Write a note to the selected agency…"></textarea></label>'+
  '<button type="submit" class="primary">Save Note</button></form>',"notes")+
  ocClientAccordion("Documents & Files","Secure uploads, SOA and policy documents",ocClientDocuments(ds("documents")),"documents")+
  ocClientAccordion("Completed Appointments","Past client appointments and actions",
   ocClientRecords(ds("client_completed_appointments"),"No completed appointments saved."),"activity")+
  ocClientAccordion("Client Messages","Previously saved text messages",
   ocClientRecords(ds("client_sms_messages"),"No text message history saved."),"activity");
 return {reviewMarkup,overviewOther,coverage,medical,notes};
}
async function openClient(a,id,selectedTab="overview"){
 const dlg=document.getElementById("dialog");
 if(!dlg||!["arctos","platinum"].includes(a)||!connected[a])return;
 dlg.innerHTML='<div class="modal-card wide oc-arctos-client-dialog" role="dialog" aria-modal="true"><div class="loading-state">Loading client record from '+esc(LABEL[a])+'…</div></div>';
 try{
  const result=await request(a,"client",{client_id:id});
  if(!document.getElementById("dialog")||!dlg.isConnected)return;
  const c=result.client||{},details=result.details||{};
  activeClient={agency:a,id,client:c,details,errors:result.detail_errors||{}};
  const name=[c.first_name,c.last_name].filter(Boolean).join(" ").trim()||"Client";
  const blocks=ocClientDetailMarkup(details,a,id);
  const editForm='<form id="editClient" class="oc-client-main-form" autocomplete="off">'+
   ocClientGeneralFields(c,"edit")+
   '<details class="oc-client-category oc-client-note-overview"><summary><span><strong>Client Note</strong><small>Editable client overview note</small></span><span class="oc-client-chevron">⌄</span></summary>'+
   '<div class="oc-client-category-body"><label class="oc-client-field"><span>Client Note</span>'+
   '<textarea name="notes" maxlength="2000" rows="5">'+esc(c.notes||"")+'</textarea></label></div></details>'+
   '<div class="oc-client-save-footer"><span data-oc-save-state>Updates save directly to '+esc(LABEL[a])+'</span>'+
   '<button type="submit" class="primary">Save Client Changes</button></div></form>';
  dlg.innerHTML='<div class="modal-card wide oc-arctos-client-dialog" role="dialog" aria-modal="true">'+
    ocClientHeader(name,LABEL[a]+' · '+AGENT[a])+
    '<div class="oc-client-four-tabs">'+ocClientNav()+
    ocClientPanel("overview",ocClientGlance(c,a)+blocks.reviewMarkup+editForm+blocks.overviewOther)+
    ocClientPanel("coverage",'<div class="oc-client-group-heading"><strong>Insurance & Coverage</strong><p>Open the category you want to review.</p></div>'+
       '<p class="oc-client-readonly-hint">Policy-specific details are shown securely from '+esc(LABEL[a])+
       '. Edit complex policy records in that agency CRM to keep coverage history accurate.</p>'+blocks.coverage)+
    ocClientPanel("medical",'<div class="oc-client-group-heading"><strong>Medical Information</strong><p>Doctors, current medications and pharmacies.</p></div>'+blocks.medical)+
    ocClientPanel("files",'<div class="oc-client-group-heading"><strong>Notes & Files</strong><p>Client notes, forms and documents.</p></div>'+blocks.notes)+
    '<p class="oc-client-modal-error" data-office-client-error role="alert"></p></div></div>';
  const root=dlg.querySelector(".oc-arctos-client-dialog");
  window.officeArctosOverviewMount?.(root,c);
  ocClientBindTabs(root,selectedTab);
  const form=root.querySelector("#editClient");
  let baseline=JSON.stringify(Object.fromEntries(new FormData(form).entries()));
  const notice=root.querySelector("[data-oc-save-state]");
  const close=()=>{
   if((root.officeHasUnsavedChanges?root.officeHasUnsavedChanges():JSON.stringify(Object.fromEntries(new FormData(form).entries()))!==baseline) &&
     !confirm("Discard unsaved client changes?"))return;
   activeClient=null;dlg.innerHTML="";
  };
  root.querySelector("[data-office-client-close]").onclick=close;
  dlg.onclick=e=>{if(e.target===dlg)close()};
  root.querySelector("[data-oc-client-appointment]").onclick=()=>{
   const hint=c.phone||"";
   ocOpenAppointmentForm(undefined,hint);
  };
  form.addEventListener("input",()=>{
   if(form.hasAttribute('data-office-exact-overview'))return;
   const meta=root.querySelector("[data-office-client-meta]");
   const values=Object.fromEntries(new FormData(form).entries());
   const age=ocClientAge(values.date_of_birth);
   if(meta)meta.textContent=[values.date_of_birth?"DOB: "+ocClientDisplayDate(values.date_of_birth)+(age===null?"":" (Age: "+age+")"):"",
     values.phone||"",[values.city,values.state].filter(Boolean).join(", "),values.zip_code?"ZIP: "+values.zip_code:""].filter(Boolean).join(" · ");
   const title=root.querySelector("[data-office-client-name]");
   if(title)title.textContent=[values.first_name,values.last_name].filter(Boolean).join(" ")||"Client";
   notice.textContent="Unsaved changes";
  });
  form.onsubmit=async e=>{
   e.preventDefault();
   if(!form.reportValidity())return;
   const button=form.querySelector('button[type="submit"]');
   button.disabled=true;notice.textContent="Saving client changes…";
   try{
    const current=Object.fromEntries(new FormData(form).entries());
    const changes={};
    // Only save bridge-supported fields. Preserve nulls and other policy data.
    for(const [key,value]of Object.entries(current))if(!key.startsWith("office_protected_")&&key in c&&JSON.stringify(value)!==JSON.stringify(c[key]??""))changes[key]=value;
    // The underlying client schema has typed date, number and boolean fields.
    // Clearing them sends null, not an invalid empty string.
    for(const field of ["date_of_birth","height_feet","height_inches","weight_lbs","veteran","smoker"])
      if(field in changes&&changes[field]==="")changes[field]=null;
    for(const field of ["height_feet","height_inches","weight_lbs"])
      if(field in changes&&changes[field]!==null)changes[field]=Number(changes[field]);
    for(const flag of ["veteran","smoker"])
      if(flag in changes&&changes[flag]!==null)changes[flag]=changes[flag]==="true";
    if(!Object.keys(changes).length){notice.textContent="No changes to save.";return;}
    await request(a,"save_client",{client_id:id,changes});
    Object.assign(c,changes);
    baseline=JSON.stringify(Object.fromEntries(new FormData(form).entries()));
    notice.textContent="Saved successfully";
    toast("Client changes saved to "+LABEL[a]);
   }catch(ex){
    notice.textContent="Save failed";
    root.querySelector("[data-office-client-error]").textContent="Save failed: "+(ex.message||"Unable to save client.");
   }finally{button.disabled=false}
  };
  root.querySelectorAll("[data-protected]").forEach(button=>button.addEventListener("click",()=>{
   revealClientProtected(a,id,button.dataset.protected)
  }));
  const medicaidEditor=root.querySelector("[data-medicaid-level-editor]");
  if(medicaidEditor)medicaidEditor.onsubmit=async event=>{
   event.preventDefault();
   const button=medicaidEditor.querySelector('button[type="submit"]'),status=medicaidEditor.querySelector('[data-medicaid-level-status]');
   button.disabled=true;if(status)status.textContent="Saving…";
   try{
    const medicaid_level=medicaidEditor.elements.medicaid_level.value;
    await request(a,"save_medicare_details",{client_id:id,medicaid_level});
    if(status)status.textContent="Medicaid level saved.";
    toast("Medicaid level saved to "+LABEL[a]);
   }catch(error){if(status)status.textContent="Save failed: "+(error.message||"Unable to save Medicaid level.");}
   finally{button.disabled=false;}
  };
  root.addEventListener("click",event=>{
   const add=event.target.closest?.("[data-add-health-row]");
   if(add){
    const kind=add.dataset.addHealthRow,editor=add.closest("[data-health-editor]"),list=editor?.querySelector("[data-health-edit-list]");
    if(!list)return;
    list.insertAdjacentHTML("beforeend",kind==="doctors"?ocDoctorEditorCard({},list.children.length):ocMedicationEditorCard({},list.children.length));
    list.lastElementChild?.querySelector("input")?.focus();return;
   }
   const remove=event.target.closest?.("[data-remove-health-row]");
   if(remove)remove.closest("[data-health-row]")?.remove();
  });
  root.querySelectorAll("[data-health-editor]").forEach(editor=>editor.onsubmit=async event=>{
   event.preventDefault();if(!editor.reportValidity())return;
   const kind=editor.dataset.healthEditor,status=editor.querySelector("[data-health-status]"),button=editor.querySelector('button[type="submit"]');
   const rows=[...editor.querySelectorAll("[data-health-row]")].map(card=>{
    const row={};if(card.dataset.recordId)row.id=card.dataset.recordId;
    card.querySelectorAll("[data-health-field]").forEach(input=>row[input.dataset.healthField]=input.value);
    return row;
   });
   button.disabled=true;if(status)status.textContent="Saving…";
   try{
    await request(a,"save_health_records",{client_id:id,kind,rows});
    toast((kind==="pharmacies"?'Pharmacies':kind[0].toUpperCase()+kind.slice(1))+" saved to "+LABEL[a]);
    await openClient(a,id,"medical");
   }catch(error){if(status)status.textContent="Save failed: "+(error.message||"Unable to save.");}
   finally{if(button.isConnected)button.disabled=false;}
  });
  root.querySelectorAll("[data-office-doc]").forEach(button=>button.addEventListener("click",async()=>{
   const opened=window.open("about:blank","_blank");
   if(opened){opened.document.title="Opening secure document";opened.document.body.textContent="Preparing authorized document…";}
   button.disabled=true;
   try{
    const doc=await request(a,"document_url",{client_id:id,document_id:button.dataset.officeDoc});
    if(!doc?.url||!doc.url.startsWith("https://"))throw Error("Document link was not valid");
    if(opened){opened.opener=null;opened.location.replace(doc.url);}
    else{
     const link=document.createElement("a");
     link.href=doc.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open secure document (expires in 60 seconds)";
     button.insertAdjacentElement("afterend",link);
    }
   }catch(error){if(opened)opened.close();toast("Document could not be opened: "+error.message)}
   finally{button.disabled=false}
  }));
  const noteForm=root.querySelector("#newClientNote");
  noteForm.onsubmit=async event=>{
   event.preventDefault();if(!noteForm.reportValidity())return;
   const message=String(new FormData(noteForm).get("note")||"").trim();
   if(!message)return;
   const button=noteForm.querySelector('button[type="submit"]');button.disabled=true;
   try{
    await request(a,"add_note",{client_id:id,note:message});
    toast("Note saved in "+LABEL[a]);
    await openClient(a,id,"files");
   }catch(error){toast("Could not save note: "+error.message);button.disabled=false;}
  };
 }catch(error){
  dlg.innerHTML='<div class="modal-card"><button class="close-button" id="closeErr">×</button>'+
    '<p class="auth-warn">'+esc(error?.message||"Client record could not be loaded.")+'</p></div>';
  dlg.querySelector("#closeErr").onclick=()=>{dlg.innerHTML=""};
 }
}

/* Arctos-style office appointment and new-client quick actions. */
const ocScheduler={
 arctos:"https://bogusfmvdrlvxscopgaw.supabase.co/functions/v1/office-schedule",
 platinum:"https://sggzshbdfgkyyvxbebul.supabase.co/functions/v1/office-schedule",
 office:"https://aefdewkiqgiwkquklnvr.supabase.co/functions/v1/office-schedule"
};
async function requestSchedule(which, action, params={},retried=false){
 if(!access?.access_token)throw Error("Sign in before scheduling");
 let response=await fetch(ocScheduler[which],{method:"POST",headers:{"authorization":"Bearer "+access.access_token,"content-type":"application/json"},body:JSON.stringify({action,...params}),cache:"no-store"});
 if(response.status===401&&!retried){await refresh();return requestSchedule(which,action,params,true)}
 let result=await response.json().catch(()=>({error:"Could not read the scheduling response"}));
 if(!response.ok)throw Error(result.error||"Scheduling service unavailable");
 return result;
}
function ocCloseEntry(){
 activeClient=null;
 const el=document.getElementById("dialog");if(el)el.innerHTML="";
}
function ocAgencyMarkup(withOffice){
 return '<option value="">Select agency</option>'
 +Object.keys(LABEL).filter(a=>(a!=="office"||withOffice)&&(a==="office"||connected[a])).map(a=>'<option value="'+a+'">'+esc(a==="office"?"Office Staff":LABEL[a])+'</option>').join("");
}
function ocOpenAppointmentForm(prefillDay,phoneHint=""){
 const dialog=document.getElementById("dialog");if(!dialog)return;
 let day=/^\d{4}-\d{2}-\d{2}$/.test(String(prefillDay||""))?prefillDay:ocISO(new Date());
 let scheduleSeq=0,searchSeq=0,selectedClient=null,currentAgent="",mode="existing";
 let slotList='<option value="">Choose a time</option>';
 for(let h=8;h<20;h++)for(let m=0;m<60;m+=30){
  const v=String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");
  slotList+='<option value="'+v+'">'+(h%12||12)+':'+String(m).padStart(2,"0")+(h<12?" AM":" PM")+'</option>';
 }
 dialog.innerHTML='<section class="modal-card wide office-entry-dialog" role="dialog" aria-modal="true" aria-label="New appointment"><div class="modal-header"><div><div class="eyebrow">OFFICE CALENDAR</div><h2>Set Appointment</h2><p>Same client and appointment workflow as Arctos, with an agency and agent selection.</p></div><button class="close-button" type="button" id="officeCloseAppointment" aria-label="Close">×</button></div>'
 +'<form id="officeAppointmentForm" autocomplete="off"><div class="form-grid"><div class="field"><label for="oaAgency">Agency / Office</label><select name="agency" id="oaAgency" required>'+ocAgencyMarkup(true)+'</select></div><div class="field"><label for="oaAgent">Agent / Staff</label><select name="agent_id" id="oaAgent" required disabled><option value="">Select agency first</option></select></div><div class="field"><label for="oaType">Type</label><select name="event_type" id="oaType"><option value="appointment">Appointment</option><option value="activity">Activity</option></select></div></div>'
 +'<div class="office-mode-picker" role="group" aria-label="Appointment person type"><button type="button" class="active" id="oaExisting" aria-pressed="true">EXISTING CLIENT</button><button type="button" id="oaNew" aria-pressed="false">NEW / NON-CLIENT</button></div>'
 +'<div id="oaExistingPane"><div class="field"><label for="oaSearch">Client</label><input id="oaSearch" type="search" placeholder="Type client name or phone" autocomplete="off" disabled></div><div id="oaSearchResults" class="office-search-options"></div><p class="muted" id="oaSelected">No client selected</p></div>'
 +'<div id="oaNewPane" hidden><div class="form-grid"><div class="field"><label for="oaPerson">New / Non-client Name</label><input id="oaPerson" name="person_name" maxlength="150"></div><div class="field"><label for="oaPhone">Phone Number</label><input id="oaPhone" name="person_phone" type="tel" maxlength="40"></div></div></div>'
 +'<div class="form-grid" style="margin-top:17px"><div class="field full"><label for="oaTitle">Appointment / Activity Title</label><input name="title" id="oaTitle" maxlength="180" placeholder="Automatically uses the client name if left blank"></div><div class="field"><label for="oaDate">Appointment Date</label><input type="date" name="date" id="oaDate" value="'+esc(day)+'" required></div><div class="field"><label for="oaTime">Appointment Time</label><select name="time" id="oaTime" required disabled>'+slotList+'</select></div><div class="field full"><p class="office-status-line" id="oaAvailability" role="status">Select the agency, agent, and date to check available times.</p></div><div class="field full"><label for="oaNotes">Notes (optional)</label><textarea name="notes" id="oaNotes" maxlength="3800" placeholder="Purpose of the appointment or anything to remember"></textarea></div></div><div class="office-form-error" id="oaError" role="alert"></div><div class="form-actions"><button class="outline" id="oaCancel" type="button">Cancel</button><button class="primary" type="submit" id="oaSave">Add to Calendar</button></div></form></section>';
 const form=document.getElementById("officeAppointmentForm"),agencyEl=form.querySelector("#oaAgency"),agentEl=form.querySelector("#oaAgent"),clientInput=form.querySelector("#oaSearch"),results=form.querySelector("#oaSearchResults"),selected=form.querySelector("#oaSelected"),timeEl=form.querySelector("#oaTime"),dateEl=form.querySelector("#oaDate"),statusEl=form.querySelector("#oaAvailability"),errorEl=form.querySelector("#oaError");
 const existingBtn=form.querySelector("#oaExisting"),newBtn=form.querySelector("#oaNew"),existingPane=form.querySelector("#oaExistingPane"),newPane=form.querySelector("#oaNewPane");
 if(phoneHint){form.querySelector("#oaNotes").value="Call follow-up · Phone: "+String(phoneHint).slice(0,40);form.querySelector("#oaPhone").value=String(phoneHint).slice(0,40);}
 document.getElementById("officeCloseAppointment").onclick=ocCloseEntry;
 form.querySelector("#oaCancel").onclick=ocCloseEntry;
 dialog.onclick=e=>{if(e.target===dialog)ocCloseEntry()};
 function clearClient(){selectedClient=null;clientInput.value="";results.innerHTML="";selected.textContent="No client selected";}
 function pickMode(name){
  mode=name;
  existingPane.hidden=mode!=="existing";newPane.hidden=mode!=="new";
  existingBtn.classList.toggle("active",mode==="existing");newBtn.classList.toggle("active",mode==="new");
  existingBtn.setAttribute("aria-pressed",String(mode==="existing"));newBtn.setAttribute("aria-pressed",String(mode==="new"));
  clearClient();
 }
 existingBtn.onclick=()=>{if(agencyEl.value!=="office")pickMode("existing")};
 newBtn.onclick=()=>pickMode("new");
 agencyEl.onchange=async()=>{
  const selectedAgency=agencyEl.value,id=++scheduleSeq;
  agentEl.innerHTML='<option value="">Loading agents…</option>';agentEl.disabled=true;
  timeEl.disabled=true;statusEl.textContent="Select an agent to check time availability.";clearClient();currentAgent="";
  clientInput.disabled=true;errorEl.textContent="";
  if(selectedAgency==="office"){pickMode("new");existingBtn.disabled=true;}
  else{pickMode("existing");existingBtn.disabled=false;}
  if(!selectedAgency){agentEl.innerHTML='<option value="">Select agency first</option>';return}
  try{
   const data=await requestSchedule(selectedAgency,"agents");
   if(id!==scheduleSeq||!agentEl.isConnected)return;
   agentEl.innerHTML='<option value="">Select agent / staff member</option>'+data.agents.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.full_name)+'</option>').join("");
   agentEl.disabled=false;
  }catch(e){if(id===scheduleSeq){agentEl.innerHTML='<option value="">Agent list unavailable</option>';errorEl.textContent=e.message;}}
 };
 agentEl.onchange=()=>{
  currentAgent=agentEl.value;clearClient();clientInput.disabled=!currentAgent||agencyEl.value==="office";
  checkSlots();
 };
 dateEl.onchange=checkSlots;
 async function checkSlots(){
  const seq=++scheduleSeq;
  const which=agencyEl.value,agent=agentEl.value,date=dateEl.value;
  timeEl.disabled=true;
  Array.from(timeEl.options).forEach(o=>{o.disabled=false;if(o.value)o.textContent=o.textContent.replace(" — Booked","")});
  timeEl.value="";
  if(!which||!agent||!date){statusEl.textContent="Choose a date and agent to see available times.";return}
  statusEl.textContent="Checking this person's calendar…";
  try{
   const info=await requestSchedule(which,"slots",{agent_id:agent,date});
   if(seq!==scheduleSeq||!timeEl.isConnected)return;
   const blocked=new Set(info.blocked||[]);
   for(const option of timeEl.options){if(blocked.has(option.value)){option.disabled=true;option.textContent+=" — Booked";}}
   timeEl.disabled=false;
   statusEl.textContent=(24-blocked.size)+" of 24 half-hour times are available for this agent.";
  }catch(e){if(seq===scheduleSeq){statusEl.textContent="Cannot verify availability: "+e.message;errorEl.textContent="Time selection disabled until availability can be checked.";}}
 }
 let searchTimer=null;
 clientInput.addEventListener("input",()=>{
  selectedClient=null;selected.textContent="No client selected";const term=clientInput.value.trim();const id=++searchSeq;
  clearTimeout(searchTimer);results.innerHTML="";
  if(term.length<2||!agentEl.value)return;
  searchTimer=setTimeout(async()=>{
   try{
    const data=await requestSchedule(agencyEl.value,"client_search",{agent_id:agentEl.value,search:term});
    if(id!==searchSeq||!results.isConnected)return;
    results.innerHTML=(data.clients||[]).map(c=>'<button type="button" class="office-search-result" data-oa-client="'+esc(c.id)+'"><b>'+esc([c.first_name,c.last_name].join(" "))+'</b><small>'+esc(c.phone||"")+'</small></button>').join("")||'<p class="muted">No clients found for this agent.</p>';
    results.querySelectorAll("[data-oa-client]").forEach(b=>b.onclick=()=>{
      const c=(data.clients||[]).find(row=>row.id===b.dataset.oaClient);if(!c)return;
      selectedClient=c;clientInput.value=[c.first_name,c.last_name].join(" ");selected.textContent="Selected: "+clientInput.value;results.innerHTML="";
    });
   }catch(e){if(id===searchSeq)results.textContent=e.message}
  },280);
 });
 form.onsubmit=async e=>{
  e.preventDefault();errorEl.textContent="";
  const which=agencyEl.value,agent=agentEl.value,dt=dateEl.value,time=timeEl.value;
  if(!which||!agent||!dt||!time){errorEl.textContent="Select agency, agent, date and an available time.";return}
  if(mode==="existing"&&!selectedClient){errorEl.textContent="Choose an existing client from the search results.";return}
  if(mode==="new"&&!form.querySelector("#oaPerson").value.trim()){errorEl.textContent="Enter a name for this appointment.";return}
  const btn=form.querySelector("#oaSave");btn.disabled=true;btn.textContent="Saving appointment…";
  try{
   const input=new FormData(form);
   await requestSchedule(which,"book",{agency:which,agent_id:agent,client_id:mode==="existing"?selectedClient?.id:null,person_name:mode==="existing"?clientInput.value:input.get("person_name"),person_phone:input.get("person_phone"),event_type:input.get("event_type"),date:dt,time,title:input.get("title"),notes:input.get("notes")});
   ocCloseEntry();toast("Appointment saved to "+(LABEL[which]||"Office Calendar"));
   if(tab==="calendar"){calendarLoading=true;showCalendar();await fetchCalendar();showCalendar();}
   else if(tab==="dashboard"){await fetchCalendar();render();}
  }catch(e){errorEl.textContent=e.message;await checkSlots();}
  finally{if(btn.isConnected){btn.disabled=false;btn.textContent="Add to Calendar"}}
 };
}

function ocOpenNewClientForm(){
 activeClient=null;
 const dlg=document.getElementById("dialog");
 if(!dlg)return;
 const newClient={};
 const creationNote='<p class="oc-client-readonly-hint">Once the new client is saved, return to its Arctos-style record to review and manage coverage, medical history, notes and documents.</p>';
 const overview=ocClientGlance(newClient,"",true)+
  '<form id="officeNewClientForm" autocomplete="off">'+
   ocClientGeneralFields(newClient,"new")+
   '<div class="oc-client-save-footer"><span>Choose the agency and agent, then save this client.</span>'+
   '<button type="submit" class="primary" id="onSave">Save New Client</button></div></form>';
 dlg.innerHTML='<div class="modal-card wide oc-arctos-client-dialog oc-new-client-dialog" role="dialog" aria-modal="true">'+
  ocClientHeader("New Client","Save directly to Arctos or Platinum Financial")+
  '<div class="oc-client-four-tabs">'+ocClientNav()+
  ocClientPanel("overview",overview)+
  ocClientPanel("coverage",'<div class="oc-client-group-heading"><strong>Insurance & Coverage</strong><p>Medicare, life insurance, hospital indemnity and retirement.</p></div>'+
    creationNote+
    ocClientAccordion("Medicare & Current Coverage","Medicare and Medicaid plan details",'<p class="oc-client-empty">Available after you save this client.</p>',"medicare")+
    ocClientAccordion("Life Insurance","Policies and beneficiaries",'<p class="oc-client-empty">Available after saving.</p>',"life")+
    ocClientAccordion("Hospital Indemnity","Supplemental insurance",'<p class="oc-client-empty">Available after saving.</p>',"hospital")+
    ocClientAccordion("Retirement","Retirement accounts",'<p class="oc-client-empty">Available after saving.</p>',"retirement"))+
  ocClientPanel("medical",'<div class="oc-client-group-heading"><strong>Medical Information</strong><p>Doctors, medications and pharmacies.</p></div>'+
    creationNote+
    ocClientAccordion("Doctors","Healthcare providers",'<p class="oc-client-empty">Available after saving.</p>',"doctors")+
    ocClientAccordion("Medications & Pharmacies","Prescriptions and pharmacy information",'<p class="oc-client-empty">Available after saving.</p>',"medications"))+
  ocClientPanel("files",'<div class="oc-client-group-heading"><strong>Notes & Files</strong><p>Client documents and other records.</p></div>'+
    creationNote+ocClientAccordion("Client Notes","Personal notes and updates",'<p class="oc-client-empty">Available after saving.</p>',"notes")+
    ocClientAccordion("Documents & Files","SOA forms, policy documents and file uploads",'<p class="oc-client-empty">Available after saving.</p>',"documents"))+
  '<p class="oc-client-modal-error" id="onError" role="alert"></p></div></div>';
 const root=dlg.querySelector(".oc-arctos-client-dialog");
 ocClientBindTabs(root);
 const form=root.querySelector("#officeNewClientForm"),agencyEl=form.querySelector("#onAgency"),
  agentEl=form.querySelector("#onAgent"),errorEl=root.querySelector("#onError");
 let dirty=false,seq=0;
 const close=()=>{
  if(dirty&&!confirm("Discard this unsaved new client?"))return;
  ocCloseEntry();
 };
 root.querySelector("[data-office-client-close]").onclick=close;
 dlg.onclick=e=>{if(e.target===dlg)close()};
 form.addEventListener("input",()=>{
  dirty=true;
  const values=Object.fromEntries(new FormData(form).entries());
  const name=[values.first_name,values.last_name].filter(Boolean).join(" ");
  const title=root.querySelector("[data-office-client-name]");
  if(title)title.textContent=name||"New Client";
  const age=ocClientAge(values.date_of_birth);
  const meta=root.querySelector("[data-office-client-meta]");
  if(meta)meta.textContent=[
   values.date_of_birth?"DOB: "+ocClientDisplayDate(values.date_of_birth)+(age===null?"":" (Age: "+age+")"):"",
   values.phone||"",
   [values.city,values.state].filter(Boolean).join(", "),
   values.zip_code?"ZIP: "+values.zip_code:""
  ].filter(Boolean).join(" · ")||"Enter client information below.";
 });
 agencyEl.onchange=async()=>{
  const turn=++seq,which=agencyEl.value;
  agentEl.disabled=true;agentEl.innerHTML='<option value="">Loading agents…</option>';errorEl.textContent="";
  if(!which){agentEl.innerHTML='<option value="">Choose agency first</option>';return;}
  try{
   const result=await requestSchedule(which,"agents");
   if(turn!==seq||!agentEl.isConnected)return;
   agentEl.innerHTML='<option value="">Choose agent</option>'+
    (result.agents||[]).map(item=>'<option value="'+esc(item.id)+'">'+esc(item.full_name||"Agent")+'</option>').join("");
   agentEl.disabled=false;
  }catch(error){if(turn===seq)errorEl.textContent="Cannot load agents: "+error.message}
 };
 form.onsubmit=async event=>{
  event.preventDefault();errorEl.textContent="";
  if(!form.reportValidity()||!agencyEl.value||!agentEl.value){
   errorEl.textContent="Choose the agency and assigned agent, and complete required names.";
   ocClientBindTabs(root,"overview");return;
  }
  const button=form.querySelector("#onSave");button.disabled=true;button.textContent="Saving…";
  try{
   const data=Object.fromEntries(new FormData(form).entries());
   const agencyName=String(data.agency||"");
   const result=await requestSchedule(agencyName,"create_client",{
    ...data,agent_id:agentEl.value
   });
   if(!result?.id)throw Error("Save was not confirmed by the agency.");
   dirty=false;ocCloseEntry();toast("New client saved to "+LABEL[agencyName]+".");
   savedSearch=String(data.last_name||"");
   await openClient(agencyName,result.id);
  }catch(error){errorEl.textContent="Could not save client: "+error.message;}
  finally{if(button.isConnected){button.disabled=false;button.textContent="Save New Client";}}
 };
}

screen.addEventListener("submit",async e=>{
 if(e.target.id!=="login-form")return;
 e.preventDefault();let input=new FormData(e.target),email=String(input.get("email")||""),password=String(input.get("password")||"");setError("Signing in…");
 try{
 const r=await fetch(MM_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":PUBLIC_KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password}),cache:"no-store"});
 const info=await r.json();if(!r.ok||!info.access_token)throw Error("Invalid email or password");
 access=info;password="";
 await checkConnections();
 sessionStorage.setItem("office_login_session",JSON.stringify(access));tab="dashboard";shell();render();loadTab();
 }catch(error){setError(error.message||"Login failed")}
});
(async()=>{try{let s=sessionStorage.getItem("office_login_session");if(s){access=JSON.parse(s);await checkConnections();shell();render();loadTab();return}}catch{}showLogin()})();
})();
