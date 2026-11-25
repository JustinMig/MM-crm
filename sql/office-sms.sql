-- Office texting reuses M&M's Twilio connection without creating copies of agency clients.
create table if not exists public.office_sms_threads (
 id uuid primary key default gen_random_uuid(),
 agency_id uuid not null references public.agencies(id) on delete cascade,
 scope text not null check(scope in ('arctos','platinum')),
 remote_client_id uuid not null, remote_agent_id uuid not null,
 phone text not null, client_name text not null, agent_name text not null,
 legacy_client_id uuid references public.clients(id) on delete set null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(agency_id,scope,remote_client_id)
);
create table if not exists public.office_sms_messages (
 id uuid primary key,thread_id uuid not null references public.office_sms_threads(id) on delete cascade,
 user_id uuid references public.profiles(id) on delete set null,
 direction text not null check(direction in ('inbound','outbound')),
 body text not null,from_number text,to_number text,twilio_message_sid text unique,
 status text not null,error_code text,error_message text,read_at timestamptz,notification_hidden_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists office_sms_thread_phone on public.office_sms_threads(phone);
create index if not exists office_sms_thread_agent on public.office_sms_threads(agency_id,scope,remote_agent_id);
create index if not exists office_sms_messages_thread on public.office_sms_messages(thread_id,created_at desc);
create index if not exists office_sms_messages_to on public.office_sms_messages(to_number,created_at desc) where direction='outbound';
alter table public.office_sms_threads enable row level security;
alter table public.office_sms_messages enable row level security;
revoke all on public.office_sms_threads,public.office_sms_messages from public,anon,authenticated;
grant all on public.office_sms_threads,public.office_sms_messages to service_role;
create or replace function public.office_sms_summaries(p_agency_id uuid,p_scope text,p_agent_id uuid)
returns table(thread_id uuid,remote_client_id uuid,phone text,legacy_client_id uuid,unread_count bigint,latest_body text,latest_at timestamptz)
language sql stable security invoker set search_path='' as $$
 select t.id,t.remote_client_id,t.phone,t.legacy_client_id,
 (select count(*) from public.office_sms_messages m where m.thread_id=t.id and m.direction='inbound' and m.read_at is null and m.notification_hidden_at is null),
 last_message.body,last_message.created_at
 from public.office_sms_threads t
 join lateral(select m.body,m.created_at from public.office_sms_messages m where m.thread_id=t.id and m.notification_hidden_at is null order by m.created_at desc,m.id desc limit 1) last_message on true
 where t.agency_id=p_agency_id and t.scope=p_scope and t.remote_agent_id=p_agent_id
 order by last_message.created_at desc
$$;
revoke all on function public.office_sms_summaries(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.office_sms_summaries(uuid,text,uuid) to service_role;
