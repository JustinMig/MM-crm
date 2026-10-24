// @ts-nocheck -- Supabase Edge Function is compiled by Deno, not the Next.js TypeScript project.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { writeOfficeRecord, recordSelection } from "./office-record-store.ts";
const MM_URL="https://aefdewkiqgiwkquklnvr.supabase.co";
const MM_PUBLIC="sb_publishable_3dEzyrV3AvaxDMQDMTsvKw_mT7M_vqx";
const SCOPE="arctos";
const ROOT_ORIGIN="https://office-crm-sand.vercel.app";
const SERVICE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const json=(body:unknown,code=200)=>new Response(JSON.stringify(body),{status:code,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store","Vary":"Origin","Access-Control-Allow-Origin":ROOT_ORIGIN,"X-Content-Type-Options":"nosniff"}});
const uuid=(s:unknown)=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(s||""));
const authorizedChanges=new Set(["first_name","last_name","middle_name","phone","email","date_of_birth","gender","address1","address2","city","county","state","zip_code","status","products","notes","spouse","height_feet","height_inches","weight_lbs","smoker","veteran","drivers_license_expiration","drivers_license_state","doctors_section_notes","old_plan_carrier","old_plan_id","old_plan_member_id","old_plan_year"]);
const clientSelection=SCOPE==="platinum"?"id,assigned_agent_id,first_name,last_name,middle_name,phone,email,date_of_birth,gender,address1,address2,city,county,state,zip_code,status,products,notes,spouse,height_feet,height_inches,weight_lbs,smoker,veteran,drivers_license_expiration,drivers_license_state":"id,assigned_agent_id,first_name,last_name,phone,email,date_of_birth,gender,address1,address2,city,county,state,zip_code,status,products,notes,spouse,height_feet,height_inches,weight_lbs,smoker,veteran,drivers_license_expiration,drivers_license_state,doctors_section_notes,old_plan_carrier,old_plan_id,old_plan_member_id,old_plan_year";
const safeMessage=(e:unknown)=>e instanceof Error?e.message:"Request failed";
authorizedChanges.add("assigned_agent_id");
function admin(){if(!SERVICE_URL||!SERVICE_KEY)throw Error("Agency secure connection is not configured");return createClient(SERVICE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})}
async function check(req:Request){
 const header=req.headers.get("authorization")||"";
 if(!/^Bearer\s+\S+$/i.test(header))throw Error("Sign in to Office CRM to continue");
 const token=header.replace(/^Bearer\s+/i,"");
 const h={"apikey":MM_PUBLIC,"Authorization":"Bearer "+token,"Accept":"application/json"};
 const identity=await fetch(MM_URL+"/auth/v1/user",{headers:h,cache:"no-store"});
 if(!identity.ok)throw Error("Office login expired or invalid");
 const person=await identity.json();
 if(!uuid(person.id))throw Error("Invalid office identity");
 const acl=await fetch(MM_URL+"/rest/v1/office_crm_access?select=active,arctos_access,platinum_access,can_edit,can_view_sensitive&user_id=eq."+encodeURIComponent(person.id),{headers:h,cache:"no-store"});
 if(!acl.ok)throw Error("Office permissions are unavailable");
 const list=await acl.json();
 const permission=Array.isArray(list)?list[0]:null;
 if(!permission?.active || !(SCOPE==="arctos"?permission.arctos_access:permission.platinum_access))throw Error("Office access is not granted for this agency");
 return {id:String(person.id),email:String(person.email||""),permission};
}
async function q<T>(promise:PromiseLike<{data:T,error:any}>):Promise<T>{const {data,error}=await promise;if(error)throw Error("Agency data request failed");return data}
async function log(action:string,kind:string,objectId:string|null,actor:string){const sb=admin();await q(sb.from("office_crm_audit").insert({actor_id:actor,agency:SCOPE,operation:action,object_type:kind,object_id:uuid(objectId)?objectId:null}));}
async function readClient(sb:ReturnType<typeof admin>,id:string){if(!uuid(id))throw Error("Invalid client record");return q(sb.from("clients").select(clientSelection).eq("id",id).maybeSingle())}

/* Protected client data remains inside each agency.
   Every call is authorized via MM office identity + agency-specific permission
   before decrypting, is logged, and is never cached or stored in Office CRM. */
