-- Phase C / 01: booking, payment, contract, review moderation and matching.
--
-- The B1 schema intentionally grants clients SELECT only on bookings, payments,
-- contracts and audit_logs. Everything that decides money, availability or
-- moderation state therefore has to go through a SECURITY DEFINER RPC. This
-- migration adds those RPCs plus the public read model and the matching
-- preferences the recommendation screen needs.
--
-- Error message conventions match the B2 soft-delete functions so the server
-- actions can map one stable set of codes: UNAUTHENTICATED, FORBIDDEN,
-- NOT_FOUND, CONFLICT, INVALID_STATE, BED_UNAVAILABLE, UNIT_NOT_APPROVED,
-- PROFILE_INCOMPLETE, INVALID_INPUT.

-- ---------------------------------------------------------------------------
-- Matching preferences
-- A student profile previously described only who the student is; matching also
-- needs what they are looking for. All four columns are optional so existing
-- profiles keep working and the matching RPC can weight missing data neutrally.
-- ---------------------------------------------------------------------------
alter table public.student_profiles
  add column budget_min_piastres integer
    check (budget_min_piastres is null or budget_min_piastres >= 0),
  add column budget_max_piastres integer
    check (budget_max_piastres is null or budget_max_piastres > 0),
  add column preferred_areas text[] not null default '{}'::text[]
    check (cardinality(preferred_areas) <= 10),
  add column preferred_amenities text[] not null default '{}'::text[]
    check (cardinality(preferred_amenities) <= 30),
  add constraint student_profiles_budget_range_valid check (
    budget_min_piastres is null
    or budget_max_piastres is null
    or budget_max_piastres >= budget_min_piastres
  );

grant insert (
  budget_min_piastres, budget_max_piastres,
  preferred_areas, preferred_amenities
) on table public.student_profiles to authenticated;

grant update (
  budget_min_piastres, budget_max_piastres,
  preferred_areas, preferred_amenities
) on table public.student_profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Public read model for listings
-- `units` stores no rating or availability, so the storefront needs one stable
-- shape. security_invoker keeps the caller's RLS in force: anon only sees
-- approved units and approved reviews, an owner also sees their pending units.
-- ---------------------------------------------------------------------------
create or replace view public.unit_listings
with (security_invoker = true)
as
select
  u.id,
  u.owner_id,
  u.title,
  u.area,
  u.gender_type,
  u.description,
  u.amenities,
  u.status,
  u.created_at,
  u.updated_at,
  coalesce(r.rating, 0)::numeric(3, 2) as rating,
  coalesce(r.review_count, 0) as review_count,
  coalesce(i.room_count, 0) as room_count,
  coalesce(i.available_beds, 0) as available_beds,
  coalesce(i.total_beds, 0) as total_beds,
  coalesce(i.min_price_piastres, 0) as min_price_piastres,
  coalesce(i.max_price_piastres, 0) as max_price_piastres
from public.units as u
left join lateral (
  select
    round(avg(rv.rating)::numeric, 2) as rating,
    count(rv.id)::integer as review_count
  from public.reviews as rv
  where rv.target_type = 'unit'
    and rv.target_id = u.id
    and rv.moderation_status = 'approved'
    and rv.deleted_at is null
) as r on true
left join lateral (
  select
    count(distinct rm.id)::integer as room_count,
    (count(bd.id) filter (
      where bd.status = 'available' and bd.deleted_at is null
    ))::integer as available_beds,
    (count(bd.id) filter (where bd.deleted_at is null))::integer as total_beds,
    min(bd.price_piastres) filter (
      where bd.deleted_at is null
    )::integer as min_price_piastres,
    max(bd.price_piastres) filter (
      where bd.deleted_at is null
    )::integer as max_price_piastres
  from public.rooms as rm
  left join public.beds as bd on bd.room_id = rm.id
  where rm.unit_id = u.id
    and rm.deleted_at is null
) as i on true;

