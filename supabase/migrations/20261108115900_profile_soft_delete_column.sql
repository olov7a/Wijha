-- Phase C / 03: profile soft-delete column.
--
-- The booking/matching RPCs in 20261108120000 filter `sp.deleted_at is null`
-- on `student_profiles`, and the dashboards do the same in code. The B1
-- schema never added a soft-delete flag to the role-profile tables (B2 only
-- covered the nine business tables), so the SQL function body failed
-- validation on apply ("column sp.deleted_at does not exist").
--
-- This migration lands BEFORE 20261108120000 (earlier timestamp) so the
-- function validates cleanly. It does not change RLS: the existing
-- student/owner profile policies stay as-is, the column is just a flag for
-- the read paths above.

alter table public.student_profiles
  add column if not exists deleted_at timestamp with time zone;

alter table public.owner_profiles
  add column if not exists deleted_at timestamp with time zone;

create index if not exists student_profiles_deleted_at_idx
  on public.student_profiles (deleted_at) where deleted_at is not null;

create index if not exists owner_profiles_deleted_at_idx
  on public.owner_profiles (deleted_at) where deleted_at is not null;
