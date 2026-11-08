-- Phase B2 / 06: review decisions applied to the soft-delete RPCs.
-- The earlier migrations have not been applied anywhere yet, but they are still
-- treated as history: this file redefines the functions instead of editing them.
--
-- Changes:
--   * unauthorised deletes and restores return NOT_FOUND, so the error cannot
--     be used to confirm that a row exists;
--   * a unit with a future scheduled inspection cannot be soft-deleted
--     (HAS_UPCOMING_VISITS), and those visits are never cascaded;
--   * a restore that would violate a partial unique index returns
--     RESTORE_CONFLICT instead of a raw unique_violation.

-- ---------------------------------------------------------------------------
-- Units
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_unit(p_unit_id uuid)
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

  -- Also "exists but is not yours" returns NOT_FOUND: a FORBIDDEN code would
  -- confirm the unit exists to a caller who is not allowed to see it.
  if not (
    v_owner_id = (select auth.uid())
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

  -- A future scheduled visit is an active obligation. Block the deletion and
  -- leave the visit in place instead of silently cascading it away.
  if exists (
    select 1
    from public.unit_visits as v
    where v.unit_id = p_unit_id
      and v.deleted_at is null
      and v.status = 'scheduled'
      and v.scheduled_at > now()
  ) then
    raise exception 'HAS_UPCOMING_VISITS' using errcode = 'P0001';
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

create or replace function public.restore_unit(p_unit_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select u.deleted_at
    into v_deleted_at
  from public.units as u
  where u.id = p_unit_id
  for update of u;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_deleted_at is null then
    return;
  end if;

  begin
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
  exception
    when unique_violation then
      raise exception 'RESTORE_CONFLICT' using errcode = '23505';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_room(p_room_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

create or replace function public.restore_room(p_room_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

  begin
    update public.beds
    set deleted_at = null
    where room_id = p_room_id
      and deleted_at = v_deleted_at;

    update public.rooms
    set deleted_at = null
    where id = p_room_id
      and deleted_at = v_deleted_at;
  exception
    when unique_violation then
      raise exception 'RESTORE_CONFLICT' using errcode = '23505';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Beds
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_bed(p_bed_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

create or replace function public.restore_bed(p_bed_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.beds as b where b.id = p_bed_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  begin
    update public.beds
    set deleted_at = null
    where id = p_bed_id
      and deleted_at is not null;
  exception
    when unique_violation then
      raise exception 'RESTORE_CONFLICT' using errcode = '23505';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Unit visits
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_unit_visit(p_visit_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

create or replace function public.restore_unit_visit(p_visit_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
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

  begin
    update public.unit_evaluations
    set deleted_at = null
    where visit_id = p_visit_id
      and deleted_at = v_deleted_at;

    update public.unit_visits
    set deleted_at = null
    where id = p_visit_id
      and deleted_at = v_deleted_at;
  exception
    when unique_violation then
      raise exception 'RESTORE_CONFLICT' using errcode = '23505';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_review(p_review_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.reviews
  set deleted_at = now()
  where id = p_review_id
    and deleted_at is null;
end;
$$;

create or replace function public.restore_review(p_review_id uuid)
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
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.reviews as r where r.id = p_review_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  begin
    update public.reviews
    set deleted_at = null
    where id = p_review_id
      and deleted_at is not null;
  exception
    when unique_violation then
      raise exception 'RESTORE_CONFLICT' using errcode = '23505';
  end;
end;
$$;