revoke all on table public.unit_listings from anon, authenticated;
grant select on table public.unit_listings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create function public.create_booking(
  p_unit_id uuid,
  p_room_id uuid,
  p_bed_id uuid,
  p_move_in_date date,
  p_move_out_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
  v_unit public.units%rowtype;
  v_room public.rooms%rowtype;
  v_bed public.beds%rowtype;
  v_rent integer;
  v_booking_id uuid;
begin
  if v_student_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('student'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_move_in_date is null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if p_move_in_date < current_date then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.student_profiles as sp
    where sp.user_id = v_student_id
      and sp.deleted_at is null
  ) then
    raise exception 'PROFILE_INCOMPLETE' using errcode = '23514';
  end if;

  -- Lock the unit, room and bed so two students cannot reserve the last bed at
  -- the same time. The triggers and partial unique indexes stay as the second
  -- line of defence.
  select u.*
    into v_unit
  from public.units as u
  where u.id = p_unit_id
    and u.deleted_at is null
  for update of u;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_unit.status <> 'approved' then
    raise exception 'UNIT_NOT_APPROVED' using errcode = '23514';
  end if;

  select r.*
    into v_room
  from public.rooms as r
  where r.id = p_room_id
    and r.unit_id = p_unit_id
    and r.deleted_at is null
  for update of r;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_bed_id is not null then
    select b.*
      into v_bed
    from public.beds as b
    where b.id = p_bed_id
      and b.room_id = p_room_id
      and b.deleted_at is null
    for update of b;

    if not found then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;

    if v_bed.status <> 'available' then
      raise exception 'BED_UNAVAILABLE' using errcode = '23505';
    end if;

    v_rent := v_bed.price_piastres;
  else
    -- Whole-room booking: rent is the sum of the room's beds.
    if exists (
      select 1
      from public.bookings as b
      where b.room_id = p_room_id
        and b.deleted_at is null
        and b.status in ('pending_payment', 'confirmed')
    ) then
      raise exception 'CONFLICT' using errcode = '23505';
    end if;

    select coalesce(sum(b.price_piastres), 0)
      into v_rent
    from public.beds as b
    where b.room_id = p_room_id
      and b.deleted_at is null;

    if v_rent <= 0 then
      raise exception 'NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  -- commission_rate_snapshot / commission_amount_piastres are filled by the
  -- bookings_set_financials trigger from platform_settings.
  insert into public.bookings (
    student_id, unit_id, room_id, bed_id,
    move_in_date, move_out_date, rent_amount_piastres,
    commission_rate_snapshot, commission_amount_piastres
  )
  values (
    v_student_id, p_unit_id, p_room_id, p_bed_id,
    p_move_in_date, p_move_out_date, v_rent,
    0, 0
  )
  returning id into v_booking_id;

  insert into public.payments (booking_id, amount_piastres, method, status)
  select b.id, b.total_amount_piastres, 'card', 'pending'
  from public.bookings as b
  where b.id = v_booking_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_student_id,
    'booking.created',
    'booking',
    v_booking_id,
    jsonb_build_object(
      'unit_id', p_unit_id,
      'room_id', p_room_id,
      'bed_id', p_bed_id,
      'rent_piastres', v_rent
    )
  );

  return v_booking_id;
end;
$$;

revoke all on function public.create_booking(uuid, uuid, uuid, date, date)
from public, anon, authenticated;
grant execute on function public.create_booking(uuid, uuid, uuid, date, date)
to authenticated, service_role;

create function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_owner_id uuid;
begin
  if v_student_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select b.*
    into v_booking
  from public.bookings as b
  where b.id = p_booking_id
    and b.deleted_at is null
  for update of b;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select u.owner_id
    into v_owner_id
  from public.units as u
  where u.id = v_booking.unit_id;

  if not (
    v_booking.student_id = v_student_id
    or v_owner_id = v_student_id
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- Cancelling an already-cancelled or completed booking is a no-op, not an
  -- error, so retries from the UI are safe.
  if v_booking.status in ('cancelled', 'completed') then
    return;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancellation_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = p_booking_id;

  -- A pending attempt simply failed; a captured payment is refunded.
  update public.payments
  set status = 'failed',
      failure_reason = 'booking cancelled'
  where booking_id = p_booking_id
    and status = 'pending';

  update public.payments
  set status = 'refunded'
  where booking_id = p_booking_id
    and status = 'paid';

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_student_id,
    'booking.cancelled',
    'booking',
    p_booking_id,
    jsonb_build_object('reason', nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
  );
end;
$$;

revoke all on function public.cancel_booking(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Payments
-- Only a trusted caller (payment webhook or an admin reconciling a manual
-- transfer) may confirm or fail a payment. Students never call these.
-- ---------------------------------------------------------------------------
create function private.is_trusted_payment_caller()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.role()), '') = 'service_role'
    or (select private.has_role('admin'::public.app_role));
$$;

revoke all on function private.is_trusted_payment_caller()
from public, anon;
grant execute on function private.is_trusted_payment_caller()
to authenticated, service_role;

