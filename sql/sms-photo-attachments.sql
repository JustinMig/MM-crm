-- Private photos are uploaded by the server and shared through expiring signed URLs.
alter table public.client_sms_messages add column if not exists media_paths jsonb not null default '[]'::jsonb;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sms-photos','sms-photos',false,4194304,array['image/jpeg','image/png','image/gif']) on conflict(id) do nothing;
