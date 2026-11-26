-- Only Justin's shared calendar is visible through the Arctos bridge.
create schema if not exists private;
create table private.justin_calendar_clock (
  singleton boolean primary key check (singleton),
  revision bigint not null
);
alter table private.justin_calendar_clock enable row level security;
revoke all on private.justin_calendar_clock from public, anon, authenticated;
insert into private.justin_calendar_clock values (true, 0);

create function private.advance_justin_calendar_clock()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update private.justin_calendar_clock set revision = revision + 1 where singleton;
  return null;
end;
$$;
revoke all on function private.advance_justin_calendar_clock() from public, anon, authenticated;

create trigger justin_calendar_insert after insert on public.workspace_calendar_events
for each row when (new.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
execute function private.advance_justin_calendar_clock();
create trigger justin_calendar_update after update on public.workspace_calendar_events
for each row when (old.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid
                or new.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
execute function private.advance_justin_calendar_clock();
create trigger justin_calendar_delete after delete on public.workspace_calendar_events
for each row when (old.assigned_agent_id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid)
execute function private.advance_justin_calendar_clock();
create trigger justin_calendar_truncate after truncate on public.workspace_calendar_events
for each statement execute function private.advance_justin_calendar_clock();

create function public.justin_calendar_revision()
returns text language sql stable security definer set search_path = '' as $$
  select p.agency_id::text || ':' || c.revision::text
  from private.justin_calendar_clock c join public.profiles p
    on p.id = '9c9b6c8a-add4-475d-bda5-c27169f117a1'::uuid
  where c.singleton and p.active and p.agency_id is not null
$$;
revoke all on function public.justin_calendar_revision() from public, anon, authenticated;
grant execute on function public.justin_calendar_revision() to service_role;
