// @ts-nocheck -- Original Arctos RxTerms search, behind the Office agency authorization boundary.
function cleanSearch(value){return String(value||'').replace(/[^\p{L}\p{N}\s\-'.()]/gu,'').replace(/\s+/g,' ').trim().slice(0,80);}
const strings=value=>Array.isArray(value)?value.filter(item=>typeof item==='string').map(item=>item.trim()).filter(Boolean):[];
export async function officeMedicationSearch({sb},data,fetcher=fetch){
 const term=cleanSearch(data.query);if(term.length<2)return {suggestions:[]};
 try{
  const url=new URL('https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search');url.searchParams.set('terms',term);url.searchParams.set('ef','STRENGTHS_AND_FORMS,RXCUIS');url.searchParams.set('maxList','20');
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Medication catalog unavailable');
  const payload=await response.json(),names=Array.isArray(payload?.[1])?payload[1]:[],extra=payload?.[2]||{};
  return {suggestions:names.map((name,index)=>({name:typeof name==='string'?name.trim():'',strengths:[...new Set(strings(extra.STRENGTHS_AND_FORMS?.[index]))],rxcuis:strings(extra.RXCUIS?.[index]),source:'rxterms'})).filter(item=>item.name),source:'NLM RxTerms'};
 }catch{
  const {data:rows,error}=await sb.from('client_medications').select('medication_name,strength').ilike('medication_name',term+'%').order('medication_name').limit(80);if(error)return {suggestions:[]};
  const byName=new Map();for(const row of rows||[]){const name=String(row.medication_name||'').trim();if(!name)continue;const key=name.toLocaleLowerCase('en-US');if(!byName.has(key))byName.set(key,{name,strengths:[],rxcuis:[],source:'crm'});const strength=String(row.strength||'').trim();if(strength&&!byName.get(key).strengths.includes(strength))byName.get(key).strengths.push(strength);}
  return {suggestions:[...byName.values()].slice(0,12),source:'CRM fallback'};
 }
}
