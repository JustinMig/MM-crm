// @ts-nocheck
const owner = "9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9";
const fields = "id,title,event_date,start_time,end_time,status,event_type,notes,client_id,updated_at";
function validDay(value) {
 return typeof value==="string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
   !isNaN(Date.parse(value+"T12:00:00Z")) && new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value;
}
function cleanChanges(value) {
 if(!value || typeof value!=="object" || Array.isArray(value))throw Error("Enter an appointment change.");
 const changes={};
 for(const [field,val] of Object.entries(value)){
  switch(field){
   case "title":
    if(typeof val!=="string" || !val.trim() || val.trim().length>250)throw Error("Enter a valid appointment title.");
    changes.title=val.trim();break;
   case "notes":
    if(val!==null && (typeof val!=="string" || val.length>5000))throw Error("Invalid appointment notes.");
    changes.notes=val||null;break;
   case "event_date":
    if(!validDay(val))throw Error("Choose a valid appointment date.");
    changes.event_date=val;break;
   case "start_time":
   case "end_time":
    if(val!==null && val!=="" && (typeof val!=="string" || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(val)))throw Error("Choose a valid appointment time.");
    changes[field]=val||null;break;
   default:throw Error("Unsupported appointment change.");
  }
 }
 if(!Object.keys(changes).length)throw Error("Enter an appointment change.");
 return changes;
}
function minutes(time){return time ? Number(time.slice(0,2))*60+Number(time.slice(3,5)) : null;}
function range(row,defaultMinutes){
 const start=minutes(row.start_time),end=minutes(row.end_time);
 return start===null?null:[start,end!==null&&end>start?end:start+defaultMinutes];
}
async function checked(query){
 const {data,error}=await query;
 if(error)throw Error("The appointment could not be loaded or saved. Refresh the calendar.");
 return data;
}
export async function mutateOfficeCalendar({sb,central,actor,uuid,log},input){
 if(!actor.permission.can_edit)throw Error("Editing is not authorized.");
 const {operation,event_id:id,calendar_source:source,expected_status:status,event_date:date}=input;
 if(!uuid(id)||!validDay(date)||!["mayer_justin","arctos_campaign"].includes(source)||
    !["complete","delete","update"].includes(operation)||!["completed","scheduled","needs_reschedule","cancelled"].includes(status))throw Error("Invalid appointment request.");
 const shared=source==="mayer_justin";
 const sharedDay=day=>central.rpc("office_arctos_calendar_events",{p_from:day,p_to:day});
 const old=shared ? await checked(sharedDay(date).eq("id",id).maybeSingle())
                  : await checked(sb.from("appointments").select(fields).eq("id",id).eq("assigned_agent_id",owner).maybeSingle());
 if(!old||old.event_date!==date||(old.status!==status && !(operation==="complete" && old.status==="completed")))throw Error("This appointment changed. Refresh the calendar.");
 const changes=operation==="update"?cleanChanges(input.changes):{};
 if(operation==="update" && ("event_date" in changes || "start_time" in changes || "end_time" in changes)){
  const next={...old,...changes},start=minutes(next.start_time),end=minutes(next.end_time);
  if(end!==null && (start===null||end<=start))throw Error("End time must be after start time.");
  const proposed=range(next,shared?15:30);
  const rescheduled=old.status==="needs_reschedule" && (old.event_date!==next.event_date || start!==minutes(old.start_time));
  if(rescheduled && !shared){changes.status="scheduled";changes.reschedule_note=null;}
  if(proposed && (old.status==="scheduled"||rescheduled)){
   const [sharedRows,nativeRows]=await Promise.all([
    checked(sharedDay(next.event_date).eq("status","scheduled").eq("event_type","appointment")),
    checked(sb.from("appointments").select("id,start_time,end_time").eq("assigned_agent_id",owner).eq("event_date",next.event_date).eq("status","scheduled"))
   ]);
   const conflicts=(rows,defaultMinutes,sameSource)=>rows.some(row=>{
    const block=range(row,defaultMinutes);
    return !(sameSource && row.id===id) && block && proposed[0]<block[1] && block[0]<proposed[1];
   });
   if(conflicts(sharedRows,15,shared)||conflicts(nativeRows,30,!shared))throw Error("That time is already booked. Choose another time.");
  }
 }
 if(shared){
  const {error}=await central.rpc("office_change_arctos_shared_event",{p_id:id,p_operation:operation,p_date:date,p_status:old.status,p_changes:changes});
  if(error)throw Error(error.code==="23P01"?"That time is already booked. Choose another time.":"The shared appointment changed or could not be saved. Refresh the calendar.");
 }else{
  const query=operation==="delete"?sb.from("appointments").delete():sb.from("appointments").update(operation==="complete"?{status:"completed"}:changes);
  const row=await checked(query.eq("id",id).eq("assigned_agent_id",owner).eq("updated_at",old.updated_at).select("id").maybeSingle());
  if(!row)throw Error("This appointment changed. Refresh the calendar.");
  await log(operation+"_appointment","appointment",id,actor.id);
 }
 if(operation==="complete"){
  let clientId=old.client_id;
  if(!clientId && shared){
   const link=await checked(sb.from("calendar_event_client_links").select("client_id").eq("event_id",id).maybeSingle());
   clientId=link?.client_id;
  }
  if(clientId){
   const detail=await checked(sb.from("calendar_event_details").select("activity_title").eq("event_id",id).maybeSingle());
   await checked(sb.from("client_completed_appointments").upsert({
    event_id:id,client_id:clientId,event_date:old.event_date,start_time:old.start_time,activity_title:detail?.activity_title||""
   },{onConflict:"event_id",ignoreDuplicates:true}));
  }
 }
 return {saved:true};
}
