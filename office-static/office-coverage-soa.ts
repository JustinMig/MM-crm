// @ts-nocheck -- Runs only after the agency bridge verifies the Office session and ACL.
const UUID=value=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(value||''));
const PRODUCTS=['Medicare Advantage (Part C) / Cost Plans','Stand-alone Prescription Drug Plans (Part D)','Medicare Supplement (Medigap)','Dental / Vision / Hearing products','Hospital Indemnity products','Other Medicare-related health products'];
const query=async promise=>{const {data,error}=await promise;if(error)throw Error('The agency signing operation failed.');return data;};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export async function officeCoverageSoa({sb,actor,agencyActorId,log},action,data){
 if(!actor.permission.can_edit)throw Error('Editing is not authorized');
 const clientId=String(data.client_id||'');if(!UUID(clientId))throw Error('Invalid client');
 const client=await query(sb.from('clients').select('id,first_name,last_name,phone,address1,address2,city,state,zip_code,assigned_agent_id').eq('id',clientId).maybeSingle());
 if(!client)throw Error('Client not found');
 const actorId=agencyActorId||client.assigned_agent_id;if(!UUID(actorId))throw Error('An agency agent link is required before creating an SOA');
 const user=await query(sb.from('profiles').select('id,full_name,phone').eq('id',actorId).eq('active',true).maybeSingle());if(!user)throw Error('Agency signing access is unavailable');
 const agent=client.assigned_agent_id?await query(sb.from('profiles').select('id,full_name,phone').eq('id',client.assigned_agent_id).maybeSingle()):user;
 if(action==='coverage_soa_context')return {client,agent:agent||user,user:{id:user.id}};
 if(action!=='coverage_soa_request')throw Error('Unsupported signing operation');
 const payload=data.payload||{},value=payload.request_payload||{},products=value.products;
 if(!/^\+1\d{10}$/.test(String(payload.phone||''))||!/^[0-9a-f]{64}$/i.test(String(payload.token_hash||'')))throw Error('Invalid signing request');
 if(!validDate(value.appointment_date)||!Number.isInteger(value.coverage_year)||value.coverage_year<2000||value.coverage_year>2100)throw Error('Choose a valid appointment date and coverage year');
 if(!Array.isArray(products)||products.length>PRODUCTS.length||products.some(product=>!PRODUCTS.includes(product)))throw Error('Invalid discussion products');
 const other=String(value.other_product||'').trim();if(other.length>1000||!products.length&&!other)throw Error('Select the discussion products');
 const request={client_id:clientId,requested_by:user.id,token_hash:payload.token_hash,phone:payload.phone,request_payload:{beneficiary_name:[client.first_name,client.last_name].filter(Boolean).join(' '),beneficiary_phone:client.phone||payload.phone,beneficiary_address:[client.address1,client.address2,client.city,client.state,client.zip_code].filter(Boolean).join(', '),agent_name:(agent||user).full_name||'',agent_phone:(agent||user).phone||'',appointment_date:value.appointment_date,coverage_year:value.coverage_year,products:[...new Set(products)],other_product:other}};
 const result=await query(sb.from('soa_signature_requests').insert(request).select('id').single());
 await log('create_signing_link','soa_request',result.id,actor.id);return {saved:true};
}
