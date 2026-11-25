create table if not exists public.crm_text_attachments (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('arctos','platinum','office-arctos','office-platinum')),
  owner_id uuid not null,
  object_path text not null unique,
  filename text not null,
  mime text not null,
  share_token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  published boolean not null default false
);
alter table public.crm_text_attachments enable row level security;
revoke all on public.crm_text_attachments from public, anon, authenticated;
grant select, insert, update, delete on public.crm_text_attachments to service_role;
insert into storage.buckets(id,name,public,file_size_limit)
values ('crm-text-files','crm-text-files',false,4194304) on conflict(id) do nothing;
alter table public.client_sms_messages add column if not exists text_attachment jsonb;
alter table public.office_sms_messages add column if not exists text_attachment jsonb;
