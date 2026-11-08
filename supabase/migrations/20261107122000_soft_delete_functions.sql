-- Phase B2 / 03: soft-delete and restore functions.
-- All functions are SECURITY DEFINER because the caller has no table-level
-- UPDATE grant on deleted_at. Authorization is therefore repeated inside every
-- function before any row is touched.
--
-- Exposed deletions: units, rooms, beds, unit_visits, reviews.
-- Bookings, payments and contracts only receive the column; their lifecycle is
-- controlled by server-side payment/retention jobs.
-- Restores are admin-only and cascade to structurally-owned children.

-- ---------------------------------------------------------------------------
-- Units
-- ---------------------------------------------------------------------------
create function public.soft_delete_unit(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_deleted_at timestamp with time zone;
  -- One shared timestamp so a later restore can tell which children this
  -- cascade deleted, instead of resurrecting rows deleted earlier by hand.
  v_stamp timestamp with time zone := clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select u.owner_id, u.deleted_at
    into v_owner_id, v_deleted_at
  from public.units as u
  where u.id = p_unit_id
  for update of u;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return;
  end if;

  if not (
    v_owner_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- A unit with live bookings must not disappear under the student or owner.
  if exists (
    select 1
    from public.bookings as b
    where b.unit_id = p_unit_id
      and b.deleted_at is null
      and b.status in ('pending_payment', 'confirmed')
  ) then
    raise exception 'ACTIVE_BOOKINGS' using errcode = '23503';
  end if;

  update public.unit_evaluations
  set deleted_at = v_stamp
  where unit_id = p_unit_id
    and deleted_at is null;

  update public.unit_visits
  set deleted_at = v_stamp
  where unit_id = p_unit_id
    and deleted_at is null;

  update public.beds
  set deleted_at = v_stamp
  where room_id in (
    select r.id
    from public.rooms as r
    where r.unit_id = p_unit_id
  )
    and deleted_at is null;

  update public.rooms
  set deleted_at = v_stamp
  where unit_id = p_unit_id
    and deleted_at is null;

  update public.units
  set deleted_at = v_stamp
  where id = p_unit_id;
end;
$$;

revoke all on function public.soft_delete_unit(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_unit(uuid) to authenticated, service_role;

create function public.restore_unit(p_unit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamp with time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select u.deleted_at
    into v_deleted_at
  from public.units as u
  where u.id = p_unit_id
  for update of u;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Only a cascaded unit deletion re-opens its children. If the unit is active,
  -- restoring a deleted room or bed is an explicit per-child admin action.
  if v_deleted_at is null then
    return;
  end if;

  -- Children are restored only when they share the unit's deletion timestamp,
  -- so a room deleted separately before the unit stays deleted.
  update public.unit_evaluations
  set deleted_at = null
  where unit_id = p_unit_id
    and deleted_at = v_deleted_at;

  update public.unit_visits
  set deleted_at = null
  where unit_id = p_unit_id
    and deleted_at = v_deleted_at;

  update public.beds
  set deleted_at = null
  where room_id in (
    select r.id
    from public.rooms as r
    where r.unit_id = p_unit_id
  )
    and deleted_at = v_deleted_at;

  update public.rooms
  set deleted_at = null
  where unit_id = p_unit_id
    and deleted_at = v_deleted_at;

  update public.units
  set deleted_at = null
  where id = p_unit_id
    and deleted_at = v_deleted_at;
end;
$$;

revoke all on function public.restore_unit(uuid) from public, anon, authenticated;
grant execute on function public.restore_unit(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create function public.soft_delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_deleted_at timestamp with time zone;
  v_stamp timestamp with time zone := clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select u.owner_id, r.deleted_at
    into v_owner_id, v_deleted_at
  from public.rooms as r
  join public.units as u on u.id = r.unit_id
  where r.id = p_room_id
    and u.deleted_at is null
  for update of r;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return;
  end if;

  if not (
    v_owner_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.bookings as b
    where b.room_id = p_room_id
      and b.deleted_at is null
      and b.status in ('pending_payment', 'confirmed')
  ) then
    raise exception 'ACTIVE_BOOKINGS' using errcode = '23503';
  end if;

  update public.beds
  set deleted_at = v_stamp
  where room_id = p_room_id
    and deleted_at is null;

  update public.rooms
  set deleted_at = v_stamp
  where id = p_room_id
    and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_room(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_room(uuid) to authenticated, service_role;

create function public.restore_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamp with time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select r.deleted_at
    into v_deleted_at
  from public.rooms as r
  where r.id = p_room_id
  for update of r;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is null then
    return;
  end if;

  update public.beds
  set deleted_at = null
  where room_id = p_room_id
    and deleted_at = v_deleted_at;

  update public.rooms
  set deleted_at = null
  where id = p_room_id
    and deleted_at = v_deleted_at;
end;
$$;

revoke all on function public.restore_room(uuid) from public, anon, authenticated;
grant execute on function public.restore_room(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Beds
-- ---------------------------------------------------------------------------
create function public.soft_delete_bed(p_bed_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_deleted_at timestamp with time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select u.owner_id, b.deleted_at
    into v_owner_id, v_deleted_at
  from public.beds as b
  join public.rooms as r on r.id = b.room_id
  join public.units as u on u.id = r.unit_id
  where b.id = p_bed_id
    and r.deleted_at is null
    and u.deleted_at is null
  for update of b;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return;
  end if;

  if not (
    v_owner_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.bookings as b
    where b.bed_id = p_bed_id
      and b.deleted_at is null
      and b.status in ('pending_payment', 'confirmed')
  ) then
    raise exception 'ACTIVE_BOOKINGS' using errcode = '23503';
  end if;

  update public.beds
  set deleted_at = now()
  where id = p_bed_id
    and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_bed(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_bed(uuid) to authenticated, service_role;

create function public.restore_bed(p_bed_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (select 1 from public.beds as b where b.id = p_bed_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.beds
  set deleted_at = null
  where id = p_bed_id
    and deleted_at is not null;
end;
$$;

revoke all on function public.restore_bed(uuid) from public, anon, authenticated;
grant execute on function public.restore_bed(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Unit visits
-- ---------------------------------------------------------------------------
create function public.soft_delete_unit_visit(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamp with time zone;
  v_stamp timestamp with time zone := clock_timestamp();
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select v.deleted_at
    into v_deleted_at
  from public.unit_visits as v
  where v.id = p_visit_id
  for update of v;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return;
  end if;

  if not (select private.is_leader_or_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.unit_evaluations
  set deleted_at = v_stamp
  where visit_id = p_visit_id
    and deleted_at is null;

  update public.unit_visits
  set deleted_at = v_stamp
  where id = p_visit_id
    and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_unit_visit(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_unit_visit(uuid) to authenticated, service_role;

create function public.restore_unit_visit(p_visit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamp with time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select v.deleted_at
    into v_deleted_at
  from public.unit_visits as v
  where v.id = p_visit_id
  for update of v;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is null then
    return;
  end if;

  update public.unit_evaluations
  set deleted_at = null
  where visit_id = p_visit_id
    and deleted_at = v_deleted_at;

  update public.unit_visits
  set deleted_at = null
  where id = p_visit_id
    and deleted_at = v_deleted_at;
end;
$$;

revoke all on function public.restore_unit_visit(uuid) from public, anon, authenticated;
grant execute on function public.restore_unit_visit(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create function public.soft_delete_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer_id uuid;
  v_deleted_at timestamp with time zone;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select r.reviewer_id, r.deleted_at
    into v_reviewer_id, v_deleted_at
  from public.reviews as r
  where r.id = p_review_id
  for update of r;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is not null then
    return;
  end if;

  if not (
    v_reviewer_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.reviews
  set deleted_at = now()
  where id = p_review_id
    and deleted_at is null;
end;
$$;

revoke all on function public.soft_delete_review(uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_review(uuid) to authenticated, service_role;

create function public.restore_review(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not exists (select 1 from public.reviews as r where r.id = p_review_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.reviews
  set deleted_at = null
  where id = p_review_id
    and deleted_at is not null;
end;
$$;

revoke all on function public.restore_review(uuid) from public, anon, authenticated;
grant execute on function public.restore_review(uuid) to authenticated, service_role;
