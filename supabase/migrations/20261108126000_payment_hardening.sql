-- Phase C / 07: payment hardening.
--
-- Fixes vs audit A8/A11/A13/A17:
-- 1. Add `expired` to payment_status and a payable-until timestamp so a
--    pending attempt cannot be collected forever. `confirm_booking_payment`
--    already refuses anything that is not `pending_payment`, and the payment
--    trigger now allows pending -> expired (and never expired -> paid).
-- 2. Add an append-only `payment_events` log (no update/delete grants); a
--    trigger records every status change. The existing `audit_logs` entries
--    stay for actor context.
-- 3. Refunds are admin/service_role only (`refund_booking_payment`). The
--    self-service `cancel_booking` stops refunding directly: a cancelled
--    booking with a paid payment stays `paid` until an admin refunds it.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_status'
      and e.enumlabel = 'expired'
  ) then
    alter type public.payment_status add value 'expired';
  end if;
end
$$;

alter table public.payments
  add column if not exists expires_at timestamp with time zone;

update public.payments
set expires_at = created_at + interval '7 days'
where status = 'pending'
  and expires_at is null;

create index if not exists payments_expires_at_idx
  on public.payments (expires_at) where status = 'pending';

-- Extend the state machine: pending may expire, expired never becomes paid.
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
      or (old.status = 'paid' and new.status = 'refunded')
      or (old.status = 'failed' and new.status = 'pending')
    ) then
      raise exception 'invalid payment status transition'
        using errcode = '23514';
    end if;
  end if;

  if new.status = 'paid' and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- payment_events: append-only ledger, admin-readable RLS only
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id bigserial primary key,
  booking_id uuid not null references public.bookings (id) on delete restrict,
  payment_id uuid references public.payments (id) on delete restrict,
  from_status public.payment_status,
  to_status public.payment_status not null,
  amount_piastres integer not null check (amount_piastres >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamp with time zone not null default now()
);

alter table public.payment_events enable row level security;

revoke all on table public.payment_events from anon, authenticated;
grant select on table public.payment_events to authenticated;

drop policy if exists "payment_events_select_admin" on public.payment_events;
create policy "payment_events_select_admin"
on public.payment_events
for select
to authenticated
using ((select private.has_role('admin'::public.app_role)));

create index if not exists payment_events_booking_idx
  on public.payment_events (booking_id);
create index if not exists payment_events_created_idx
  on public.payment_events (created_at desc);

create or replace function private.record_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.payment_events (
    booking_id, payment_id, from_status, to_status, amount_piastres, currency
  )
  values (
    new.booking_id, new.id, old.status, new.status, new.amount_piastres, new.currency
  );
  return new;
end;
$$;

revoke all on function private.record_payment_event()
from public, anon, authenticated;

drop trigger if exists payments_record_event on public.payments;
create trigger payments_record_event
after update of status on public.payments
for each row
execute function private.record_payment_event();

-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
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

  if v_booking.status in ('cancelled', 'completed') then
    return;
  end if;

  update public.bookings
  set status = 'cancelled',
      cancellation_reason = nullif(left(btrim(coalesce(p_reason, '')), 500), '')
  where id = p_booking_id;

  -- A pending attempt simply failed. A captured payment stays `paid`
  -- until an admin refunds it via refund_booking_payment; letting the
  -- cancelling party refund themselves would hand money back without review.
  update public.payments
  set status = 'failed',
      failure_reason = 'booking cancelled'
  where booking_id = p_booking_id
    and status = 'pending';

  if (select private.is_trusted_payment_caller()) then
    update public.payments
    set status = 'refunded'
    where booking_id = p_booking_id
      and status = 'paid';
  end if;

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

-- Refunds are admin/service_role only
-- ---------------------------------------------------------------------------
create function public.refund_booking_payment(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
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

  if not exists (
    select 1 from public.payments
    where booking_id = p_booking_id and status = 'paid' and deleted_at is null
  ) then
    raise exception 'INVALID_STATE' using errcode = '23514';
  end if;

  update public.payments
  set status = 'refunded'
  where booking_id = p_booking_id
    and status = 'paid';

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'payment.refunded',
    'booking',
    p_booking_id,
    jsonb_build_object()
  );
end;
$$;

revoke all on function public.refund_booking_payment(uuid)
from public, anon, authenticated;
grant execute on function public.refund_booking_payment(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New pending attempts expire in 7 days so a held bed never blocks forever.
-- `confirm_booking_payment` already rejects any attempt whose booking is not
-- `pending_payment`, and `protect_payment_fields` never lets `expired` go to
-- `paid`, so an expired attempt can never be collected later.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
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

  insert into public.payments (booking_id, amount_piastres, method, status, expires_at)
  select b.id, b.total_amount_piastres, 'card', 'pending', now() + interval '7 days'
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