create function public.confirm_booking_payment(
  p_booking_id uuid,
  p_gateway_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_updated integer;
begin
  if not (select private.is_trusted_payment_caller()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_gateway_reference is null
     or char_length(btrim(p_gateway_reference)) not between 3 and 200 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select b.*
    into v_booking
  from public.bookings as b
  where b.id = p_booking_id
    and b.deleted_at is null
  for update of b;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotent: a replayed webhook after the booking was confirmed succeeds.
  if v_booking.status = 'confirmed' then
    return;
  end if;

  if v_booking.status <> 'pending_payment' then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  update public.payments
  set status = 'paid',
      gateway_reference = btrim(p_gateway_reference)
  where booking_id = p_booking_id
    and status = 'pending';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    -- No pending attempt left (for example the row was marked failed by a
    -- timeout but the gateway later captured it). Record the successful charge.
    insert into public.payments (
      booking_id, amount_piastres, method, status, gateway_reference, paid_at
    )
    values (
      v_booking.id,
      v_booking.total_amount_piastres,
      'card',
      'paid',
      btrim(p_gateway_reference),
      now()
    );
  end if;

  update public.bookings
  set status = 'confirmed'
  where id = p_booking_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.confirmed',
    'booking',
    p_booking_id,
    jsonb_build_object('gateway_reference', btrim(p_gateway_reference))
  );
end;
$$;

revoke all on function public.confirm_booking_payment(uuid, text)
from public, anon, authenticated;
grant execute on function public.confirm_booking_payment(uuid, text)
to authenticated, service_role;

create function public.fail_booking_payment(
  p_booking_id uuid,
  p_failure_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_reason text := nullif(left(btrim(coalesce(p_failure_reason, '')), 500), '');
begin
  if not (select private.is_trusted_payment_caller()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select b.*
    into v_booking
  from public.bookings as b
  where b.id = p_booking_id
    and b.deleted_at is null
  for update of b;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_booking.status = 'cancelled' then
    return;
  end if;

  if v_booking.status <> 'pending_payment' then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  update public.payments
  set status = 'failed',
      failure_reason = coalesce(v_reason, 'payment failed')
  where booking_id = p_booking_id
    and status = 'pending';

  -- Release the held bed immediately: an unpaid booking must not block it.
  update public.bookings
  set status = 'cancelled',
      cancellation_reason = coalesce(v_reason, 'payment failed')
  where id = p_booking_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.failed',
    'booking',
    p_booking_id,
    jsonb_build_object('reason', coalesce(v_reason, 'payment failed'))
  );
end;
$$;

revoke all on function public.fail_booking_payment(uuid, text)
from public, anon, authenticated;
grant execute on function public.fail_booking_payment(uuid, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------
create function public.request_contract(p_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_owner_id uuid;
  v_contract public.contracts%rowtype;
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select b.*
    into v_booking
  from public.bookings as b
  where b.id = p_booking_id
    and b.deleted_at is null;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  select u.owner_id
    into v_owner_id
  from public.units as u
  where u.id = v_booking.unit_id;

  if not (
    v_booking.student_id = v_actor
    or v_owner_id = v_actor
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'completed') then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  select c.*
    into v_contract
  from public.contracts as c
  where c.booking_id = p_booking_id
    and c.deleted_at is null
  for update of c;

  if not found then
    insert into public.contracts (booking_id, student_id, owner_id, status)
    values (p_booking_id, v_booking.student_id, v_owner_id, 'requested')
    returning * into v_contract;
  elsif v_contract.status = 'not_requested' then
    update public.contracts
    set status = 'requested'
    where id = v_contract.id
    returning * into v_contract;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'contract.requested',
    'contract',
    v_contract.id,
    jsonb_build_object('booking_id', p_booking_id)
  );

  return v_contract.id;
end;
$$;

revoke all on function public.request_contract(uuid)
from public, anon, authenticated;
grant execute on function public.request_contract(uuid)
to authenticated, service_role;

create function public.sign_contract(p_contract_id uuid, p_file_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_contract public.contracts%rowtype;
begin
  if not (
    coalesce((select auth.role()), '') = 'service_role'
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_file_path is null
     or char_length(p_file_path) not between 3 and 1024
     or position('..' in p_file_path) > 0 then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select c.*
    into v_contract
  from public.contracts as c
  where c.id = p_contract_id
    and c.deleted_at is null
  for update of c;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_contract.status = 'signed' then
    return;
  end if;

  if v_contract.status <> 'requested' then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  -- The table constraint already enforces this prefix; checking here produces a
  -- stable error code instead of a raw check violation.
  if v_contract.booking_id is null
     or p_file_path not like v_contract.booking_id::text || '/%' then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  update public.contracts
  set status = 'signed',
      file_path = p_file_path
  where id = p_contract_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'contract.signed',
    'contract',
    p_contract_id,
    jsonb_build_object('file_path', p_file_path)
  );
end;
$$;

revoke all on function public.sign_contract(uuid, text)
from public, anon, authenticated;
grant execute on function public.sign_contract(uuid, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Review moderation
-- Students insert reviews directly (the insert policy + trigger already guard
-- that path); only an admin may move a review out of `pending`.
-- ---------------------------------------------------------------------------
create function public.moderate_review(
  p_review_id uuid,
  p_status public.moderation_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_review public.reviews%rowtype;
begin
  if v_actor is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select r.*
    into v_review
  from public.reviews as r
  where r.id = p_review_id
    and r.deleted_at is null
  for update of r;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_review.moderation_status = p_status then
    return;
  end if;

  if v_review.moderation_status <> 'pending' then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  update public.reviews
  set moderation_status = p_status
  where id = p_review_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'review.moderated',
    'review',
    p_review_id,
    jsonb_build_object('status', p_status)
  );
end;
$$;

revoke all on function public.moderate_review(uuid, public.moderation_status)
from public, anon, authenticated;
grant execute on function public.moderate_review(uuid, public.moderation_status)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Matching
-- Hard filters: caller is a student with a profile, unit is approved and live,
-- gender matches, and at least one bed is available. Everything else is a
-- weighted score (budget, preferred area, preferred amenities, rating) so a
-- unit missing one preference still appears, just lower.
-- ---------------------------------------------------------------------------
create function public.match_units(p_limit integer default 20)
returns table (
  unit_id uuid,
  title text,
  area text,
  gender_type public.gender_type,
  description text,
  amenities text[],
  rating numeric,
  review_count integer,
  available_beds integer,
  min_price_piastres integer,
  score numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select
      sp.user_id,
      sp.gender,
      sp.budget_min_piastres,
      sp.budget_max_piastres,
      sp.preferred_areas,
      sp.preferred_amenities
    from public.student_profiles as sp
    where sp.user_id = (select auth.uid())
      and sp.deleted_at is null
  ),
  review_stats as (
    select
      u.id as unit_id,
      coalesce(round(avg(rv.rating)::numeric, 2), 0) as rating,
      count(rv.id)::integer as review_count
    from public.units as u
    left join public.reviews as rv
      on rv.target_type = 'unit'
     and rv.target_id = u.id
     and rv.moderation_status = 'approved'
     and rv.deleted_at is null
    where u.status = 'approved'
      and u.deleted_at is null
    group by u.id
  ),
  inventory as (
    select
      rm.unit_id,
      (count(bd.id) filter (
        where bd.status = 'available' and bd.deleted_at is null
      ))::integer as available_beds,
      min(bd.price_piastres) filter (
        where bd.deleted_at is null
      )::integer as min_price_piastres
    from public.rooms as rm
    join public.beds as bd on bd.room_id = rm.id
    where rm.deleted_at is null
    group by rm.unit_id
  )
  select
    u.id,
    u.title,
    u.area,
    u.gender_type,
    u.description,
    u.amenities,
    rs.rating,
    rs.review_count,
    coalesce(inv.available_beds, 0),
    coalesce(inv.min_price_piastres, 0),
    round(
      (case
        when me.budget_max_piastres is null then 0.5
        when coalesce(inv.min_price_piastres, 0)
          between coalesce(me.budget_min_piastres, 0) and me.budget_max_piastres then 1
        else 0
      end) * 0.35
      + (case
        when cardinality(me.preferred_areas) = 0 then 0.5
        when u.area = any(me.preferred_areas) then 1
        else 0
      end) * 0.25
      + (case
        when cardinality(me.preferred_amenities) = 0 then 0.5
        else (
          select count(*)::numeric
          from unnest(u.amenities) as listed(amenity)
          where listed.amenity = any(me.preferred_amenities)
        ) / cardinality(me.preferred_amenities)
      end) * 0.20
      + (rs.rating / 5.0) * 0.20
    , 4) as score
  from public.units as u
  join me on true
  join review_stats as rs on rs.unit_id = u.id
  left join inventory as inv on inv.unit_id = u.id
  where u.status = 'approved'
    and u.deleted_at is null
    and u.gender_type = me.gender
    and coalesce(inv.available_beds, 0) > 0
  order by score desc, rs.rating desc, u.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
$$;

revoke all on function public.match_units(integer)
from public, anon, authenticated;
grant execute on function public.match_units(integer)
to authenticated, service_role;
