create schema if not exists arctos_sms_archive;
revoke all on schema arctos_sms_archive from public, anon, authenticated, service_role;
create table arctos_sms_archive.prior_messages(source_table text not null, message_id uuid not null, original_row jsonb not null, primary key(source_table,message_id));
revoke all on arctos_sms_archive.prior_messages from public, anon, authenticated, service_role;
create function arctos_sms_archive.skip_reserved_sms() returns trigger language plpgsql set search_path='' as $$
begin
 if right(regexp_replace(coalesce(new.from_number,''),'[^0-9]','','g'),10)='6627504626'
 or right(regexp_replace(coalesce(new.to_number,''),'[^0-9]','','g'),10)='6627504626' then return null; end if;
 return new;
end $$;
create trigger skip_arctos_reserved_sms before insert or update on public.client_sms_messages for each row execute function arctos_sms_archive.skip_reserved_sms();
with moved as (delete from public.client_sms_messages where not (right(regexp_replace(coalesce(from_number,''),'[^0-9]','','g'),10) <> '6627504626' and right(regexp_replace(coalesce(to_number,''),'[^0-9]','','g'),10) <> '6627504626') returning *)
insert into arctos_sms_archive.prior_messages select 'client_sms_messages',id,to_jsonb(moved) from moved;
create trigger skip_arctos_reserved_sms before insert or update on public.office_sms_messages for each row execute function arctos_sms_archive.skip_reserved_sms();
with moved as (delete from public.office_sms_messages where not (right(regexp_replace(coalesce(from_number,''),'[^0-9]','','g'),10) <> '6627504626' and right(regexp_replace(coalesce(to_number,''),'[^0-9]','','g'),10) <> '6627504626') returning *)
insert into arctos_sms_archive.prior_messages select 'office_sms_messages',id,to_jsonb(moved) from moved;
