// Fetch beyond PostgREST's row cap without losing the current user/agent filters.
export async function loadAllClientRows(query: any) {
 const clients: any[]=[]
 let total=0
 for(let offset=0;;offset+=500){
  const result=await query.range(offset,offset+499)
  if(result.error)throw Error(result.error.message)
  const rows=result.data||[]
  total=Number(result.count??total)
  clients.push(...rows)
  if(!rows.length||clients.length>=total)return {clients,total}
 }
}
export const BULK_SMS_MAX_RECIPIENTS=5000
export function bulkSmsClientIds(value:unknown):string[]{
 if(!Array.isArray(value))return []
 if(value.length>BULK_SMS_MAX_RECIPIENTS)throw Error(`Select up to ${BULK_SMS_MAX_RECIPIENTS} clients per mass text.`)
 if(value.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)))throw Error('Invalid client selection.')
 return Array.from(new Set(value))
}
export function chunks<T>(rows:T[],size=200):T[][]{return Array.from({length:Math.ceil(rows.length/size)},(_,i)=>rows.slice(i*size,(i+1)*size))}
