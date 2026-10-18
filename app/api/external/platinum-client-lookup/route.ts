import { NextRequest,NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {decryptValue} from '@/lib/crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const agent='b34219da-711a-4f6d-a3c6-087ae96e31c4';
const fields=['ssn_ciphertext','drivers_license_ciphertext','medicare_number_ciphertext','medicaid_number_ciphertext','routing_number_ciphertext','account_number_ciphertext','debit_card_number_ciphertext','member_id_ciphertext','medicare_gov_username_ciphertext','medicare_gov_password_ciphertext','medicare_gov_secret_answer_ciphertext','medicare_gov_security_code_destination_ciphertext'];
function safeRows(rows:Record<string,unknown>[]){return rows.map(row=>{const copy={...row};for(const f of fields)if(typeof copy[f]==='string'&&copy[f]){copy[f.replace('_ciphertext','_plaintext')]=decryptValue(copy[f] as string);delete copy[f]}return copy})}
const tables=['client_banking_info','client_care_info','client_health_plan_info','client_hospital_indemnity','client_life_insurance','client_medications','client_specialists','medicare_info','documents'];
export async function POST(req:NextRequest){
 const expected=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';
 if(!expected||!token||token.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(expected)))return NextResponse.json({error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>({}));const db=createAdminClient();
 if(body.action==='search'){
  const q=String(body.query||'').trim().replace(/[,().%*_]/g,' ').slice(0,80);
  if(q.length<2)return NextResponse.json({results:[]});
  const terms=q.split(/\s+/).filter(Boolean).slice(0,3);
  let query=db.from('clients').select('id,first_name,last_name,date_of_birth,phone,city,state,assigned_agent_id').eq('assigned_agent_id',agent);
  for(const term of terms)query=query.or('first_name.ilike.%'+term+'%,last_name.ilike.%'+term+'%');
  const {data,error}=await query.order('last_name').limit(35);
  if(error)return NextResponse.json({error:'Search failed'},{status:500});
  return NextResponse.json({results:data||[]},{headers:{'Cache-Control':'no-store'}});
 }
 if(body.action==='detail'&&/^[a-f0-9-]{36}$/i.test(String(body.id||''))){
  const {data:client,error}=await db.from('clients').select('*').eq('id',body.id).eq('assigned_agent_id',agent).maybeSingle();
  if(error||!client)return NextResponse.json({error:'Client not found'},{status:404});
  const related:Record<string,unknown>={};
  for(const t of tables){const {data,error}=await db.from(t).select('*').eq('client_id',client.id).limit(500);if(!error)related[t]=safeRows(data||[]);}
  return NextResponse.json({client:safeRows([client])[0],related},{headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.json({error:'Invalid request'},{status:400});
}