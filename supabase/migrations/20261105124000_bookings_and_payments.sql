-- Phase B1 / 05: bookings and payments.
-- Users can read their own rows only. Creating a booking and every payment
-- transition is server-only (service-role admin client / security-definer RPC),
-- because those rows decide money and bed availability.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete restrict,
  unit_id uuid not null references public.units (id) on delete restrict,
  room_id uuid not null,
  bed_id uuid,
  move_in_date date not null,
  move_out_date date,
  rent_amount_piastres integer not null
    check (rent_amount_piastres > 0),
  commission_rate_snapshot numeric(5, 4) not null
    check (commission_rate_snapshot between 0 and 1),
  commission_amount_piastres integer not null
    check (commission_amount_piastres >= 0),
  total_amount_piastres integer generated always as (
    rent_amount_piastres + commission_amount_piastres
  ) stored,
  status public.booking_status not null default 'pending_payment',
  cancellation_reason text
    check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint bookings_room_unit_fk
    foreign key (room_id, unit_id)
    references public.rooms (id, unit_id)
    on delete restrict,
  constraint bookings_bed_room_fk
    foreign key (bed_id, room_id)
    references public.beds (id, room_id)
    on delete restrict,
  constraint bookings_dates_valid
    check (move_out_date is null or move_out_date > move_in_date),
  constraint bookings_commission_amount_valid
    check (commission_amount_piastres = round(rent_amount_piastres * commission_rate_snapshot))
);

alter table public.bookings enable row level security;

revoke all on table public.bookings from anon, authenticated;
grant select on table public.bookings to authenticated;

create policy "bookings_select_student_own"
on public.bookings
for select
to authenticated
using ((select auth.uid()) = student_id);

create policy "bookings_select_owner"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = bookings.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "bookings_select_staff"
on public.bookings
for select
to authenticated
using ((select private.is_leader_or_admin()));

create index bookings_student_id_idx on public.bookings (student_id);
create index bookings_unit_id_idx on public.bookings (unit_id);
create index bookings_room_id_idx on public.bookings (room_id);
create index bookings_bed_id_idx on public.bookings (bed_id);
create index bookings_status_created_at_idx
on public.bookings (status, created_at desc);

-- At most one live booking per bed, and one live whole-room booking per room.
create unique index bookings_active_bed_unique
on public.bookings (bed_id)
where bed_id is not null
  and status in ('pending_payment', 'confirmed');

create unique index bookings_active_room_unique
on public.bookings (room_id)
where bed_id is null
  and status in ('pending_payment', 'confirmed');

-- The server never trusts a client-supplied commission. The rate is read from
-- platform_settings and snapshotted here, so past bookings never change when
-- the platform commission changes later.
create function private.set_booking_financials()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_rate numeric(5, 4);
begin
  select ps.commission_rate
    into configured_rate
  from public.platform_settings as ps
  where ps.id = true;

  if configured_rate is null then
    raise exception 'platform commission is not configured'
      using errcode = '55000';
  end if;

  new.commission_rate_snapshot := configured_rate;
  new.commission_amount_piastres :=
    round(new.rent_amount_piastres * configured_rate)::integer;

  return new;
end;
$$;

revoke all on function private.set_booking_financials()
from public, anon, authenticated;

create trigger bookings_set_financials
before insert on public.bookings
for each row
execute function private.set_booking_financials();

-- Male/female separation is enforced in the database, not only in the UI.
create function private.enforce_booking_gender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  unit_gender public.gender_type;
  student_gender public.gender_type;
begin
  select u.gender_type
    into unit_gender
  from public.units as u
  where u.id = new.unit_id;

  select sp.gender
    into student_gender
  from public.student_profiles as sp
  where sp.user_id = new.student_id;

  if unit_gender is null or student_gender is null then
    raise exception 'booking requires a student profile and an existing unit'
      using errcode = '23514';
  end if;

  -- Only approved units can be booked, even if server code has a bug.
  if not exists (
    select 1
    from public.units as u
    where u.id = new.unit_id
      and u.status = 'approved'
  ) then
    raise exception 'unit is not approved for booking'
      using errcode = '23514';
  end if;

  if unit_gender <> student_gender then
    raise exception 'unit gender does not match student gender'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_booking_gender()
from public, anon, authenticated;

create trigger bookings_enforce_gender
before insert or update of student_id, unit_id on public.bookings
for each row
execute function private.enforce_booking_gender();

-- A booking is a financial record. Its parties, bed, dates and money snapshot
-- are immutable; only the status may move forward through the allowed path.
create function private.protect_booking_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_id is distinct from old.student_id
     or new.unit_id is distinct from old.unit_id
     or new.room_id is distinct from old.room_id
     or new.bed_id is distinct from old.bed_id
     or new.move_in_date is distinct from old.move_in_date
     or new.move_out_date is distinct from old.move_out_date
     or new.rent_amount_piastres is distinct from old.rent_amount_piastres
     or new.commission_rate_snapshot is distinct from old.commission_rate_snapshot
     or new.commission_amount_piastres is distinct from old.commission_amount_piastres
  then
    raise exception 'booking financial and identity fields are immutable'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending_payment' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('cancelled', 'completed'))
    ) then
      raise exception 'invalid booking status transition'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_booking_fields()
from public, anon, authenticated;

