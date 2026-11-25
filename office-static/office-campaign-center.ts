// @ts-nocheck -- Compiled by the Supabase Edge runtime.
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
async function query(p){const {data,error}=await p;if(error)throw Error(error.code==='40001'? 'This client changed in another session. Refresh before saving.':error.message||'Campaign request failed');return data;}
const text=(v,n)=>{const s=String(v??'').trim();if(s.length>n)throw Error('The entered text is too long.');return s;};
export async function officeCampaignCenter({sb,actor,scope,log},data){
 const agent=String(data.agent_id||'');if(!uuid(agent))throw Error('Choose an agent.');
 if(!await query(sb.from('profiles').select('id').eq('id',agent).eq('active',true).in('role',['owner','agent']).maybeSingle()))throw Error('Selected agent is unavailable in this agency.');
 const command=String(data.command||'list');
 if(!['list','members','history','search_clients'].includes(command)&&!actor.permission.can_edit)throw Error('Campaign editing is not authorized.');
 if(command==='create'){
  const id=String(data.campaign_id||'');if(!uuid(id))throw Error('Invalid campaign identifier.');
  const name=text(data.name,120),topic=String(data.topic||'general');if(!name||!['medicare','life','health','retirement','general','other'].includes(topic))throw Error('Enter a campaign name and valid topic.');
  const prior=await query(sb.from('campaigns').select('id,assigned_agent_id').eq('id',id).maybeSingle());
  if(prior&&prior.assigned_agent_id!==agent)throw Error('Campaign identifier is already in use.');
  if(!prior)await query(sb.from('campaigns').insert({id,name,topic,assigned_agent_id:agent,owner_id:agent,status:'active'}));
  await log('campaign_create','campaign',id,actor.id);return {saved:true};
 }
 if(command==='list')return {campaigns:await query(sb.rpc('office_campaign_summaries',{p_agent_id:agent}))};
 const campaignId=String(data.campaign_id||'');if(!uuid(campaignId))throw Error('Invalid campaign.');
 const campaign=await query(sb.from('campaigns').select('id,assigned_agent_id,status').eq('id',campaignId).eq('assigned_agent_id',agent).maybeSingle());
 if(!campaign)throw Error('Campaign not found for the selected agent.');
 if(command==='members'){
  const offset=Number(data.offset||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('Invalid page.');
  let membersQuery=sb.from('office_campaign_queue').select('*').eq('campaign_id',campaignId);
  const category=String(data.category||'active');
  const categories={active:['not_contacted'],completed:['completed'],appointment:['appointment'],voicemail:['voicemail'],no_answer:['no_answer'],busy:['busy'],declined:['declined'],follow_up:['follow_up'],face_to_face:['face_to_face'],other:['attempted','do_not_call','unreachable']};
  if(!Object.hasOwn(categories,category))throw Error('Invalid campaign category.');
  membersQuery=membersQuery.in('office_status',categories[category]);
  const filter=String(data.filter||'all');
  if(filter==='resolved')membersQuery=membersQuery.in('office_status',['completed','declined','not_interested','do_not_call','unreachable','appointment']);
  else if(filter==='need')membersQuery=membersQuery.eq('office_status','not_contacted');
  else if(filter==='attempted')membersQuery=membersQuery.in('office_status',['no_answer','voicemail','busy','attempted']);
  else if(['face_to_face','follow_up'].includes(filter))membersQuery=membersQuery.eq('office_status',filter);
  else if(filter!=='all')throw Error('Invalid contact filter.');
  const search=text(data.search,100).replace(/[^a-zA-Z0-9 @+\-]/g,' ').trim();
  if(search)membersQuery=membersQuery.or(['full_name','phone','county','state','last_note'].map(k=>k+'.ilike.%'+search+'%').join(','));
  const rows=await query(membersQuery.order('last_name_sort').order('first_name_sort').order('id').range(offset,offset+100));
  const members=rows.slice(0,100),ids=members.map(m=>m.id);
  const context=ids.length?await query(sb.rpc('office_campaign_member_context',{p_ids:ids})):[];
  const byId=new Map(context.map(x=>[x.member_id,x]));
  return {members:members.map(m=>({...m,...byId.get(m.id)})),has_more:rows.length>100};
 }
 if(!['members','history','search_clients'].includes(command)&&campaign.status!=='active')throw Error('Choose an active campaign.');
 if(command==='add'){
  const clientId=String(data.client_id||'');if(!uuid(clientId)||!await query(sb.from('clients').select('id').eq('id',clientId).eq('assigned_agent_id',agent).neq('status','deceased').maybeSingle()))throw Error('Choose an available client for this agent.');
  await query(sb.from('campaign_members').upsert({campaign_id:campaignId,client_id:clientId,added_by:agent},{onConflict:'campaign_id,client_id',ignoreDuplicates:true}));
  await log('campaign_add_client','client',clientId,actor.id);return {saved:true};
 }
 if(command==='search_clients'){
  const search=text(data.search,100).replace(/[%_,().]/g,' ').trim();if(search.length<2)return {clients:[]};
  return {clients:await query(sb.from('clients').select('id,first_name,last_name,phone').eq('assigned_agent_id',agent).neq('status','deceased').or('first_name.ilike.%'+search+'%,last_name.ilike.%'+search+'%,phone.ilike.%'+search+'%').limit(30))};
 }
 if(command==='rename'||command==='archive'||command==='delete'){
  if(command==='rename'){const name=text(data.name,120);if(!name)throw Error('Enter a name.');await query(sb.from('campaigns').update({name}).eq('id',campaignId).eq('assigned_agent_id',agent));}
  if(command==='archive')await query(sb.from('campaigns').update({status:'archived'}).eq('id',campaignId).eq('assigned_agent_id',agent));
  if(command==='delete')await query(sb.from('campaigns').delete().eq('id',campaignId).eq('assigned_agent_id',agent));
  await log('campaign_'+command,'campaign',campaignId,actor.id);return {saved:true};
 }
 if(!uuid(data.member_id))throw Error('Invalid campaign client.');
 const member=await query(sb.from('campaign_members').select('id,client_id').eq('id',data.member_id).eq('campaign_id',campaignId).maybeSingle());
 if(!member)throw Error('Campaign client not found.');
 if(command==='history')return {history:await query(sb.from('campaign_contact_log').select('id,outcome,note,next_action,created_at').eq('member_id',member.id).order('created_at',{ascending:false}).limit(30))};
 if(!['contact','note','reset','undo','remove'].includes(command)||!uuid(data.operation_id)||!Number.isSafeInteger(data.version))throw Error('Invalid campaign update.');
 return await query(sb.rpc('office_campaign_update',{p_campaign_id:campaignId,p_member_id:member.id,p_agent_id:agent,p_staff_id:actor.id,p_operation_id:data.operation_id,p_expected_version:data.version,p_scope:scope,p_action:command,p_outcome:data.outcome||null,p_note:text(data.note,4000),p_next_action:text(data.next_action,500),p_event_date:data.event_date||null,p_start_time:data.start_time||null}));
}
