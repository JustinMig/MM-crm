import {createClient} from "npm:@supabase/supabase-js@2.57.0";
const SCOPE="arctos";
const MM="https://aefdewkiqgiwkquklnvr.supabase.co";
const PUBLIC="sb_publishable_3dEzyrV3AvaxDMQDMTsvKw_mT7M_vqx";
const officeOrigins=new Set(["https://office.mayerig.com","https://office-crm-sand.vercel.app"]);
const uuid=s=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(s||""));
const sb=()=>createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
async function actor(req){
 const h=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(h))throw Error("Sign in required");
 const headers={apikey:PUBLIC,authorization:h,accept:"application/json"};
 const id=await fetch(MM+"/auth/v1/user",{headers,cache:"no-store"});
 if(!id.ok)throw Error("Session expired");
 const user=await id.json();if(!uuid(user.id))throw Error("Invalid identity");
 const acl=await fetch(MM+"/rest/v1/office_crm_access?select=active,can_edit,arctos_access,platinum_access&user_id=eq."+user.id,{headers,cache:"no-store"});
 if(!acl.ok)throw Error("Permission check unavailable");
 const list=await acl.json(),a=list?.[0];
 if(!a?.active||!a.can_edit||(SCOPE==="arctos"&&!a.arctos_access)||(SCOPE==="platinum"&&!a.platinum_access))throw Error("Office scheduling is not authorized");
 return user.id;
}
async function read(p){const {data,error}=await p;if(error)throw Error(error.message||"Database operation failed");return data;}
async function validAgent(db,id){
 if(!uuid(id))throw Error("Choose an agent or staff member");
 const roles=SCOPE==="office"?["manager"]:["owner","agent"];
 const a=await read(db.from("profiles").select("id,full_name,role").eq("id",id).eq("active",true).in("role",roles).maybeSingle());
 if(!a)throw Error("Agent or staff member is unavailable");
 return a;
}
function dateCheck(value){
 const v=String(value||"");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||new Date(v+"T12:00:00Z").toISOString().slice(0,10)!==v)throw Error("Choose a valid appointment date");
 return v;
}
function timeCheck(v){
 const s=String(v||"").slice(0,5);
 if(!/^\d{2}:(00|30)$/.test(s)||s<"08:00"||s>"19:30")throw Error("Choose a time from 8 AM to 7:30 PM");
 return s;
}
function clean(v,limit){return String(v??"").trim().slice(0,limit);}
function oneHourLater(n){return (n+30);}
function dateParts(t){
 const fmt=new Intl.DateTimeFormat("en-US",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 const x=Object.fromEntries(fmt.formatToParts(new Date(t)).filter(y=>y.type!=="literal").map(y=>[y.type,y.value]));
 return {day:x.year+"-"+x.month+"-"+x.day,start:Number(x.hour)*60+Number(x.minute)};
}
const minute=s=>{let m=String(s||"").match(/^(\d\d):(\d\d)/);return m?+m[1]*60+(+m[2]):null;};
const JUSTIN_ARCTOS="9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9";
async function sharedBlocks(agent,date,authorization){
 if(agent!==JUSTIN_ARCTOS)return [];
 const response=await fetch(MM+"/rest/v1/rpc/office_arctos_calendar_events?select=start_time,end_time&event_type=eq.appointment&status=eq.scheduled",{
  method:"POST",headers:{apikey:PUBLIC,authorization,"content-type":"application/json"},
  body:JSON.stringify({p_from:date,p_to:date}),cache:"no-store",signal:AbortSignal.timeout(12000)
 });
 if(!response.ok)throw Error("The shared Justin calendar could not be checked. Please retry.");
 const rows=await response.json();
 if(!Array.isArray(rows))throw Error("The shared Justin calendar returned an invalid response.");
 // The shared calendar treats appointments without an end as 15 minutes.
 return rows.map(row=>{
  const start=minute(row.start_time),end=minute(row.end_time);
  return {...row,duration:end!==null&&start!==null&&end>start?end-start:15};
 });
}
function overlapsSlot(row,start){
 const bookedStart=minute(row.start_time);
 return !["cancelled","completed"].includes(row.status)&&bookedStart!==null&&bookedStart<start+30&&
  (row.duration?bookedStart+row.duration:minute(row.end_time)??bookedStart+30)>start;
}
async function bookedRows(db,agent,date){
 if(SCOPE==="office")return read(db.from("office_staff_appointments").select("start_time,end_time,status").eq("assigned_staff_id",agent).eq("event_date",date).neq("status","cancelled").limit(500));
 if(SCOPE==="arctos")return read(db.from("appointments").select("start_time,end_time,status").eq("assigned_agent_id",agent).eq("event_date",date).neq("status","cancelled").limit(500));
 const start=new Date(date+"T00:00:00Z");start.setUTCDate(start.getUTCDate()-1);
 const end=new Date(date+"T00:00:00Z");end.setUTCDate(end.getUTCDate()+2);
 const all=await read(db.from("appointments").select("starts_at,ends_at,status").eq("assigned_agent_id",agent).gte("starts_at",start.toISOString()).lt("starts_at",end.toISOString()).neq("status","cancelled").limit(500));
 return all.map(x=>{const b=dateParts(x.starts_at);return b.day===date?{status:x.status,start_time:String(Math.floor(b.start/60)).padStart(2,"0")+":"+String(b.start%60).padStart(2,"0"),end_time:null,duration:(Date.parse(x.ends_at)-Date.parse(x.starts_at))/60000}:null}).filter(Boolean);
}
async function run(db,action,x,user,authorization){
 if(action==="agents"){
  const roles=SCOPE==="office"?["manager"]:["owner","agent"];
  let list=await read(db.from("profiles").select("id,full_name,role").eq("active",true).in("role",roles).order("full_name").limit(100));
  if(SCOPE==="arctos")list=list.filter(r=>r.role==="owner"||r.role==="agent");
  return {agents:list};
 }
 if(action==="client_search"){
  if(SCOPE==="office")return {clients:[]};
  const agent=clean(x.agent_id,40);await validAgent(db,agent);
  const term=clean(x.search,70).replace(/[^a-zA-Z0-9 \-']/g,"").trim().replace(/[%,._]/g,"");
  if(term.length<2)return {clients:[]};
  const list=await read(db.from("clients").select("id,first_name,last_name,phone").eq("assigned_agent_id",agent).or("first_name.ilike.%"+term+"%,last_name.ilike.%"+term+"%,phone.ilike.%"+term+"%").limit(25));
  return {clients:list};
 }
 if(action==="slots"){
  const agent=clean(x.agent_id,40),date=dateCheck(x.date);await validAgent(db,agent);
  const [local,shared]=await Promise.all([bookedRows(db,agent,date),sharedBlocks(agent,date,authorization)]);
  const rows=[...local,...shared];
  let blocked=[];
  for(let h=8;h<20;h++)for(let m=0;m<60;m+=30){
   const start=h*60+m;
   if(rows.some(r=>overlapsSlot(r,start)))
    blocked.push(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
  }
  return {blocked};
 }
 if(action==="book"){
  const agent=clean(x.agent_id,40),date=dateCheck(x.date),time=timeCheck(x.time);
  await validAgent(db,agent);
  const type=clean(x.event_type,20).toLowerCase();
  if(!["appointment","activity"].includes(type))throw Error("Choose appointment or activity");
  let client=uuid(x.client_id)?String(x.client_id):null;
  let person=clean(x.person_name,150),phone=clean(x.person_phone,40),title=clean(x.title,180),notes=clean(x.notes,3800);
  if(client&&SCOPE!=="office"){
    const found=await read(db.from("clients").select("id,first_name,last_name").eq("id",client).eq("assigned_agent_id",agent).maybeSingle());
    if(!found)throw Error("The client is not assigned to this agent");
    person=[found.first_name,found.last_name].filter(Boolean).join(" ");
  }else{
    client=null;if(person.length<2)throw Error("Enter the name for the appointment");
    if(phone)notes=("Phone: "+phone+"\n"+notes).trim();
  }
  if(!title)title=(type==="activity"?"Activity: ":"Appointment: ")+person;
  const args=SCOPE==="office"
   ?{p_agent:agent,p_title:title,p_person:person,p_phone:phone,p_date:date,p_time:time,p_type:type,p_notes:notes,p_actor:user}
   :{p_agent:agent,p_client:client,p_title:title,p_date:date,p_time:time,p_type:type,p_notes:notes};
  const name=SCOPE==="office"?"office_book_staff_appointment":"office_book_agent_appointment";
  // Recheck the shared calendar at submit time. The local RPC also checks and
  // locks the selected agent's day in its own transaction.
  const shared=await sharedBlocks(agent,date,authorization);
  if(shared.some(row=>overlapsSlot(row,minute(time))))throw Error("That time is already booked for the selected person");
  const result=await db.rpc(name,args);if(result.error)throw Error(result.error.message?.includes("booked")?"That time is already booked for the selected person":result.error.message||"Unable to schedule appointment");
  await read(db.from("office_schedule_audit").insert({actor_id:user,operation:"book_appointment",entity_id:result.data}));
  return {saved:true,id:result.data};
 }
 if(action==="appointments"&&SCOPE==="office"){
  const from=dateCheck(x.from),to=dateCheck(x.to);
  if(to<from)throw Error("Invalid calendar range");
  const rows=await read(db.from("office_staff_appointments").select("id,assigned_staff_id,title,client_name,phone,event_type,event_date,start_time,end_time,status,notes").gte("event_date",from).lte("event_date",to).order("event_date").limit(300));
  return {appointments:rows.map(r=>({...r,assigned_agent_id:r.assigned_staff_id}))};
 }
 if(action==="create_client"){
  if(SCOPE==="office")throw Error("Select Arctos or Platinum Financial for a new client");
  const agent=clean(x.agent_id,40);await validAgent(db,agent);
  const first=clean(x.first_name,100),last=clean(x.last_name,100),dob=clean(x.date_of_birth,10);
  if(!first||!last)throw Error("First and last names are required");
  if(dob&&(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||new Date(dob+"T12:00:00Z").toISOString().slice(0,10)!==dob))throw Error("Invalid date of birth");
  const v={assigned_agent_id:agent,first_name:first,last_name:last,date_of_birth:dob||null,phone:clean(x.phone,40)||null,email:clean(x.email,180)||null,address1:clean(x.address1,200)||null,city:clean(x.city,100)||null,state:clean(x.state,60)||null,zip_code:clean(x.zip_code,15)||null,county:clean(x.county,100)||null};
  const result=await read(db.from("clients").insert(v).select("id").single());
  await read(db.from("office_schedule_audit").insert({actor_id:user,operation:"create_client",entity_id:result.id}));
  return {saved:true,id:result.id};
 }
 throw Error("Unsupported Office scheduling operation");
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const ORIGIN=officeOrigins.has(origin)?origin:"https://office-crm-sand.vercel.app";
 const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"private,no-store","access-control-allow-origin":ORIGIN,"vary":"Origin","x-content-type-options":"nosniff"}});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"access-control-allow-origin":ORIGIN,"access-control-allow-headers":"authorization,content-type,apikey","access-control-allow-methods":"POST,OPTIONS","vary":"Origin"}});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{const user=await actor(req);if(!(req.headers.get("content-type")||"").startsWith("application/json"))throw Error("JSON required");
   const x=await req.json();const result=await run(sb(),String(x.action||""),x,user,req.headers.get("authorization"));return json(result);
 }catch(e){let m=e instanceof Error?e.message:"Request failed";
  // Never echo database details or token material, only controlled form/data errors.
  if(m.length>260)m="The scheduling request could not be completed";
  return json({error:m},/expired|sign in/i.test(m)?401:/permission|authorized/i.test(m)?403:400);
 }
});
