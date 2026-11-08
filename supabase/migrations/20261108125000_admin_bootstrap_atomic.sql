-- Phase C / 06: atomic first-admin claim + last-admin guard.
--
-- Fixes:
-- 1. Atomicity: the old server action counted admins and updated the role in
--    two separate statements, so two simultaneous claims could both see zero
--    admins. `claim_first_admin(p_actor)` now does check + promotion in one
--    function with an advisory lock.
-- 2. Last admin: `admin_set_user_role` previously allowed demoting the only
--    admin. It now raises FORBIDDEN when the target is the sole admin.
-- Only service_role may execute `claim_first_admin` (server action calls it
-- with the service-role client after verifying the bootstrap secret).

drop function if exists public.claim_first_admin();

create function public.claim_first_admin(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  -- Serialize concurrent claims so both callers cannot see "zero admins".
  perform pg_advisory_xact_lock(727272727);

  select count(*)
    into v_count
  from public.profiles
  where role = 'admin'::public.app_role;

  if v_count > 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_actor) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.profiles
  set role = 'admin'::public.app_role
  where id = p_actor;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    p_actor,
    'profile.role_claimed_first_admin',
    'profile',
    p_actor,
    jsonb_build_object('to', 'admin')
  );
end;
$$;

grant execute on function public.claim_first_admin(uuid)
to service_role;

revoke all on function public.claim_first_admin(uuid)
from public, anon, authenticated;

-- Refuse to demote the sole remaining admin.
create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_previous public.app_role;
  v_admin_count integer;
begin
  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select p.role
    into v_previous
  from public.profiles as p
  where p.id = p_user_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_role not in (
    'student'::public.app_role,
    'owner'::public.app_role,
    'team'::public.app_role,
    'leader'::public.app_role,
    'admin'::public.app_role
  ) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if v_previous = 'admin'::public.app_role
     and p_role <> 'admin'::public.app_role then
    select count(*)
      into v_admin_count
    from public.profiles
    where role = 'admin'::public.app_role;

    if v_admin_count <= 1 then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if p_role = 'owner'::public.app_role then
    insert into public.owner_profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'profile.role_changed',
    'profile',
    p_user_id,
    jsonb_build_object('from', v_previous, 'to', p_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role)
from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role)
to authenticated, service_role;
