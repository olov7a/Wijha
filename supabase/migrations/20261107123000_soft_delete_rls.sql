-- Phase B2 / 04: RLS for soft-deleted rows.
-- Normal users and staff never see deleted rows. Admins get an extra SELECT
-- policy on each table so the restore screen can list deleted records.
-- Hard DELETE is revoked everywhere; deletes go through the functions above.

revoke delete on table
  public.units,
  public.rooms,
  public.beds,
  public.unit_visits,
  public.unit_evaluations,
  public.reviews,
  public.bookings,
  public.payments,
  public.contracts
from anon, authenticated;

drop policy if exists "rooms_delete_owner" on public.rooms;
drop policy if exists "beds_delete_owner" on public.beds;
drop policy if exists "unit_visits_delete_leader_admin" on public.unit_visits;

-- ---------------------------------------------------------------------------
-- Units
-- ---------------------------------------------------------------------------
drop policy if exists "units_select_public" on public.units;
create policy "units_select_public"
on public.units for select to anon, authenticated
using (status = 'approved' and deleted_at is null);

drop policy if exists "units_select_owner" on public.units;
create policy "units_select_owner"
on public.units for select to authenticated
using ((select auth.uid()) = owner_id and deleted_at is null);

drop policy if exists "units_select_staff" on public.units;
create policy "units_select_staff"
on public.units for select to authenticated
using ((select private.is_staff()) and deleted_at is null);

drop policy if exists "units_select_admin_all" on public.units;
create policy "units_select_admin_all"
on public.units for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "units_insert_owner" on public.units;
create policy "units_insert_owner"
on public.units for insert to authenticated
with check (
  (select auth.uid()) = owner_id
  and (select private.has_role('owner'::public.app_role))
  and status = 'pending'
  and deleted_at is null
);

drop policy if exists "units_update_owner" on public.units;
create policy "units_update_owner"
on public.units for update to authenticated
using ((select auth.uid()) = owner_id and deleted_at is null)
with check ((select auth.uid()) = owner_id and deleted_at is null);

drop policy if exists "units_update_leader_status" on public.units;
create policy "units_update_leader_status"
on public.units for update to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null)
with check ((select private.is_leader_or_admin()) and deleted_at is null);

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
drop policy if exists "rooms_select_public" on public.rooms;
create policy "rooms_select_public"
on public.rooms for select to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = rooms.unit_id
      and u.status = 'approved'
      and u.deleted_at is null
  )
);

drop policy if exists "rooms_select_owner" on public.rooms;
create policy "rooms_select_owner"
on public.rooms for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "rooms_select_staff" on public.rooms;
create policy "rooms_select_staff"
on public.rooms for select to authenticated
using ((select private.is_staff()) and deleted_at is null);

drop policy if exists "rooms_select_admin_all" on public.rooms;
create policy "rooms_select_admin_all"
on public.rooms for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "rooms_insert_owner" on public.rooms;
create policy "rooms_insert_owner"
on public.rooms for insert to authenticated
with check (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "rooms_update_owner" on public.rooms;
create policy "rooms_update_owner"
on public.rooms for update to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
)
with check (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Beds
-- ---------------------------------------------------------------------------
drop policy if exists "beds_select_public" on public.beds;
create policy "beds_select_public"
on public.beds for select to anon, authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and r.deleted_at is null
      and u.status = 'approved'
      and u.deleted_at is null
  )
);

drop policy if exists "beds_select_owner" on public.beds;
create policy "beds_select_owner"
on public.beds for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and r.deleted_at is null
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "beds_select_staff" on public.beds;
create policy "beds_select_staff"
on public.beds for select to authenticated
using ((select private.is_staff()) and deleted_at is null);

