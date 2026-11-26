-- Provider SIDs identify suppressed duplicates even after a client's name or phone changes.
create or replace function public.platinum_sms_suppressed_sids(p_agency uuid,p_agent uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(m.twilio_message_sid),'[]'::jsonb)
 from public.client_sms_messages m join public.clients c on c.id=m.client_id
 where c.agency_id=p_agency and c.assigned_agent_id=p_agent and m.twilio_message_sid is not null
 and (m.notification_hidden_at is not null
    or right(regexp_replace(coalesce(m.from_number,''),'[^0-9]','','g'),10)='6627504626'
    or right(regexp_replace(coalesce(m.to_number,''),'[^0-9]','','g'),10)='6627504626')
$$;
revoke all on function public.platinum_sms_suppressed_sids(uuid,uuid) from public,anon,authenticated;
grant execute on function public.platinum_sms_suppressed_sids(uuid,uuid) to service_role;
