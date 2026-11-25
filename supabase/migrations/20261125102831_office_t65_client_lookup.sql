-- Read-only T65 lookup; Office bridges authorize the agency before calling it.
create or replace function public.office_client_t65(p_on date default ((now() at time zone 'America/Chicago')::date))
returns table(id uuid,first_name text,last_name text,phone text,date_of_birth date,city text,state text,status text,assigned_agent_id uuid,products text[],birthday_65 date)
language sql stable security invoker set search_path='' as $$
 select c.id,c.first_name,c.last_name,c.phone,c.date_of_birth,c.city,c.state,c.status,c.assigned_agent_id,c.products,b.birthday
 from public.clients c
 cross join lateral (select (c.date_of_birth+interval '65 years')::date birthday) b
 where c.date_of_birth is not null and c.status is distinct from 'deceased'
   and p_on >= (b.birthday-interval '3 months')::date
   and p_on < (b.birthday+interval '4 months')::date
 order by b.birthday,lower(c.last_name),lower(c.first_name),c.id
$$;
revoke all on function public.office_client_t65(date) from public,anon,authenticated;
grant execute on function public.office_client_t65(date) to service_role;
notify pgrst,'reload schema';
