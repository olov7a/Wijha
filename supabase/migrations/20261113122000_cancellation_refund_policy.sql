-- Cancellation/refund policy, step 2/2: enforce the written policy in the DB.
--
-- Policy (CLAUDE.md):
--   * refund only when the booking is cancelled at least 24 hours before
--     check-in (the window is configurable in platform_settings);
--   * gateway fees are deducted from the refund;
--   * after the deadline there is no refund.
--
-- Because payments are manual in the MVP, `cancel_booking` never pretends the
-- money moved: an eligible payment becomes `refund_pending` with the exact
-- amount owed. An admin executes the transfer and calls `confirm_booking_refund`
-- (or rejects it with `decline_booking_refund`). `refund_booking_payment` stays
-- as an explicit manual override for disputes.

alter table public.platform_settings
  add column if not exists gateway_fee_rate numeric(5, 4) not null default 0.0150
    check (gateway_fee_rate between 0 and 1),
  add column if not exists cancellation_window_hours integer not null default 24
    check (cancellation_window_hours between 0 and 720);

alter table public.payments
  add column if not exists refund_amount_piastres integer
    check (refund_amount_piastres is null or refund_amount_piastres >= 0),
  add column if not exists refund_fee_piastres integer not null default 0
    check (refund_fee_piastres >= 0),
  add column if not exists refund_requested_at timestamp with time zone,
  add column if not exists refunded_at timestamp with time zone,
  add column if not exists refund_reason text
    check (refund_reason is null or char_length(refund_reason) <= 500);

-- Extend the payment state machine with the refund workflow.
create or replace function private.protect_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.booking_id is distinct from old.booking_id
     or new.amount_piastres is distinct from old.amount_piastres
     or new.currency is distinct from old.currency
     or new.method is distinct from old.method
  then
    raise exception 'payment financial fields are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('paid', 'failed', 'expired'))
      or (old.status = 'paid' and new.status in ('refund_pending', 'refunded'))
      or (old.status = 'refund_pending' and new.status in ('refunded', 'paid'))
      or (old.status = 'failed' and new.status = 'pending')
    ) then
      raise exception 'invalid payment status transition'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  if new.status = 'refunded' and new.refunded_at is null then
    new.refunded_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Student/owner/admin cancellation now applies the refund policy.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_owner_id uuid;
  v_payment public.payments%rowtype;
  v_fee_rate numeric(5, 4) := 0;
  v_window_hours integer := 24;
  v_refundable boolean := false;
  v_fee integer := 0;
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  if v_actor is null then
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
    v_booking.student_id = v_actor
    or v_owner_id = v_actor
    or (select private.has_role('admin'::public.app_role))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_booking.status in ('cancelled', 'completed') then
    return;
  end if;

  select ps.gateway_fee_rate, ps.cancellation_window_hours
    into v_fee_rate, v_window_hours
  from public.platform_settings as ps
  where ps.id = true;

  v_fee_rate := coalesce(v_fee_rate, 0);
  v_window_hours := coalesce(v_window_hours, 24);

  update public.bookings
  set status = 'cancelled',
      cancellation_reason = v_reason
  where id = p_booking_id;

  select p.*
    into v_payment
  from public.payments as p
  where p.booking_id = p_booking_id
    and p.deleted_at is null
    and p.status in ('pending', 'paid')
  order by p.created_at desc
  limit 1
  for update of p;

  if v_payment.id is not null then
    if v_payment.status = 'pending' then
      -- An attempt that was never collected simply fails.
      update public.payments
      set status = 'failed',
          failure_reason = 'booking cancelled'
      where id = v_payment.id;
    else
      -- "at least N hours before check-in" (check-in is the start of move-in day).
      v_refundable := now() <= (
        v_booking.move_in_date::timestamp - make_interval(hours => v_window_hours)
      )::timestamp with time zone;

      if v_refundable then
        v_fee := round(v_payment.amount_piastres * v_fee_rate)::integer;

        update public.payments
        set status = 'refund_pending',
            refund_amount_piastres = greatest(v_payment.amount_piastres - v_fee, 0),
            refund_fee_piastres = v_fee,
            refund_requested_at = now(),
            refund_reason = 'cancelled inside the refund window; waiting for the admin to transfer the money'
        where id = v_payment.id;
      else
        -- After the deadline the payment stays paid: no refund is owed.
        update public.payments
        set refund_amount_piastres = 0,
            refund_fee_piastres = 0,
            refund_reason = 'cancelled after the refund deadline; no refund owed'
        where id = v_payment.id;
      end if;
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'booking.cancelled',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'reason', v_reason,
      'refund_requested', v_refundable,
      'refund_amount_piastres', case when v_refundable then v_payment.amount_piastres - v_fee else 0 end,
      'refund_fee_piastres', case when v_refundable then v_fee else 0 end
    )
  );
