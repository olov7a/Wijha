-- Phase B2 / 01: soft-delete columns for business data.
-- Identity tables (profiles, student_profiles, owner_profiles) are intentionally
-- excluded: account deletion is a separate retention/legal flow.
-- Logs and technical tables (audit_logs, platform_settings) are also excluded.

alter table public.units
  add column deleted_at timestamp with time zone;

alter table public.rooms
  add column deleted_at timestamp with time zone;

alter table public.beds
  add column deleted_at timestamp with time zone;

alter table public.unit_visits
  add column deleted_at timestamp with time zone;

alter table public.unit_evaluations
  add column deleted_at timestamp with time zone;

alter table public.reviews
  add column deleted_at timestamp with time zone;

alter table public.bookings
  add column deleted_at timestamp with time zone;

alter table public.payments
  add column deleted_at timestamp with time zone;

alter table public.contracts
  add column deleted_at timestamp with time zone;