drop policy if exists "beds_select_admin_all" on public.beds;
create policy "beds_select_admin_all"
on public.beds for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "beds_insert_owner" on public.beds;
create policy "beds_insert_owner"
on public.beds for insert to authenticated
with check (
  deleted_at is null
  and exists (
    select 1 from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and r.deleted_at is null
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "beds_update_owner" on public.beds;
create policy "beds_update_owner"
on public.beds for update to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and r.deleted_at is null
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
)
with check (
  deleted_at is null
  and exists (
    select 1 from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and r.deleted_at is null
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Unit visits
-- ---------------------------------------------------------------------------
drop policy if exists "unit_visits_select_team_own" on public.unit_visits;
create policy "unit_visits_select_team_own"
on public.unit_visits for select to authenticated
using ((select auth.uid()) = team_member_id and deleted_at is null);

drop policy if exists "unit_visits_select_leader_admin" on public.unit_visits;
create policy "unit_visits_select_leader_admin"
on public.unit_visits for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "unit_visits_select_owner" on public.unit_visits;
create policy "unit_visits_select_owner"
on public.unit_visits for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = unit_visits.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "unit_visits_select_admin_all" on public.unit_visits;
create policy "unit_visits_select_admin_all"
on public.unit_visits for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "unit_visits_insert_leader_admin" on public.unit_visits;
create policy "unit_visits_insert_leader_admin"
on public.unit_visits for insert to authenticated
with check (
  deleted_at is null
  and (select private.is_leader_or_admin())
  and exists (
    select 1 from public.units as u
    where u.id = unit_visits.unit_id
      and u.deleted_at is null
  )
);

drop policy if exists "unit_visits_update_team_own" on public.unit_visits;
create policy "unit_visits_update_team_own"
on public.unit_visits for update to authenticated
using (
  deleted_at is null
  and (
    (select auth.uid()) = team_member_id
    or (select private.is_leader_or_admin())
  )
  and exists (
    select 1 from public.units as u
    where u.id = unit_visits.unit_id
      and u.deleted_at is null
  )
)
with check (
  deleted_at is null
  and (
    (select auth.uid()) = team_member_id
    or (select private.is_leader_or_admin())
  )
  and exists (
    select 1 from public.units as u
    where u.id = unit_visits.unit_id
      and u.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Unit evaluations
-- ---------------------------------------------------------------------------
drop policy if exists "unit_evaluations_select_team_own" on public.unit_evaluations;
create policy "unit_evaluations_select_team_own"
on public.unit_evaluations for select to authenticated
using ((select auth.uid()) = team_member_id and deleted_at is null);

drop policy if exists "unit_evaluations_select_owner" on public.unit_evaluations;
create policy "unit_evaluations_select_owner"
on public.unit_evaluations for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = unit_evaluations.unit_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "unit_evaluations_select_leader_admin" on public.unit_evaluations;
create policy "unit_evaluations_select_leader_admin"
on public.unit_evaluations for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "unit_evaluations_select_admin_all" on public.unit_evaluations;
create policy "unit_evaluations_select_admin_all"
on public.unit_evaluations for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "unit_evaluations_insert_assigned_team" on public.unit_evaluations;
create policy "unit_evaluations_insert_assigned_team"
on public.unit_evaluations for insert to authenticated
with check (
  deleted_at is null
  and (select auth.uid()) = team_member_id
  and (select private.has_role('team'::public.app_role))
  and exists (
    select 1 from public.unit_visits as v
    where v.id = unit_evaluations.visit_id
      and v.unit_id = unit_evaluations.unit_id
      and v.team_member_id = (select auth.uid())
      and v.status in ('scheduled', 'completed')
      and v.deleted_at is null
  )
  and exists (
    select 1 from public.units as u
    where u.id = unit_evaluations.unit_id
      and u.deleted_at is null
  )
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
drop policy if exists "reviews_select_public_approved" on public.reviews;
create policy "reviews_select_public_approved"
on public.reviews for select to anon, authenticated
using (
  target_type = 'unit'
  and moderation_status = 'approved'
  and deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = reviews.target_id
      and u.deleted_at is null
  )
);

drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own"
on public.reviews for select to authenticated
using ((select auth.uid()) = reviewer_id and deleted_at is null);

drop policy if exists "reviews_select_owner" on public.reviews;
create policy "reviews_select_owner"
on public.reviews for select to authenticated
using (
  target_type = 'unit'
  and moderation_status = 'approved'
  and deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = reviews.target_id
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "reviews_select_staff" on public.reviews;
create policy "reviews_select_staff"
on public.reviews for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "reviews_select_admin_all" on public.reviews;
create policy "reviews_select_admin_all"
on public.reviews for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
on public.reviews for insert to authenticated
with check (
  deleted_at is null
  and (select auth.uid()) = reviewer_id
  and moderation_status = 'pending'
);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
drop policy if exists "bookings_select_student_own" on public.bookings;
create policy "bookings_select_student_own"
on public.bookings for select to authenticated
using ((select auth.uid()) = student_id and deleted_at is null);

drop policy if exists "bookings_select_owner" on public.bookings;
create policy "bookings_select_owner"
on public.bookings for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.units as u
    where u.id = bookings.unit_id
      and u.owner_id = (select auth.uid())
  )
);

drop policy if exists "bookings_select_staff" on public.bookings;
create policy "bookings_select_staff"
on public.bookings for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "bookings_select_admin_all" on public.bookings;
create policy "bookings_select_admin_all"
on public.bookings for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
drop policy if exists "payments_select_student_own" on public.payments;
create policy "payments_select_student_own"
on public.payments for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.bookings as b
    where b.id = payments.booking_id
      and b.student_id = (select auth.uid())
      and b.deleted_at is null
  )
);

drop policy if exists "payments_select_owner" on public.payments;
create policy "payments_select_owner"
on public.payments for select to authenticated
using (
  deleted_at is null
  and exists (
    select 1 from public.bookings as b
    join public.units as u on u.id = b.unit_id
    where b.id = payments.booking_id
      and b.deleted_at is null
      and u.owner_id = (select auth.uid())
  )
);

drop policy if exists "payments_select_staff" on public.payments;
create policy "payments_select_staff"
on public.payments for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "payments_select_admin_all" on public.payments;
create policy "payments_select_admin_all"
on public.payments for select to authenticated
using ((select private.has_role('admin'::public.app_role)));

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------
drop policy if exists "contracts_select_student_own" on public.contracts;
create policy "contracts_select_student_own"
on public.contracts for select to authenticated
using ((select auth.uid()) = student_id and deleted_at is null);

drop policy if exists "contracts_select_owner_own" on public.contracts;
create policy "contracts_select_owner_own"
on public.contracts for select to authenticated
using ((select auth.uid()) = owner_id and deleted_at is null);

drop policy if exists "contracts_select_staff" on public.contracts;
create policy "contracts_select_staff"
on public.contracts for select to authenticated
using ((select private.is_leader_or_admin()) and deleted_at is null);

drop policy if exists "contracts_select_admin_all" on public.contracts;
create policy "contracts_select_admin_all"
on public.contracts for select to authenticated
using ((select private.has_role('admin'::public.app_role)));
