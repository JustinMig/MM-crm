-- Current agency assignments are checked by the Office bridge. The agent stored
-- on an Office thread may predate reassignment and is not authoritative.
create or replace function public.office_sms_inbox_sources(p_agency uuid,p_scope text,p_legacy_agent uuid)
returns table(source text, source_id uuid, summary jsonb)
language sql stable security invoker set search_path='' as $$
 with office as (
  select distinct on (t.id)
   t.id as thread_id,t.remote_client_id,t.phone,t.legacy_client_id,
   count(*) filter(where m.direction='inbound' and m.read_at is null) over(partition by t.id) as unread_count,
   m.body as latest_body,m.created_at as latest_at
  from public.office_sms_threads t
  join public.office_sms_messages m on m.thread_id=t.id
  where t.agency_id=p_agency and t.scope=p_scope and m.notification_hidden_at is null
    and right(regexp_replace(coalesce(t.phone,''),'[^0-9]','','g'),10)<>'6627504626'
    and right(regexp_replace(coalesce(m.from_number,''),'[^0-9]','','g'),10)<>'6627504626'
    and right(regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g'),10)<>'6627504626'
  order by t.id,m.created_at desc,m.id desc
 ), legacy as (
  select distinct on (c.id)
   c.id as client_id,trim(concat_ws(' ',c.first_name,c.last_name)) as client_name,coalesce(c.phone,'') as phone,
   c.assigned_agent_id,p.full_name as agent_name,
   count(*) filter(where m.direction='inbound' and m.read_at is null) over(partition by c.id) as unread_count,
   m.body as latest_body,m.created_at as latest_at
  from public.client_sms_messages m
  join public.clients c on c.id=m.client_id
  join public.profiles p on p.id=c.assigned_agent_id
  where c.agency_id=p_agency and c.assigned_agent_id=p_legacy_agent and m.notification_hidden_at is null
    and right(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),10)<>'6627504626'
    and right(regexp_replace(coalesce(m.from_number,''),'[^0-9]','','g'),10)<>'6627504626'
    and right(regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g'),10)<>'6627504626'
  order by c.id,m.created_at desc,m.id desc
 )
 select 'office'::text,office.remote_client_id,to_jsonb(office) from office
 union all
 select 'legacy'::text,legacy.client_id,to_jsonb(legacy) from legacy
$$;
revoke all on function public.office_sms_inbox_sources(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.office_sms_inbox_sources(uuid,text,uuid) to service_role;
