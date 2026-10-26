// Administrative initial/backfill import using the existing server-side importer.
// Logs counts and connection status only; never credentials or caller data.
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(process.cwd()+'/package.json');
const cache=new Map();
function load(path){
 if(cache.has(path))return cache.get(path);
 const exports={};cache.set(path,exports);
 const compiled=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(compiled,{exports,require:name=>{
  if(name==='server-only')return {};
  if(name==='@/lib/supabase/admin')return load('lib/supabase/admin.ts');
  if(name==='@/lib/ringcentral')return load('lib/ringcentral.ts');
  return require(name);
 },process,fetch,Buffer,URL,URLSearchParams,AbortSignal,Response,Request,Headers,Error,console,setTimeout,clearTimeout},{filename:path});
 return exports;
}
if(process.env.OFFICE_PHONE_LOADER_CHECK==='1'){
 console.log(JSON.stringify({loader_checked:typeof load('lib/office-ringcentral-sync.ts').syncOfficeRingCentral==='function'}));
}else{
 const check=JSON.parse(execFileSync(process.execPath,['scripts/check-ringcentral-voicemail.mjs'],{encoding:'utf8',timeout:40000}));
 console.log(JSON.stringify(check));
 if(check.voicemail_status===200){
  try{
   const admin=load('lib/supabase/admin.ts').createAdminClient();
   const {data,error}=await admin.from('profiles').select('agency_id').eq('id','9c9b6c8a-add4-475d-bda5-c27169f117a1').maybeSingle();
   if(error||!data?.agency_id)throw Error('Office agency is unavailable.');
   const response=await load('lib/office-ringcentral-sync.ts').syncOfficeRingCentral(data.agency_id);
   const result=await response.json();
   console.log(JSON.stringify({check:'office-phone-initial-sync',status:response.status,calls:result.synced??0,voicemails:result.voicemails??0,voicemail_warning:Boolean(result.voicemail_warning),failed:Boolean(result.error)}));
  }catch{console.log(JSON.stringify({check:'office-phone-initial-sync',failed:true}));}
 }else{console.log(JSON.stringify({check:'office-phone-initial-sync',skipped:'voicemail permission not available'}));}
}