create trigger bookings_protect_fields
before update on public.bookings
for each row
execute function private.protect_booking_fields();

-- Conflict guard for the case a room is booked as a whole and individual beds
-- are booked in the same room. The server RPC must also lock the bed/room row
-- inside the transaction; this trigger is the defence-in-depth layer.
create function private.check_booking_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status not in ('pending_payment', 'confirmed') then
    return new;
  end if;

  if new.bed_id is null then
    if exists (
      select 1
      from public.bookings as b
      where b.room_id = new.room_id
        and b.id <> new.id
        and b.status in ('pending_payment', 'confirmed')
    ) then
      raise exception 'room already has an active booking'
        using errcode = '23505';
    end if;
  else
    if exists (
      select 1
      from public.bookings as b
      where b.room_id = new.room_id
        and b.bed_id is null
        and b.id <> new.id
        and b.status in ('pending_payment', 'confirmed')
    ) then
      raise exception 'room is booked as a whole'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.check_booking_conflicts()
from public, anon, authenticated;

create trigger bookings_check_conflicts
before insert or update of room_id, bed_id, status on public.bookings
for each row
execute function private.check_booking_conflicts();

-- Bed status follows the live booking. Owners cannot write bed status directly.
create function private.sync_bed_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status public.bed_status;
begin
  if new.bed_id is null then
    return new;
  end if;

  next_status := case
    when new.status = 'pending_payment' then 'held'::public.bed_status
    when new.status = 'confirmed' then 'booked'::public.bed_status
    else 'available'::public.bed_status
  end;

  update public.beds as b
  set status = next_status
  where b.id = new.bed_id
    and not exists (
      select 1
      from public.bookings as other
      where other.bed_id = new.bed_id
        and other.id <> new.id
        and other.status in ('pending_payment', 'confirmed')
    );

  return new;
end;
$$;

revoke all on function private.sync_bed_status()
from public, anon, authenticated;

create trigger bookings_sync_bed_status
after insert or update of status on public.bookings
for each row
execute function private.sync_bed_status();

-- Changing an approved unit's gender while live bookings exist would break the
-- separation rule for already-booked students.
create function private.protect_unit_gender_with_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gender_type is distinct from old.gender_type
     and exists (
       select 1
       from public.bookings as b
       where b.unit_id = new.id
         and b.status in ('pending_payment', 'confirmed')
     )
  then
    raise exception 'cannot change unit gender while active bookings exist'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_unit_gender_with_bookings()
from public, anon, authenticated;

create trigger units_protect_gender_with_bookings
before update of gender_type on public.units
for each row
execute function private.protect_unit_gender_with_bookings();

-- The same separation rule must survive a student editing their own gender after
-- an active booking. Otherwise the booked unit would silently become invalid.
create function private.protect_student_gender_with_bookings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.gender is distinct from old.gender
     and exists (
       select 1
       from public.bookings as b
       where b.student_id = new.user_id
         and b.status in ('pending_payment', 'confirmed')
     )
  then
    raise exception 'cannot change student gender while active bookings exist'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_student_gender_with_bookings()
from public, anon, authenticated;

create trigger student_profiles_protect_gender_with_bookings
before update of gender on public.student_profiles
for each row
execute function private.protect_student_gender_with_bookings();

create trigger bookings_set_updated_at
before update on public.bookings
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  amount_piastres integer not null
    check (amount_piastres > 0),
  currency text not null default 'EGP'
    check (currency ~ '^[A-Z]{3}$'),
  method text not null
    check (method ~ '^[a-z0-9_-]{2,40}$'),
  gateway_reference text
    check (gateway_reference is null or char_length(gateway_reference) <= 200),
  gateway_event_id text
    check (gateway_event_id is null or char_length(gateway_event_id) <= 200),
  status public.payment_status not null default 'pending',
  failure_reason text
    check (failure_reason is null or char_length(failure_reason) <= 500),
  paid_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.payments enable row level security;

revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;

create policy "payments_select_student_own"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings as b
    where b.id = payments.booking_id
      and b.student_id = (select auth.uid())
  )
);

create policy "payments_select_owner"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings as b
    join public.units as u on u.id = b.unit_id
    where b.id = payments.booking_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "payments_select_staff"
on public.payments
for select
to authenticated
using ((select private.is_leader_or_admin()));

create index payments_booking_id_idx on public.payments (booking_id);
create index payments_status_idx on public.payments (status);

-- Idempotency for webhook retries: the same gateway event cannot be recorded
-- twice, and the same gateway reference cannot belong to two payments.
create unique index payments_gateway_reference_unique
on public.payments (gateway_reference)
where gateway_reference is not null;

create unique index payments_gateway_event_unique
on public.payments (gateway_event_id)
where gateway_event_id is not null;

-- A booking may have several attempts, but only one successful payment. This is
-- the final guard against double-charging when a webhook is retried or replayed.
create unique index payments_one_paid_per_booking
on public.payments (booking_id)
where status = 'paid';

create function private.protect_payment_fields()
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
      (old.status = 'pending' and new.status in ('paid', 'failed'))
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

revoke all on function private.protect_payment_fields()
from public, anon, authenticated;

create trigger payments_protect_fields
before update on public.payments
for each row
execute function private.protect_payment_fields();

create trigger payments_set_updated_at
before update on public.payments
for each row
execute function private.set_updated_at();
