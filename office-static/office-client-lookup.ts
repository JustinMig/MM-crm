// @ts-nocheck -- Read-only lookup actions behind the existing Office agency authorization.
const fields='id,first_name,last_name,phone,date_of_birth,city,state,status,assigned_agent_id,products';
export function officeBirthdayMonth(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit'}).formatToParts(now),get=key=>parts.find(part=>part.type===key).value;
 return {month:Number(get('month')),month_key:get('year')+'-'+get('month'),month_label:new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'long',year:'numeric'}).format(now)};
}
export async function officeClientLookup({sb},data,now=new Date()){
 const view=String(data.view||'stats'),month=officeBirthdayMonth(now);
 if(!['stats','birthdays','deceased'].includes(view))throw Error('Invalid client lookup');
 const check=result=>{if(result.error)throw Error('Client lookup could not load. Please retry.');return result;};
 if(view==='stats'){
  const results=await Promise.all([sb.rpc('office_client_birthdays',{p_month:month.month},{count:'exact',head:true}),sb.from('clients').select('id',{count:'exact',head:true}).eq('status','deceased')]);results.forEach(check);
  return {birthdays:results[0].count??0,deceased:results[1].count??0,month_key:month.month_key,month_label:month.month_label};
 }
 const offset=Number(data.offset??0),limit=Number(data.limit??200);
 if(!Number.isInteger(offset)||offset<0||offset>1000000||!Number.isInteger(limit)||limit<1||limit>200)throw Error('Invalid client page');
 let query=view==='birthdays'?sb.rpc('office_client_birthdays',{p_month:month.month},{count:'exact'}):sb.from('clients').select(fields,{count:'exact'}).eq('status','deceased');
 if(view==='birthdays')query=query.order('birthday_day',{ascending:true});
 const result=check(await query.order('last_name',{ascending:true}).order('first_name',{ascending:true}).order('id',{ascending:true}).range(offset,offset+limit-1));
 return {clients:result.data||[],total:result.count??(result.data||[]).length,offset,limit,month_key:month.month_key,month_label:month.month_label};
}
