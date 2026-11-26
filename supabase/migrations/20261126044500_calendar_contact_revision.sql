-- Shared client links depend on the current agency, agent and phone match.
create trigger justin_client_calendar_insert after insert on public.clients
for each row when (new.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
execute function private.advance_justin_calendar_clock();
create trigger justin_client_calendar_delete after delete on public.clients
for each row when (old.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
execute function private.advance_justin_calendar_clock();
create trigger justin_client_calendar_update after update of id, agency_id, assigned_agent_id, phone on public.clients
for each row when (
  (old.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid
    or new.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
  and (old.id, old.agency_id, old.assigned_agent_id, old.phone)
       is distinct from (new.id, new.agency_id, new.assigned_agent_id, new.phone)
)
execute function private.advance_justin_calendar_clock();
create trigger justin_client_calendar_truncate after truncate on public.clients
for each statement execute function private.advance_justin_calendar_clock();