end;
$$;

revoke all on function public.cancel_booking(uuid, text)
from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin executes the refund that the policy already approved.
-- ---------------------------------------------------------------------------
create function public.confirm_booking_refund(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
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

  select p.*
    into v_payment
  from public.payments as p
  where p.booking_id = p_booking_id
    and p.deleted_at is null
    and p.status = 'refund_pending'
  order by p.created_at desc
  limit 1
  for update of p;

  if v_payment.id is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  update public.payments
  set status = 'refunded',
      refunded_at = now(),
      refund_reason = 'refund transfer executed by admin'
  where id = v_payment.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.refund_confirmed',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'refund_amount_piastres', v_payment.refund_amount_piastres,
      'refund_fee_piastres', v_payment.refund_fee_piastres
    )
  );
end;
$$;

revoke all on function public.confirm_booking_refund(uuid)
from public, anon, authenticated;
grant execute on function public.confirm_booking_refund(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin decides the payment is not refundable after all (e.g. policy dispute).
-- The payment returns to `paid`.
-- ---------------------------------------------------------------------------
create function public.decline_booking_refund(p_booking_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
  v_updated integer;
begin
  if not (select private.is_trusted_payment_caller()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.payments
  set status = 'paid',
      refund_amount_piastres = null,
      refund_fee_piastres = 0,
      refund_requested_at = null,
      refund_reason = coalesce(v_reason, 'refund declined by admin')
  where booking_id = p_booking_id
    and deleted_at is null
    and status = 'refund_pending';

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.refund_declined',
    'booking',
    p_booking_id,
    jsonb_build_object('reason', coalesce(v_reason, 'refund declined by admin'))
  );
end;
$$;

revoke all on function public.decline_booking_refund(uuid, text)
from public, anon, authenticated;
grant execute on function public.decline_booking_refund(uuid, text)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Manual override (existing admin action). It now records the amount and the
-- deducted gateway fee instead of only flipping the status.
-- ---------------------------------------------------------------------------
create or replace function public.refund_booking_payment(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_payment public.payments%rowtype;
  v_fee_rate numeric(5, 4) := 0;
  v_fee integer := 0;
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

  select p.*
    into v_payment
  from public.payments as p
  where p.booking_id = p_booking_id
    and p.deleted_at is null
    and p.status = 'paid'
  order by p.created_at desc
  limit 1
  for update of p;

  if v_payment.id is null then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  select coalesce(ps.gateway_fee_rate, 0)
    into v_fee_rate
  from public.platform_settings as ps
  where ps.id = true;

  v_fee := round(v_payment.amount_piastres * coalesce(v_fee_rate, 0))::integer;

  update public.payments
  set status = 'refunded',
      refund_amount_piastres = greatest(v_payment.amount_piastres - v_fee, 0),
      refund_fee_piastres = v_fee,
      refund_requested_at = coalesce(v_payment.refund_requested_at, now()),
      refunded_at = now(),
      refund_reason = 'manual admin refund'
  where id = v_payment.id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.refunded',
    'booking',
    p_booking_id,
    jsonb_build_object(
      'refund_amount_piastres', greatest(v_payment.amount_piastres - v_fee, 0),
      'refund_fee_piastres', v_fee,
      'manual_override', true
    )
  );
end;
$$;

revoke all on function public.refund_booking_payment(uuid)
from public, anon, authenticated;
grant execute on function public.refund_booking_payment(uuid)
to authenticated, service_role;
