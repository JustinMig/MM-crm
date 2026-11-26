-- Match current assignments and the same U.S. phone formats accepted by Office.
create index if not exists crm_sms_client_phone_idx on public.clients
 (assigned_agent_id, (right(regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g'),10)));

create or replace function public.crm_sms_phone_candidates(p_agent uuid, p_phones text[])
returns table(id uuid,first_name text,last_name text,phone text,agency_id uuid) language sql stable security invoker set search_path = '' as $$
 select c.id,c.first_name,c.last_name,c.phone,c.agency_id from public.clients c
 where c.assigned_agent_id=p_agent
   and exists(select 1 from unnest(p_phones) p(phone)
     where p.phone ~ '^\+1[0-9]{10}$'
       and right(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),10)=right(p.phone,10)
       and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') in (right(p.phone,10),right(p.phone,11)))
$$;
revoke all on function public.crm_sms_phone_candidates(uuid,text[]) from public,anon,authenticated;
grant execute on function public.crm_sms_phone_candidates(uuid,text[]) to service_role;

-- Only routing/read-state metadata crosses projects during inbox and badge reads.
create or replace function public.platinum_sms_digest_input(p_agency uuid,p_agent uuid,p_mode text,p_unread_sids text[])
returns jsonb language sql stable security invoker set search_path = '' as $$
 with eligible as materialized (
   select m.client_id,m.id,m.twilio_message_sid,m.direction,m.read_at,m.notification_hidden_at,m.created_at
   from public.client_sms_messages m
   join public.clients c on c.id=m.client_id and c.agency_id=p_agency and c.assigned_agent_id=p_agent
   where m.twilio_message_sid is not null
     and (p_mode='summaries' or (m.direction='inbound' and m.read_at is null and m.notification_hidden_at is null)
          or m.twilio_message_sid=any(p_unread_sids))
     and right(regexp_replace(coalesce(m.from_number,''),'[^0-9]','','g'),10)<>'6627504626'
     and right(regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g'),10)<>'6627504626'
 ), states as (
   select m.client_id,jsonb_agg(jsonb_build_array(m.id,m.twilio_message_sid,m.direction,
      m.read_at is not null,m.notification_hidden_at is not null,m.created_at)) messages
   from eligible m group by m.client_id
 ), phones as (
   select distinct right(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),10) phone
   from states s join public.clients c on c.id=s.client_id
 )
 -- Include even clients without messages if their phone could make a match ambiguous.
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'first_name',c.first_name,'last_name',c.last_name,
      'phone',c.phone,'messages',s.messages)),'[]'::jsonb)
 from public.clients c join phones p on p.phone=right(regexp_replace(coalesce(c.phone,''),'[^0-9]','','g'),10)
 left join states s on s.client_id=c.id
 where c.agency_id=p_agency and c.assigned_agent_id=p_agent
$$;
revoke all on function public.platinum_sms_digest_input(uuid,uuid,text,text[]) from public,anon,authenticated;
grant execute on function public.platinum_sms_digest_input(uuid,uuid,text,text[]) to service_role;

create or replace function public.platinum_sms_preview(p_agency uuid,p_agent uuid,p_ids uuid[])
returns table(id uuid,body text) language sql stable security invoker set search_path = '' as $$
 select m.id,left(m.body,150) from public.client_sms_messages m
 join public.clients c on c.id=m.client_id and c.agency_id=p_agency and c.assigned_agent_id=p_agent
 where m.id=any(p_ids) and m.notification_hidden_at is null and m.twilio_message_sid is not null
$$;
revoke all on function public.platinum_sms_preview(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.platinum_sms_preview(uuid,uuid,uuid[]) to service_role;
