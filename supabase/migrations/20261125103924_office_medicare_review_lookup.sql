-- Office agency bridges authorize each caller before using this read-only RPC.
create or replace function public.office_client_medicare_reviews(p_year integer)
returns table(id uuid,first_name text,last_name text,phone text,date_of_birth date,city text,state text,status text,assigned_agent_id uuid,products text[],medicare_review_year integer,medicare_review_completed boolean)
language sql stable security invoker set search_path='' as $$
 select c.id,c.first_name,c.last_name,c.phone,c.date_of_birth,c.city,c.state,c.status,c.assigned_agent_id,c.products,r.review_year,true
 from public.clients c join public.client_review_manual r on r.client_id=c.id
 where r.review_year=p_year and r.completed is true and c.status is distinct from 'deceased'
 order by lower(c.last_name),lower(c.first_name),c.id
$$;
revoke all on function public.office_client_medicare_reviews(integer) from public,anon,authenticated;
grant execute on function public.office_client_medicare_reviews(integer) to service_role;
notify pgrst,'reload schema';
