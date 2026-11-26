-- Run on the central M&M project, which verifies Office sign-ins and owns Justin's shared events.
create or replace function public.office_arctos_calendar_events(p_from date, p_to date)
returns table (
  id uuid, assigned_agent_id uuid, client_id uuid, title text, event_type text,
  event_date date, start_time time, end_time time, status text, notes text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.office_crm_access a
    where a.user_id = (select auth.uid()) and a.active and a.arctos_access
  ) then
    raise exception 'Arctos calendar access denied' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Invalid calendar range' using errcode = '22023';
  end if;
  return query
    select e.id, '9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9'::uuid, null::uuid,
           e.title, e.event_type, e.event_date, e.start_time, e.end_time, e.status, e.notes
    from public.workspace_calendar_events e
    join public.profiles owner on owner.id = e.assigned_agent_id and owner.agency_id = e.agency_id
    where owner.id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid and owner.active
      and e.event_date between p_from and p_to
    order by e.event_date, e.start_time nulls first, e.id;
end;
$$;
revoke all on function public.office_arctos_calendar_events(date,date) from public, anon, authenticated;
grant execute on function public.office_arctos_calendar_events(date,date) to authenticated;
