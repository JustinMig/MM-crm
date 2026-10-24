// @ts-nocheck -- Compiled by the Supabase Edge runtime.
// Shared, explicitly allowed client-record writes for both agency bridges.
const common={
 medicare_details:['part_a_date','part_b_date','medicaid_level','sunfire_code','notes'],
 health_plans:['carrier','plan_name','plan_id','member_id','plan_type','effective_date','termination_date','premium','status','notes'],
 life_policies:['carrier','product','policy_number','policy_type','face_amount','premium','premium_mode','effective_date','expiration_date','status','beneficiary_name','beneficiary_relationship','beneficiary_notes','notes'],
 hospital_indemnity_plans:['carrier','plan_name','policy_number','member_id','effective_date','premium','admission_benefit','daily_benefit','benefit_days','notes','status'],
 retirement_accounts:['carrier','product','contract_number','account_type','contribution_amount','contribution_frequency','effective_date','status','notes','account_value'],
 client_doctors:['doctor_name','specialty','practice_name','phone','fax','address','city','state','zip_code','notes'],
 client_medications:['medication_name','strength','dosage','frequency','prescribing_doctor','purpose','status','notes'],
 client_pharmacies:['pharmacy_name','pharmacy_location','pharmacy_name_2','pharmacy_location_2','medication_notes']
};
const platinum={
 medicare_details:['medicaid_enrolled','medicaid_effective_date','medicare_gov_connected','current_plan_name','current_plan_year','current_plan_member_id'],
 hospital_indemnity_plans:['hospital_daily_benefit','ambulance_benefit','outpatient_benefit','cancer_benefit','skilled_nursing_benefit']
};
const numeric=new Set(['premium','face_amount','admission_benefit','daily_benefit','benefit_days','contribution_amount','account_value','current_plan_year','hospital_daily_benefit','ambulance_benefit','outpatient_benefit','cancer_benefit','skilled_nursing_benefit']);
const booleans=new Set(['medicaid_enrolled','medicare_gov_connected']);
const singletons=new Set(['medicare_details','client_pharmacies']);
const uuid=(value)=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(value||''));
export function recordFields(scope,table){return [...(common[table]||[]),...(scope==='platinum'?platinum[table]||[]:[])];}
export function recordSelection(scope,table){return [singletons.has(table)?'client_id':'id,client_id','updated_at',...recordFields(scope,table)].join(',');}
export async function writeOfficeRecord(context,action,data){
 const {sb,actor,scope,log}=context,table=String(data.table||''),clientId=String(data.client_id||''),recordId=data.record_id?String(data.record_id):null;
 if(!actor.permission.can_edit)throw Error('Editing is not authorized');
 if(!common[table])throw Error('This record section is not editable');
 if(!uuid(clientId))throw Error('Invalid client record');
 const query=async promise=>{const {data,error}=await promise;if(error)throw Error('Agency record could not be saved. Reopen the client and try again.');return data;};
 if(!await query(sb.from('clients').select('id').eq('id',clientId).maybeSingle()))throw Error('Client record not found');
 if(recordId&&!uuid(recordId))throw Error('Invalid record ID');
 let existing=null;
 if(recordId&&!singletons.has(table)){
  existing=await query(sb.from(table).select('id,client_id').eq('id',recordId).maybeSingle());
  if(existing&&existing.client_id!==clientId)throw Error('Record does not belong to this client');
 }
 if(action==='delete_record'){
  if(singletons.has(table)||!recordId||!existing)throw Error('Record not found');
  await query(sb.from(table).delete().eq('client_id',clientId).eq('id',recordId));
  await log('delete',table,recordId,actor.id);return {saved:true};
 }
 const source=data.changes;
 if(!source||typeof source!=='object'||Array.isArray(source)||!Object.keys(source).length)throw Error('No changes supplied');
 const allowed=recordFields(scope,table),changes={};
 for(const [key,input] of Object.entries(source)){
  if(!allowed.includes(key))throw Error('Field is not available in this section');
  if(input!==null&&!['string','number','boolean'].includes(typeof input))throw Error('Invalid field value');
  if(input===null||input===''){changes[key]=null;continue;}
  if(numeric.has(key)){
   const n=Number(input);if(!Number.isFinite(n)||n<0||(['benefit_days','current_plan_year'].includes(key)&&!Number.isInteger(n)))throw Error('Enter a valid amount or number');changes[key]=n;
  }else if(booleans.has(key)){
   if(![true,false,'true','false'].includes(input))throw Error('Invalid yes or no choice');changes[key]=input===true||input==='true';
  }else if(key.endsWith('_date')){
   const v=String(input);if(!/^\d{4}-\d\d-\d\d$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Enter a valid date');changes[key]=v;
  }else{
   const v=String(input).trim(),max=key.includes('notes')?4000:500;if(v.length>max)throw Error('Field is too long');changes[key]=v||null;
  }
 }
 if('medicaid_level' in changes&&!['',null,'None','QMB','QMB+','SLMB','SLMB+','QI','QDWI','FBDE'].includes(changes.medicaid_level))throw Error('Invalid Medicaid level');
 if('status' in changes&&!['active','inactive'].includes(changes.status))throw Error('Choose Active or Inactive');
 const required=table==='client_doctors'?'doctor_name':table==='client_medications'?'medication_name':null;
 if(required&&((required in changes&&!changes[required])||(!existing&&!changes[required])))throw Error('Enter the '+(required==='doctor_name'?'doctor':'medication')+' name');
 if(table==='client_pharmacies'&&scope==='platinum'&&'pharmacy_name' in changes&&!changes.pharmacy_name)changes.pharmacy_name='';
 const payload={...changes,updated_at:new Date().toISOString()};
 let record;
 if(singletons.has(table)){
  const stored=await query(sb.from(table).select('client_id').eq('client_id',clientId).maybeSingle());
  record=stored?await query(sb.from(table).update(payload).eq('client_id',clientId).select(recordSelection(scope,table)).single()):await query(sb.from(table).insert({client_id:clientId,...payload,...(table==='client_pharmacies'&&scope==='platinum'&&!payload.pharmacy_name?{pharmacy_name:''}:{})}).select(recordSelection(scope,table)).single());
 }else if(existing){
  let update=sb.from(table).update(payload).eq('client_id',clientId).eq('id',recordId);
  if(data.expected_updated_at)update=update.eq('updated_at',data.expected_updated_at);
  record=await query(update.select(recordSelection(scope,table)).maybeSingle());
  if(!record)throw Error('This record was updated in another session. Reopen the client before saving.');
 }else record=await query(sb.from(table).insert({client_id:clientId,...(recordId?{id:recordId}:{}),...payload}).select(recordSelection(scope,table)).single());
 await log(existing?'update':'save',table,record?.id||clientId,actor.id);
 return {saved:true,record};
}