const OFFICE_ARCTOS_ACTORS:Record<string,string>={
 "9c9b6c8a-add4-475d-bda5-c27169f117a1":"9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9",
 "6c0698be-d030-44db-94ec-c771013ec1a9":"5f5e61af-f5bb-452c-82bc-31d85e84e218"
};
const SECURE_KINDS=["identifiers","banking","medicare_gov","reviews"];
async function platinumKey(purpose:string){
 const specific=Deno.env.get("PLATINUM_SENSITIVE_ENCRYPTION_KEY");
 const secret=(purpose==="client-sensitive"&&specific)||SERVICE_KEY;
 if(!secret)throw Error("Protected data encryption is not configured");
 const enc=new TextEncoder();
 const label="platinum-"+purpose+"-v1:"+secret;
 const bytes=await crypto.subtle.digest("SHA-256",enc.encode(label));
 return crypto.subtle.importKey("raw",bytes,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
function decodedCiphertext(input:string){
 if(!input.startsWith("\\x"))return input;
 const bytes=input.slice(2);
 if(bytes.length===0||bytes.length%2!==0||!/^[0-9a-f]+$/i.test(bytes))throw Error("Invalid protected record");
 const data=new Uint8Array(bytes.length/2);
 for(let i=0;i<data.length;i++)data[i]=Number.parseInt(bytes.slice(i*2,i*2+2),16);
 return new TextDecoder().decode(data);
}
async function platinumDecrypt(ciphertext:string,purpose:string,asJSON=false){
 const wrapped=decodedCiphertext(ciphertext);
 const parts=wrapped.split(".");
 if(parts.length!==3||parts[0]!=="v1")throw Error("Unsupported protected record format");
 const from64=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
 const result=await crypto.subtle.decrypt({name:"AES-GCM",iv:from64(parts[1])},await platinumKey(purpose),from64(parts[2]));
 const plain=new TextDecoder().decode(result);
 return asJSON?JSON.parse(plain):plain;
}
async function platinumEncrypt(value:unknown,purpose:string,asJSON=false){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const plain=asJSON?JSON.stringify(value):String(value??"");
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await platinumKey(purpose),new TextEncoder().encode(plain)));
 const to64=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
 return "v1."+to64(iv)+"."+to64(encrypted);
}
function scrubBanking(raw:unknown){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const result:Record<string,unknown>={};
 for(const [key,value] of Object.entries(raw as Record<string,unknown>)){
  const norm=key.toLowerCase();
  if(/cvv|cvc|security_code|card_pin|pin_code|card_cvv|card_cvc|password|security_answer/i.test(norm))continue;
  if(norm==="card_number"){
   const digits=String(value||"").replace(/\D/g,"");
   result.card_last4=digits?digits.slice(-4):"";
   continue;
  }
  if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")result[key]=value;
 }
 return result;
}
const protectedAllowed:Record<string,string[]>={
 identifiers:["ssn","medicare_number","medicaid_number","drivers_license_number"],
 banking:["payment_method","bank_name","account_name","routing_number","account_number","payment_notes","card_number","card_expiration","card_notes"],
 medicare_gov:["username","password","verification_type","verification_destination","security_answer"]
};
const cleanText=(value:unknown,max=4000)=>String(value??"").trim().slice(0,max);
async function saveOfficeProtected(sb:ReturnType<typeof admin>,kind:string,id:string,values:unknown,actor:{id:string;email:string;permission:any}){
 if(!actor.permission.can_edit||!actor.permission.can_view_sensitive)throw Error("Protected information editing is not authorized");
 if(!protectedAllowed[kind]||!values||typeof values!=="object"||Array.isArray(values))throw Error("Invalid protected information update");
 if(!uuid(id)||!await q(sb.from("clients").select("id").eq("id",id).maybeSingle()))throw Error("Client record not found");
 const supplied:Record<string,string>={};
 for(const key of protectedAllowed[kind])if(Object.prototype.hasOwnProperty.call(values,key))supplied[key]=cleanText((values as Record<string,unknown>)[key],key.includes("notes")?4000:512);
 if(!Object.keys(supplied).length)throw Error("No protected changes supplied");
 if(SCOPE==="arctos"){
  const actorID=OFFICE_ARCTOS_ACTORS[actor.id];if(!actorID)throw Error("Office identity is not mapped to an authorized Arctos account");
  const getFn=kind==="identifiers"?"mh_client_sensitive_get":kind==="banking"?"mh_client_banking_get":"mh_medicare_gov_credentials_get";
  const saveFn=kind==="identifiers"?"mh_client_sensitive_save":kind==="banking"?"mh_client_banking_save":"mh_medicare_gov_credentials_save";
  const current=await sb.rpc(getFn,{p_client_id:id,p_actor_id:actorID});if(current.error)throw Error("Protected agency read was denied or unavailable");
  const merged={...(current.data&&typeof current.data==="object"?current.data:{}),...supplied};
  const args:any={p_client_id:id,p_actor_id:actorID};args[kind==="identifiers"?"p_sensitive":kind==="banking"?"p_banking":"p_credentials"]=merged;
  const saved=await sb.rpc(saveFn,args);if(saved.error)throw Error("Protected agency save was denied or unavailable");
 }else if(kind==="identifiers"){
  const fields:Record<string,string>={ssn:"ssn_encrypted",medicare_number:"medicare_number_encrypted",medicaid_number:"medicaid_number_encrypted",drivers_license_number:"drivers_license_number_encrypted"};
  const update:Record<string,unknown>={client_id:id,updated_at:new Date().toISOString()};
  for(const [key,value] of Object.entries(supplied))update[fields[key]]=value?await platinumEncrypt(value,"client-sensitive"):null;
  await q(sb.from("client_sensitive").upsert(update,{onConflict:"client_id"}));
 }else{
  const table=kind==="banking"?"client_banking_vault":"client_medicare_gov_vault";
  const purpose=kind==="banking"?"client-banking":"client-medicare-gov";
  const stored=await q(sb.from(table).select("encrypted_payload").eq("client_id",id).maybeSingle());
  const current=stored?.encrypted_payload?await platinumDecrypt(String(stored.encrypted_payload),purpose,true):{};
  const merged={...(current&&typeof current==="object"?current:{}),...supplied} as Record<string,unknown>;
  if(kind==="banking"&&Object.prototype.hasOwnProperty.call(supplied,"card_number")){
   merged.card_last4=cleanText(supplied.card_number).replace(/\D/g,"").slice(-4);delete merged.card_number;
  }
  await q(sb.from(table).upsert({client_id:id,encrypted_payload:await platinumEncrypt(merged,purpose,true),updated_at:new Date().toISOString()},{onConflict:"client_id"}));
 }
 await log("update_protected",kind,id,actor.id);
 return {saved:true};
}
const healthFields:Record<string,string[]>={
 doctors:["doctor_name","specialty","practice_name","phone","fax","address","city","state","zip_code","notes"],
 medications:["medication_name","strength","dosage","frequency","prescribing_doctor","purpose","status","notes"],
 pharmacies:["pharmacy_name","pharmacy_location","pharmacy_name_2","pharmacy_location_2","medication_notes"]
};
const medicaidLevels=new Set(["","None","QMB","QMB+","SLMB","SLMB+","QI","QDWI","FBDE"]);
async function saveMedicaidLevel(sb:ReturnType<typeof admin>,id:string,value:unknown,actor:{id:string;permission:any}){
 if(!actor.permission.can_edit)throw Error("Editing is not authorized");
 if(!uuid(id)||!await q(sb.from("clients").select("id").eq("id",id).maybeSingle()))throw Error("Client record not found");
 const medicaidLevel=cleanText(value,32);if(!medicaidLevels.has(medicaidLevel))throw Error("Invalid Medicaid level");
 await q(sb.from("medicare_details").upsert({client_id:id,medicaid_level:medicaidLevel||null,updated_at:new Date().toISOString()},{onConflict:"client_id"}));
 await log("update","medicare_details",id,actor.id);return {saved:true,medicaid_level:medicaidLevel};
}
async function saveHealthRecords(sb:ReturnType<typeof admin>,kind:string,id:string,rows:unknown,actor:{id:string;permission:any}){
 if(!actor.permission.can_edit)throw Error("Editing is not authorized");
 if(!healthFields[kind]||!Array.isArray(rows)||rows.length>50)throw Error("Invalid medical record update");
 if(!uuid(id)||!await q(sb.from("clients").select("id").eq("id",id).maybeSingle()))throw Error("Client record not found");
 if(kind==="pharmacies"){
  const source=rows[0]&&typeof rows[0]==="object"?rows[0] as Record<string,unknown>:{};
  const payload:Record<string,unknown>={client_id:id,updated_at:new Date().toISOString()};
  for(const key of healthFields.pharmacies)payload[key]=cleanText(source[key],key==="medication_notes"?2000:220)||null;
  const hasValue=healthFields.pharmacies.some(key=>!!payload[key]);
  if(!hasValue)await q(sb.from("client_pharmacies").delete().eq("client_id",id));
  else {if(!payload.pharmacy_name)payload.pharmacy_name=payload.pharmacy_name_2||"Pharmacy";await q(sb.from("client_pharmacies").upsert(payload,{onConflict:"client_id"}));}
 }else{
  const table=kind==="doctors"?"client_doctors":"client_medications";
  const nameKey=kind==="doctors"?"doctor_name":"medication_name";
  const existing=await q(sb.from(table).select("id").eq("client_id",id));
  const existingIds=new Set((existing||[]).map((row:any)=>String(row.id))),keep:string[]=[];
  for(const source of rows){
   if(!source||typeof source!=="object")continue;
   const input=source as Record<string,unknown>,name=cleanText(input[nameKey],180);if(!name)continue;
   const payload:Record<string,unknown>={client_id:id,updated_at:new Date().toISOString()};
   for(const key of healthFields[kind])payload[key]=cleanText(input[key],key==="notes"?2000:220)||null;
   payload[nameKey]=name;if(kind==="medications"&&!payload.status)payload.status="active";
   const rowId=uuid(input.id)&&existingIds.has(String(input.id))?String(input.id):"";
   if(rowId){await q(sb.from(table).update(payload).eq("id",rowId).eq("client_id",id));keep.push(rowId);}
   else {const created=await q(sb.from(table).insert(payload).select("id").single());if(created?.id)keep.push(String(created.id));}
  }
  const removed=(existing||[]).map((row:any)=>String(row.id)).filter((rowId:string)=>!keep.includes(rowId));
  if(removed.length)await q(sb.from(table).delete().eq("client_id",id).in("id",removed));
 }
 await log("update",kind,id,actor.id);return {saved:true};
}
async function officeProtected(sb:ReturnType<typeof admin>,kind:string,id:string,actor:{id:string;email:string;permission:any}){
 if(!actor.permission.can_view_sensitive)throw Error("Protected data access is not authorized");
 if(!SECURE_KINDS.includes(kind))throw Error("Invalid protected data section");
 if(!uuid(id))throw Error("Invalid client ID");
 const client=await q(sb.from("clients").select("id").eq("id",id).maybeSingle());
 if(!client)throw Error("Client record not found");
 if(kind==="reviews"){
   const athena=await q(sb.from("athena_medicare_reviews").select("id,review_kind,workflow_status,review_date,form_data").eq("client_id",id).order("created_at",{ascending:false}).limit(20));
   const extra=SCOPE==="platinum"?await q(sb.from("medicare_reviews").select("id,review_data,created_at").eq("client_id",id).order("created_at",{ascending:false}).limit(20)):[];
   await log("view_protected","reviews",id,actor.id);
   return {kind,data:{athena_reviews:athena,medicare_reviews:extra}};
 }
 let value:unknown=null;
 if(SCOPE==="arctos"){
  const actorID=OFFICE_ARCTOS_ACTORS[actor.id];
  if(!actorID)throw Error("Office identity is not mapped to an authorized Arctos account");
  const fn=kind==="identifiers"?"mh_client_sensitive_get":kind==="banking"?"mh_client_banking_get":"mh_medicare_gov_credentials_get";
  const result=await sb.rpc(fn,{p_client_id:id,p_actor_id:actorID});
  if(result.error)throw Error("Protected agency read was denied or unavailable");
  value=result.data;
 }else{
  if(kind==="identifiers"){
   const fields:Record<string,string>={ssn:"ssn_encrypted",medicare_number:"medicare_number_encrypted",medicaid_number:"medicaid_number_encrypted",drivers_license_number:"drivers_license_number_encrypted"};
   const data=await q(sb.from("client_sensitive").select(Object.values(fields).join(",")).eq("client_id",id).maybeSingle());
   if(data){
    const decrypted:Record<string,string>={};
    for(const [key,col] of Object.entries(fields)){
      const cipher=(data as Record<string,any>)[col];
      decrypted[key]=cipher?String(await platinumDecrypt(String(cipher),"client-sensitive")):"";
    }
    value=decrypted;
   }
  }else{
   const table=kind==="banking"?"client_banking_vault":"client_medicare_gov_vault";
   const purpose=kind==="banking"?"client-banking":"client-medicare-gov";
   const data=await q(sb.from(table).select("encrypted_payload").eq("client_id",id).maybeSingle());
   if(data?.encrypted_payload)value=await platinumDecrypt(String(data.encrypted_payload),purpose,true);
  }
 }
 if(kind==="banking")value=scrubBanking(value);
 // Audit before releasing the protected response, without logging any field values.
 await log("view_protected",kind,id,actor.id);
 return {kind,data:value};
}

