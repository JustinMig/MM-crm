-- Central M&M project. The Office operator's JWT supplies the actor identity.
create or replace function public.office_change_arctos_shared_event(
 p_id uuid,p_operation text,p_date date,p_status text,p_changes jsonb
) returns void language plpgsql security definer set search_path='' as $$
declare
 current_event public.workspace_calendar_events%rowtype;
 next_event public.workspace_calendar_events%rowtype;
begin
 if not exists(select 1 from public.office_crm_access
               where user_id=(select auth.uid()) and active and arctos_access and can_edit) then
  raise exception 'Editing is not authorized' using errcode='42501';
 end if;
 if p_operation is null or p_operation not in ('complete','update','delete') or
    jsonb_typeof(p_changes) is distinct from 'object' or
    (p_changes - array['title','event_date','start_time','end_time','notes']) <> '{}'::jsonb then
  raise exception 'Invalid operation' using errcode='22023';
 end if;
 select e.* into current_event from public.workspace_calendar_events e
 join public.profiles owner on e.assigned_agent_id=owner.id and e.agency_id=owner.agency_id and owner.active
 where owner.id='9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid and e.id=p_id
 for update of e;
 if not found or current_event.event_date is distinct from p_date or current_event.status is distinct from p_status then
  raise exception 'Appointment changed or not found' using errcode='P0002';
 end if;
 if p_operation='delete' then
  delete from public.workspace_calendar_events where id=p_id;
 elsif p_operation='complete' then
  update public.workspace_calendar_events set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=p_id;
 else
  select * into next_event from jsonb_populate_record(current_event,p_changes);
  if p_changes='{}'::jsonb or next_event.title is null or length(trim(next_event.title)) not between 1 and 250 or
    length(next_event.notes)>5000 or next_event.event_date is null then
   raise exception 'Invalid appointment' using errcode='22023';
  end if;
  if current_event.status='needs_reschedule' and (current_event.event_date,current_event.start_time)
    is distinct from (next_event.event_date,next_event.start_time) then
   next_event.status:='scheduled';
   next_event.reschedule_note:=null;
   next_event.reschedule_requested_at:=null;
  end if;
  if (current_event.event_date,current_event.start_time,current_event.end_time) is distinct from
     (next_event.event_date,next_event.start_time,next_event.end_time) then
   if next_event.end_time is not null and (next_event.start_time is null or next_event.end_time<=next_event.start_time) then
    raise exception 'End time must follow start time' using errcode='22023';
   end if;
   if next_event.status='scheduled' and next_event.start_time is not null then
    perform pg_advisory_xact_lock(hashtextextended(next_event.assigned_agent_id::text||':'||next_event.event_date::text,0));
    if exists(select 1 from public.workspace_calendar_events e where e.id<>p_id
      and e.assigned_agent_id=next_event.assigned_agent_id and e.agency_id=next_event.agency_id
      and e.status='scheduled' and e.event_type='appointment' and e.event_date=next_event.event_date and e.start_time is not null
      and e.event_date+e.start_time < next_event.event_date+coalesce(next_event.end_time,next_event.start_time)+case when next_event.end_time is null then interval '15 min' else interval '0' end
      and next_event.event_date+next_event.start_time < case when e.end_time>e.start_time then e.event_date+e.end_time else e.event_date+e.start_time+interval '15 min' end) then
     raise exception 'Time already booked' using errcode='23P01';
    end if;
   end if;
  end if;
  update public.workspace_calendar_events set title=next_event.title,notes=next_event.notes,
    event_date=next_event.event_date,start_time=next_event.start_time,end_time=next_event.end_time,status=next_event.status,
    reschedule_note=next_event.reschedule_note,reschedule_requested_at=next_event.reschedule_requested_at,updated_at=now()
    where id=p_id;
 end if;
 insert into public.office_schedule_audit(actor_id,operation,entity_id) values(auth.uid(),p_operation||'_appointment',p_id);
end;
$$;
revoke all on function public.office_change_arctos_shared_event(uuid,text,date,text,jsonb) from public,anon,authenticated;
grant execute on function public.office_change_arctos_shared_event(uuid,text,date,text,jsonb) to authenticated;
