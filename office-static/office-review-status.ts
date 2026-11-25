// @ts-nocheck -- Reviews follow the same September rollover as Arctos.
export function officeReviewYear(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'numeric'}).formatToParts(now).map(p=>[p.type,p.value]));
 return Number(parts.year)-(Number(parts.month)<9?1:0);
}
export async function withOfficeReviewStatus({sb},clients,now=new Date()){
 if(!clients.length)return clients;
 const year=officeReviewYear(now),ids=[...new Set(clients.map(c=>c.id))];
 const {data,error}=await sb.from('client_review_manual').select('client_id').in('client_id',ids).eq('review_year',year).eq('completed',true);
 if(error)throw Error('Medicare review status could not load. Please retry.');
 const completed=new Set((data||[]).map(r=>r.client_id));
 return clients.map(c=>({...c,medicare_review_year:year,medicare_review_completed:completed.has(c.id)}));
}