async function perform(action:string,data:any,actor:{id:string;email:string;permission:any}){
 const sb=admin();
 if(action==="session")return {connected:true,agency:SCOPE,permissions:{edit:!!actor.permission.can_edit,sensitive:!!actor.permission.can_view_sensitive}};
 if(action==="save_record"||action==="delete_record")return await writeOfficeRecord({sb,actor,scope:SCOPE,log},action,data);
 if(action==="document_url"){
   const clientID=String(data.client_id||""), documentID=String(data.document_id||"");
   if(!uuid(clientID)||!uuid(documentID))throw Error("Invalid client or document");
   const found=await q(sb.from("documents").select("id,client_id,storage_path").eq("id",documentID).eq("client_id",clientID).maybeSingle());
   if(!found)throw Error("Document does not belong to this client");
   if(!String(found.storage_path||"").startsWith(clientID+"/"))throw Error("Document path failed client isolation check");
   const bucket=SCOPE==="arctos"?"mh-client-documents":"platinum-client-documents";
   const result=await sb.storage.from(bucket).createSignedUrl(found.storage_path,60);
   if(result.error||!result.data?.signedUrl)throw Error("Document could not be opened from the private agency bucket");
   await log("open_document","document",clientID,actor.id);
   return {url:result.data.signedUrl,expires_in_seconds:60};
 }
 if(action==="secure_client"){
  const id=String(data.client_id||"");
  const kind=String(data.kind||"");
  return await officeProtected(sb,kind,id,actor);
 }
 if(action==="save_sensitive"){
  return await saveOfficeProtected(sb,String(data.kind||""),String(data.client_id||""),data.values,actor);
 }
 if(action==="save_health_records"){
  return await saveHealthRecords(sb,String(data.kind||""),String(data.client_id||""),data.rows,actor);
 }
 if(action==="save_medicare_details"){
  return await saveMedicaidLevel(sb,String(data.client_id||""),data.medicaid_level,actor);
 }
  if(action==="search"){
  const word=String(data.search||"").replace(/[^\p{L}\p{N} '-]/gu,"").trim().slice(0,70);
  if(word.length<2) return {clients:[]};
  const value=word.replace(/['%_]/g,"").trim();
  if(value.length<2)return {clients:[]};
  let qry=sb.from("clients").select("id,first_name,last_name,phone,date_of_birth,city,state,status,assigned_agent_id,products");
  const parts=value.split(/\s+/);
  if(parts.length>1)qry=qry.ilike("first_name","%"+parts[0]+"%").ilike("last_name","%"+parts.slice(1).join(" ")+"%");
  else qry=qry.or("first_name.ilike.%"+value+"%,last_name.ilike.%"+value+"%,phone.ilike.%"+value+"%");
  const clients=await q(qry.order("last_name",{ascending:true}).limit(40));
  return {clients};
 }
 if(action==="client"){
  const id=String(data.client_id||""); const client=await readClient(sb,id);
  if(!client)throw Error("Client record not found");
  const tables=[
   ["medicare_details","client_id,part_a_date,part_b_date,medicaid_level,notes,sunfire_code,medicaid_number"],
   ["health_plans","id,client_id,carrier,plan_name,plan_id,member_id,plan_type,effective_date,termination_date,premium,status,notes"],
   ["life_policies","id,client_id,carrier,product,policy_number,policy_type,face_amount,premium,premium_mode,effective_date,status,notes,beneficiary_name,beneficiary_relationship"],
   ["client_notes","id,client_id,title,body,created_at"],
   ["hospital_indemnity_plans","*"],
   ["retirement_accounts",recordSelection(SCOPE,"retirement_accounts")],
   ["athena_medicare_reviews","id,client_id,review_kind,workflow_status,review_date,next_contact_date"],
   ["client_sms_messages","id,client_id,direction,body,status,occurred_at"],
   ["client_completed_appointments","event_id,client_id,event_date,start_time,activity_title,completed_at"],
   ["client_review_manual","client_id,review_year,completed,completed_at"],


   ["documents","id,client_id,file_name,category,mime_type,created_at"],
   ["client_doctors","*"],["client_pharmacies","*"],["client_medications","*"]
  ] as const;
  const details:any={},detail_errors:Record<string,string>={};
  await Promise.all(tables.map(async ([name,selection])=>{try{const selected=["medicare_details","health_plans","life_policies","hospital_indemnity_plans","retirement_accounts","client_doctors","client_medications","client_pharmacies"].includes(name)?recordSelection(SCOPE,name):selection;const v=await q(sb.from(name).select(selected).eq("client_id",id).limit(100));details[name]=v;}catch{details[name]=[];detail_errors[name]="This section could not load";}}));
  return {client,details,detail_errors};
 }
 if(action==="appointments"){
  const from=String(data.from||"").slice(0,10);const to=String(data.to||"").slice(0,10);
  if(!/^\d{4}-\d\d-\d\d$/.test(from)||!/^\d{4}-\d\d-\d\d$/.test(to))throw Error("Date range required");
  let rows:any[];
  if(SCOPE==="arctos") rows=await q(sb.from("appointments").select("id,client_id,assigned_agent_id,title,event_type,event_date,start_time,end_time,status,notes").gte("event_date",from).lte("event_date",to).order("event_date").limit(300));
  else rows=await q(sb.from("appointments").select("id,client_id,assigned_agent_id,title,event_type,event_date,start_time,end_time,starts_at,ends_at,status,notes").gte("starts_at",from+"T00:00:00-06:00").lte("starts_at",to+"T23:59:59-05:00").order("starts_at").limit(300));
  return {appointments:rows};
 }
 if(action==="lead_agents"){
  const agents=await q(sb.from("profiles").select("id,full_name,role").eq("active",true).in("role",["owner","agent"]).order("full_name",{ascending:true}).limit(150));
  return {agents};
 }
 if(action==="leads"){
  const agentId=String(data.agent_id||"");
  if(!uuid(agentId))throw Error("Select an agent to view leads");
  const matched=await q(sb.from("profiles").select("id").eq("id",agentId).eq("active",true).in("role",["owner","agent"]).maybeSingle());
  if(!matched)throw Error("Selected agent is not available in this agency");
  const leads=await q(sb.from("workspace_leads")
   .select("id,assigned_agent_id,first_name,last_name,date_of_birth,phone,product_type,is_medicare,is_life,is_retirement,notes,status,client_id,created_at,updated_at,converted_at")
   .eq("assigned_agent_id",agentId)
   .order("created_at",{ascending:false})
   .limit(500));
  return {leads};
 }
 if(action==="campaign_agents"){
  const agents=await q(sb.from("profiles").select("id,full_name,role").eq("active",true).in("role",["owner","agent"]).order("full_name",{ascending:true}).limit(150));
  return {agents};
 }
 if(action==="campaigns"){
  const agentId=String(data.agent_id||"");
  if(agentId){
   if(!uuid(agentId))throw Error("Invalid selected agent");
   const matched=await q(sb.from("profiles").select("id").eq("id",agentId).eq("active",true).in("role",["owner","agent"]).maybeSingle());
   if(!matched)throw Error("Selected agent was not found in this agency");
  }
  let query=sb.from("campaigns").select("id,name,topic,description,owner_id,assigned_agent_id,status,created_at");
  if(agentId)query=query.eq("assigned_agent_id",agentId);
  const campaigns=await q(query.order("created_at",{ascending:false}).limit(200));
  return {campaigns};
 }
 if(action==="campaign_members"){
  const campaign_id=String(data.campaign_id||"");
  if(!uuid(campaign_id))throw Error("Invalid campaign");
  const belongs=await q(sb.from("campaigns").select("id").eq("id",campaign_id).maybeSingle());
  if(!belongs)throw Error("Campaign not found");
  const members=await q(sb.from("campaign_members").select("id,client_id,contact_status,attempt_count,last_contacted_at,last_note,next_action").eq("campaign_id",campaign_id).limit(200));
  return {members};
 }
 if(action==="save_client"){
  if(!actor.permission.can_edit)throw Error("Editing is not authorized");
  const id=String(data.client_id||""); if(!uuid(id))throw Error("Invalid client");
  const existing=await readClient(sb,id);if(!existing)throw Error("Client record not found");
  const fields=data.changes||{};if(!fields || typeof fields!=="object" || Array.isArray(fields))throw Error("Invalid changes");
  const clean:Record<string,any>={};
  for(const [name,value] of Object.entries(fields)){if(SCOPE==="arctos"&&name==="middle_name")throw Error("This field is not available in Arctos");if(!authorizedChanges.has(name))throw Error("Field is not available in Office CRM");if(value!==null&&typeof value!=="string"&&typeof value!=="number"&&typeof value!=="boolean"&&!Array.isArray(value))throw Error("Invalid field type");if(typeof value==="string"&&value.length>2000)throw Error("Value too long");clean[name]=value;}
  if(!Object.keys(clean).length)throw Error("No changes supplied");
  if("assigned_agent_id" in clean){
   if(!uuid(clean.assigned_agent_id))throw Error("Choose an assigned agent");
   if(!await q(sb.from("profiles").select("id").eq("id",clean.assigned_agent_id).eq("active",true).in("role",["owner","agent"]).maybeSingle()))throw Error("Assigned agent is not available");
  }
  if("products" in clean&&(!Array.isArray(clean.products)||clean.products.some((value:unknown)=>!["medicare","life","retirement"].includes(String(value)))))throw Error("Invalid product choices");
  if(clean.status==="deceased"||existing.status==="deceased"&&!clean.status)clean.products=[];
  await q(sb.from("clients").update(clean).eq("id",id).select("id").single());
  await log("update","client",id,actor.id);
  return {saved:true};
 }
 if(action==="add_note"){
  if(!actor.permission.can_edit)throw Error("Editing is not authorized");
  const id=String(data.client_id||"");if(!uuid(id))throw Error("Invalid client");
  const client=await readClient(sb,id);if(!client)throw Error("Client not found");
  const message=String(data.note||"").trim().slice(0,4000);if(!message)throw Error("Note is required");
  const attribution="Office CRM — "+actor.email;
  if(SCOPE==="arctos") await q(sb.from("client_notes").insert({client_id:id,author_id:null,title:attribution,body:message}).select("id").single());
  else {const owner=await q(sb.from("profiles").select("id").eq("role","owner").eq("active",true).limit(1).single());
    await q(sb.from("client_notes").insert({client_id:id,author_id:owner.id,title:attribution,note:message,body:message}).select("id").single());}
  await log("create","client_note",id,actor.id);
  return {saved:true};
 }
 throw Error("Unsupported Office CRM operation");
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:{"Access-Control-Allow-Origin":ROOT_ORIGIN,"Access-Control-Allow-Headers":"authorization,content-type,apikey","Access-Control-Allow-Methods":"POST,OPTIONS","Vary":"Origin"}});
 if(req.method!=="POST")return json({error:"POST required"},405);
 try{
  if((req.headers.get("content-type")||"").split(";")[0]!=="application/json")return json({error:"JSON required"},415);
  const actor=await check(req);
  const data=await req.json(); const action=String(data?.action||"");
  const out=await perform(action,data,actor);
  return json(out);
 }catch(e){let reason=safeMessage(e);let code=/login|identity|sign in|expired|invalid session/i.test(reason)?401:/access|permission|authorized/i.test(reason)?403:400;
  if(reason==="Agency data request failed")code=502;
  return json({error:reason},code);
 }
});
