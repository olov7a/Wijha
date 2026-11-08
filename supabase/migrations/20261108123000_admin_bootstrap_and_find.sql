-- Phase C / 04: first-admin bootstrap and admin user lookup.
--
-- 1. `claim_first_admin` lets the very first registered user become admin
--    without touching SQL. It only succeeds when ZERO admin rows exist, so
--    a stranger can never steal the role once the platform has an admin.
-- 2. `admin_find_users` lets an admin search accounts by email or name and
--    see their current role, so promoting a tester never needs a raw UUID.

create function public.claim_first_admin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where role = 'admin'::public.app_role) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.profiles
  set role = 'admin'::public.app_role
  where id = v_actor;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'profile.role_claimed_first_admin',
    'profile',
    v_actor,
    jsonb_build_object('to', 'admin')
  );
end;
$$;

revoke all on function public.claim_first_admin()
from public, anon, authenticated;
grant execute on function public.claim_first_admin()
to authenticated, service_role;

create function public.admin_find_users(p_query text)
returns table (
  id uuid,
  email text,
  full_name text,
  role public.app_role,
  created_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    au.email,
    p.full_name,
    p.role,
    p.created_at
  from public.profiles as p
  left join auth.users as au on au.id = p.id
  where (select private.has_role('admin'::public.app_role))
    and (
      p_query is null
      or btrim(p_query) = ''
      or au.email ilike '%' || btrim(p_query) || '%'
      or p.full_name ilike '%' || btrim(p_query) || '%'
    )
  order by p.created_at desc
  limit 10;
$$;

revoke all on function public.admin_find_users(text)
from public, anon, authenticated;
grant execute on function public.admin_find_users(text)
to authenticated, service_role;
