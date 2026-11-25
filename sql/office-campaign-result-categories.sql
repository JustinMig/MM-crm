-- Office-only view: retain native agency statuses and expose the actual Office result.
create or replace view public.office_campaign_queue with (security_invoker=true) as
 select r.*,
 case when r.contact_status='no_answer' and coalesce(last_result.office_outcome,to_jsonb(r)->>'source_last_outcome')='busy' then 'busy'
      when r.contact_status='not_interested' then 'declined'
      when r.contact_status='spoke' then 'face_to_face'
      else coalesce(r.contact_status,'not_contacted') end as office_status
 from public.campaign_member_results r
 left join lateral (
  select coalesce(op.outcome,l.outcome) as office_outcome
  from public.campaign_contact_log l
  left join office_campaign_private.operations op on op.id=l.id and op.member_id=r.id
  where l.member_id=r.id and l.outcome not in ('note','return_step1') and coalesce(op.undone,false)=false
  order by l.created_at desc,op.after_version desc nulls last,l.id desc limit 1
 ) last_result on true;
revoke all on public.office_campaign_queue from public,anon,authenticated;
grant select on public.office_campaign_queue to service_role;

create or replace function public.office_campaign_summaries(p_agent_id uuid)
 returns table(id uuid,name text,topic text,description text,status text,assigned_agent_id uuid,owner_id uuid,created_at timestamptz,counts jsonb)
 language sql stable security invoker set search_path='' as $$
 select c.id,c.name,c.topic,c.description,c.status,c.assigned_agent_id,c.owner_id,c.created_at,
 coalesce((select jsonb_object_agg(x.office_status,x.n) from (
  select m.office_status,count(*)::integer n from public.office_campaign_queue m where m.campaign_id=c.id group by m.office_status
 )x),'{}'::jsonb)
 from public.campaigns c where c.assigned_agent_id=p_agent_id order by c.created_at desc,c.id
