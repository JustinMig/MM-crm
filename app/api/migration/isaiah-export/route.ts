import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { decryptValue } from '@/lib/crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ISAIAH = 'b34219da-711a-4f6d-a3c6-087ae96e31c4';
const tables = ['client_banking_info','client_care_info','client_health_plan_info','client_hospital_indemnity','client_life_insurance','client_medications','client_specialists','medicare_info','documents','client_sms_messages','crm_call_attempts','crm_call_list_items','crm_mail','crm_outreach_campaign_members','crm_outreach_interactions','medicare_commission_events','soa_signature_requests'];
const cipherFields = ['ssn_ciphertext','drivers_license_ciphertext','medicare_number_ciphertext','medicaid_number_ciphertext','medicare_gov_username_ciphertext','medicare_gov_password_ciphertext','medicare_gov_secret_answer_ciphertext','medicare_gov_security_code_destination_ciphertext','routing_number_ciphertext','account_number_ciphertext','debit_card_number_ciphertext','member_id_ciphertext'];
const encrypted = (plain: Buffer, passphrase: string) => {
 const salt=crypto.randomBytes(16), iv=crypto.randomBytes(12), key=crypto.scryptSync(passphrase,salt,32,{N:16384,r:8,p:1});
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const contents=Buffer.concat([cipher.update(plain),cipher.final()]);
 return {v:1,kdf:'scrypt-16384-8-1',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:contents.toString('base64')};
};
function decryptRows(rows: Record<string,unknown>[]) {
 return rows.map(row => {
   const clean={...row};
   for(const field of cipherFields) if(typeof clean[field]==='string' && clean[field]) {
     clean[field.replace('_ciphertext','_plaintext')]=decryptValue(clean[field] as string);
     delete clean[field];
   }
   return clean;
 });
}
export async function POST(req:NextRequest){
 try {
  const session=await createClient();
  const {data:{user},error:authError}=await session.auth.getUser();
  if(authError||!user) return NextResponse.json({error:'Login required'},{status:401});
  const admin=createAdminClient();
  const {data:requestor}=await admin.from('profiles').select('role').eq('id',user.id).single();
  if(user.id!==ISAIAH && !['owner','admin'].includes(requestor?.role||'')) return NextResponse.json({error:'Administrator or Isaiah only'},{status:403});
  const {offset,passphrase}=await req.json();
  if(!Number.isSafeInteger(offset)||offset<0||offset>2000||typeof passphrase!=='string'||passphrase.length<16) return NextResponse.json({error:'Use a password of at least 16 characters and a valid batch offset'},{status:400});
  const {data:clients,error:clientError}=await admin.from('clients').select('*').eq('assigned_agent_id',ISAIAH).order('id').range(offset,offset);
  if(clientError) throw clientError;
  const ids=(clients||[]).map(x=>x.id);
  const exportData:Record<string,unknown>={format:'mm-crm-isaiah-backup-v1',batch_offset:offset,client_count:ids.length,clients:decryptRows(clients||[]),related:{},files:[]};
  for(const table of tables){
    if(!ids.length)break;
    const {data,error}=await admin.from(table).select('*').in('client_id',ids).limit(1000);
    if(error) { (exportData.related as Record<string,unknown>)[table]={error:error.message}; continue; }
    (exportData.related as Record<string,unknown>)[table]=decryptRows(data||[]);
  }
  // Attachments are migrated separately through Platinum's copy-documents tool.
  // Never embed binary files in the encrypted import payload: Vercel rejects oversized requests.
  const docs=(exportData.related as Record<string,any>).documents;
  const packed=encrypted(Buffer.from(JSON.stringify(exportData),'utf8'),passphrase);
  return NextResponse.json({offset,done:ids.length<1,client_count:ids.length,package:packed,manifest:{documents:Array.isArray(docs)?docs.length:0,files:0,failures:0,attachments_separate:true}},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:'Export failed. Review server logs.',detail:String((error as Error).message).slice(0,140)},{status:500});}
}
