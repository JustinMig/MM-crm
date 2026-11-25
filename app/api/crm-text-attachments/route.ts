import { attachmentActor,maxFileSize,prepareAttachment,problem,saveAttachment } from '@/lib/crm-text-attachments'
import { OFFICE_SMS_ORIGINS } from '@/lib/office-sms'
export const runtime='nodejs'
const origins=new Set([...OFFICE_SMS_ORIGINS,'https://mh.mayerig.com','https://mig.mayerig.com','https://pf.mayerig.com','https://platinum-financial-crm.vercel.app','https://arctos.vercel.app','https://crm.mayerig.com'])
function headers(r:Request){const origin=r.headers.get('origin')||'';return {'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type, X-CRM-Scope, X-File-Name','Access-Control-Allow-Methods':'POST, OPTIONS',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})}}
export function OPTIONS(r:Request){return new Response(null,{status:204,headers:headers(r)})}
export async function POST(r:Request){
  try{
    if(r.headers.has('origin')&&!origins.has(r.headers.get('origin')!))throw problem('CRM origin is not permitted.',403)
    const scope=r.headers.get('x-crm-scope')||'',owner=await attachmentActor(scope,r.headers.get('authorization')||'')
    if(r.headers.get('x-file-name')){
      if(Number(r.headers.get('content-length'))>maxFileSize)throw problem('Choose a file up to 4 MB.',413)
      const result=await saveAttachment(scope,owner,decodeURIComponent(r.headers.get('x-file-name')!),Buffer.from(await r.arrayBuffer()))
      return Response.json(result,{headers:headers(r)})
    }
    const {id}=await r.json()
    return Response.json(await prepareAttachment(scope,owner,String(id)),{headers:headers(r)})
  }catch(e){const err=e as Error & {status?:number};return Response.json({error:err.message||'Attachment unavailable.'},{status:err.status||500,headers:headers(r)})}
}