$$;
revoke all on function public.office_campaign_summaries(uuid) from public,anon,authenticated;
grant execute on function public.office_campaign_summaries(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.office_campaign_update(p_campaign_id uuid, p_member_id uuid, p_agent_id uuid, p_staff_id uuid, p_operation_id uuid, p_expected_version integer, p_scope text, p_action text, p_outcome text DEFAULT NULL::text, p_note text DEFAULT ''::text, p_next_action text DEFAULT ''::text, p_event_date date DEFAULT NULL::date, p_start_time time without time zone DEFAULT NULL::time without time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 m public.campaign_members%rowtype; c public.campaigns%rowtype;
 op office_campaign_private.operations%rowtype; previous office_campaign_private.operations%rowtype;
 old_sub text:=current_setting('request.jwt.claim.sub',true); snapshot jsonb; result jsonb;
 actual_outcome text:=case p_outcome when 'busy' then 'no_answer' else p_outcome end;
 scope_name text:=p_scope;
begin
 if p_scope not in ('arctos','platinum') or p_scope is null then raise exception 'Invalid agency context.'; end if;
 if p_staff_id is null or p_operation_id is null then raise exception 'A staff identity and update identifier are required.'; end if;
 select * into op from office_campaign_private.operations where id=p_operation_id;
 if found then
  if op.member_id<>p_member_id or op.campaign_id<>p_campaign_id or op.agent_id<>p_agent_id or op.staff_id<>p_staff_id or op.kind<>p_action then raise exception 'This update identifier was already used.'; end if;
  return jsonb_build_object('saved',true,'already_saved',true,'removed',op.kind='remove');
 end if;
 select * into c from public.campaigns where id=p_campaign_id and assigned_agent_id=p_agent_id for share;
 if not found or c.status<>'active' then raise exception 'Choose an active campaign for the selected agent.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_agent_id and active is true) then raise exception 'Selected agent is unavailable.' using errcode='42501'; end if;
 select * into m from public.campaign_members where id=p_member_id and campaign_id=c.id for update;
 if not found then raise exception 'Campaign client not found or access denied.' using errcode='42501'; end if;
 if p_action<>'remove' and not exists(select 1 from public.clients where id=m.client_id and assigned_agent_id=p_agent_id and status is distinct from 'deceased') then raise exception 'Client is unavailable for the selected agent.' using errcode='42501'; end if;
 if p_action<>'remove' and m.contact_status='do_not_call' then raise exception 'Do Not Call is recorded. Contact updates are disabled.' using errcode='42501'; end if;
 if p_expected_version is null or m.version<>p_expected_version then raise exception 'This client changed in another session. Refresh the campaign before saving.' using errcode='40001'; end if;
 snapshot:=to_jsonb(m);
 perform set_config('request.jwt.claim.sub',p_agent_id::text,true);
 if p_action='contact' then
  if actual_outcome not in ('no_answer','voicemail','declined','appointment','follow_up','face_to_face','completed') or actual_outcome is null then raise exception 'Choose a valid contact result.'; end if;
  result:=public.campaign_record_contact(m.id,p_operation_id,p_expected_version,actual_outcome,
    case when p_outcome='busy' then concat_ws(E'\n','Busy',nullif(btrim(p_note),'')) else p_note end,
    p_next_action,p_event_date,p_start_time,30,p_agent_id,false);
 elsif p_action='note' then
  result:=public.campaign_save_member_note(m.id,p_operation_id,p_expected_version,p_note);
 elsif p_action='reset' then
  result:=public.campaign_return_to_step_one(m.id,p_operation_id,p_expected_version,p_note);
 elsif p_action='undo' then
  select * into previous from office_campaign_private.operations
   where member_id=m.id and not undone and kind in ('contact','note','reset') and after_version=m.version
   order by after_version desc limit 1 for update;
  if not found then raise exception 'The latest change cannot be undone safely. Refresh the campaign.'; end if;
  if previous.kind='contact' and previous.outcome in ('appointment','follow_up') and m.next_event_id is distinct from (previous.before_state->>'next_event_id')::uuid then
   update public.appointments set status='cancelled' where id=m.next_event_id and client_id=m.client_id and status='scheduled';
  end if;
  update public.campaign_members set
    contact_status=previous.before_state->>'contact_status',
    attempt_count=(previous.before_state->>'attempt_count')::integer,
    last_contacted_at=(previous.before_state->>'last_contacted_at')::timestamptz,
    last_note=coalesce(previous.before_state->>'last_note',''),
    next_action=coalesce(previous.before_state->>'next_action',''),
    next_event_id=(previous.before_state->>'next_event_id')::uuid,version=version+1 where id=m.id;
  update office_campaign_private.operations set undone=true where id=previous.id;
  insert into public.campaign_contact_log(id,member_id,actor_id,outcome,note)
   values(p_operation_id,m.id,p_agent_id,'note','Office CRM: Undid the last outreach update.');
 elsif p_action='remove' then
  snapshot:=snapshot||jsonb_build_object('contact_history',coalesce((select jsonb_agg(to_jsonb(l)) from public.campaign_contact_log l where member_id=m.id),'[]'::jsonb));
  delete from public.campaign_members where id=m.id;
 else raise exception 'Unsupported campaign update.';
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 insert into office_campaign_private.operations(id,member_id,client_id,campaign_id,agent_id,staff_id,kind,outcome,before_state,after_version)
 values(p_operation_id,m.id,m.client_id,c.id,p_agent_id,p_staff_id,p_action,p_outcome,snapshot,m.version+1);
 insert into public.office_crm_audit(actor_id,agency,operation,object_type,object_id)
 values(p_staff_id,scope_name,'campaign_'||p_action,'campaign_operation',p_operation_id);
 return jsonb_build_object('saved',true,'already_saved',false,'removed',p_action='remove');
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);raise;
end $function$
;
