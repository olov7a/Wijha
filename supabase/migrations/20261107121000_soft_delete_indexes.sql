-- Phase B2 / 02: soft-delete indexes and partial uniqueness.
-- Deleted rows must not block new active rows, so every uniqueness rule that
-- applies to live business data becomes a partial index that ignores them.

-- Rooms: one live room name per unit.
alter table public.rooms
  drop constraint rooms_unit_name_unique;

create unique index rooms_unit_name_active_unique
on public.rooms (unit_id, name)
where deleted_at is null;

-- Beds: one live bed label per room.
alter table public.beds
  drop constraint beds_room_label_unique;

create unique index beds_room_label_active_unique
on public.beds (room_id, label)
where deleted_at is null;

-- Evaluations: one live evaluation per visit.
alter table public.unit_evaluations
  drop constraint unit_evaluations_visit_id_key;

create unique index unit_evaluations_visit_active_unique
on public.unit_evaluations (visit_id)
where deleted_at is null;

-- Reviews: one live review per reviewer/target.
alter table public.reviews
  drop constraint reviews_one_per_target;

create unique index reviews_one_per_target_active
on public.reviews (reviewer_id, target_type, target_id)
where deleted_at is null;

-- Bookings: active booking rules ignore soft-deleted bookings.
drop index public.bookings_active_bed_unique;

create unique index bookings_active_bed_unique
on public.bookings (bed_id)
where bed_id is not null
  and status in ('pending_payment', 'confirmed')
  and deleted_at is null;

drop index public.bookings_active_room_unique;

create unique index bookings_active_room_unique
on public.bookings (room_id)
where bed_id is null
  and status in ('pending_payment', 'confirmed')
  and deleted_at is null;

-- Payments: a soft-deleted payment is still a real gateway event, so the two
-- idempotency indexes stay global. Only the "one paid payment per booking"
-- rule ignores deleted rows, to allow a fresh payment after a refund/removal.
drop index public.payments_one_paid_per_booking;

create unique index payments_one_paid_per_booking
on public.payments (booking_id)
where status = 'paid'
  and deleted_at is null;

-- Contracts: one live contract per booking.
drop index public.contracts_one_per_booking;

create unique index contracts_one_per_booking_active
on public.contracts (booking_id)
where booking_id is not null
  and deleted_at is null;

-- Admin restore lists filter on deleted rows; keep those scans cheap.
create index units_deleted_at_idx on public.units (deleted_at)
where deleted_at is not null;

create index rooms_deleted_at_idx on public.rooms (deleted_at)
where deleted_at is not null;

create index beds_deleted_at_idx on public.beds (deleted_at)
where deleted_at is not null;

create index unit_visits_deleted_at_idx on public.unit_visits (deleted_at)
where deleted_at is not null;

create index unit_evaluations_deleted_at_idx on public.unit_evaluations (deleted_at)
where deleted_at is not null;

create index reviews_deleted_at_idx on public.reviews (deleted_at)
where deleted_at is not null;

create index bookings_deleted_at_idx on public.bookings (deleted_at)
where deleted_at is not null;

create index payments_deleted_at_idx on public.payments (deleted_at)
where deleted_at is not null;

create index contracts_deleted_at_idx on public.contracts (deleted_at)
where deleted_at is not null;
