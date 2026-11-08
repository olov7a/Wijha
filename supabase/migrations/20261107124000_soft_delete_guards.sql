-- Phase B2 / 05: guards that must ignore soft-deleted rows, plus storage
-- policies so deleted units/visits/contracts stop accepting or exposing files.

-- ---------------------------------------------------------------------------
-- Booking guards
-- ---------------------------------------------------------------------------
create or replace function private.check_booking_conflicts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

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
        and b.deleted_at is null
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
        and b.deleted_at is null
    ) then
      raise exception 'room is booked as a whole'
        using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.sync_bed_status()
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

  if new.deleted_at is not null then
    update public.beds as b
    set status = 'available'
    where b.id = new.bed_id
      and not exists (
        select 1
        from public.bookings as other
        where other.bed_id = new.bed_id
          and other.id <> new.id
          and other.deleted_at is null
          and other.status in ('pending_payment', 'confirmed')
      );

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
        and other.deleted_at is null
        and other.status in ('pending_payment', 'confirmed')
    );

  return new;
end;
$$;

drop trigger if exists bookings_sync_bed_status on public.bookings;
create trigger bookings_sync_bed_status
after insert or update of status, deleted_at on public.bookings
for each row
execute function private.sync_bed_status();

drop trigger if exists bookings_check_conflicts on public.bookings;
create trigger bookings_check_conflicts
before insert or update of room_id, bed_id, status, deleted_at on public.bookings
for each row
execute function private.check_booking_conflicts();

create or replace function private.protect_unit_gender_with_bookings()
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
         and b.deleted_at is null
     )
  then
    raise exception 'cannot change unit gender while active bookings exist'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.protect_student_gender_with_bookings()
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
         and b.deleted_at is null
     )
  then
    raise exception 'cannot change student gender while active bookings exist'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_booking_gender()
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
  where u.id = new.unit_id
    and u.deleted_at is null;

  select sp.gender
    into student_gender
  from public.student_profiles as sp
  where sp.user_id = new.student_id;

  if unit_gender is null or student_gender is null then
    raise exception 'booking requires a student profile and an existing unit'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.units as u
    where u.id = new.unit_id
      and u.status = 'approved'
      and u.deleted_at is null
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

-- ---------------------------------------------------------------------------
-- Visits, evaluations, reviews, contracts
-- ---------------------------------------------------------------------------
create or replace function private.validate_unit_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.unit_visits as v
    where v.id = new.visit_id
      and v.unit_id = new.unit_id
      and v.team_member_id = new.team_member_id
      and v.deleted_at is null
  ) then
    raise exception 'evaluation does not match its assigned visit'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.units as u
    where u.id = new.unit_id
      and u.deleted_at is null
  ) then
    raise exception 'evaluation unit is deleted'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(new.photo_paths) as p(path)
    where p.path is null
       or p.path not like new.unit_id::text || '/%'
       or position('..' in p.path) > 0
       or char_length(p.path) > 1024
  ) then
    raise exception 'evaluation photo path must belong to the unit'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.complete_visit_after_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.unit_visits
  set status = 'completed'
  where id = new.visit_id
    and status = 'scheduled'
    and deleted_at is null;

  return new;
end;
$$;

create or replace function private.validate_review_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'unit' then
    if not exists (
      select 1
      from public.units as u
      where u.id = new.target_id
        and u.deleted_at is null
    ) then
      raise exception 'review target unit does not exist'
        using errcode = '23503';
    end if;

    if not exists (
      select 1
      from public.bookings as b
      where b.student_id = new.reviewer_id
        and b.unit_id = new.target_id
        and b.status in ('confirmed', 'completed')
        and b.deleted_at is null
    ) then
      raise exception 'only students with a confirmed booking can review a unit'
        using errcode = '42501';
    end if;
  elsif new.target_type = 'student' then
    if new.target_id = new.reviewer_id then
      raise exception 'a student cannot review themselves'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.student_profiles as sp
      where sp.user_id = new.target_id
    ) then
      raise exception 'review target student does not exist'
        using errcode = '23503';
    end if;
  else
    raise exception 'unsupported review target type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.fill_contract_parties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_student_id uuid;
  booking_owner_id uuid;
begin
  if new.booking_id is not null then
    select b.student_id, u.owner_id
      into booking_student_id, booking_owner_id
    from public.bookings as b
    join public.units as u on u.id = b.unit_id
    where b.id = new.booking_id
      and b.deleted_at is null
      and u.deleted_at is null;

    if booking_student_id is null then
      raise exception 'contract booking does not exist'
        using errcode = '23503';
    end if;

    new.student_id := booking_student_id;
    new.owner_id := booking_owner_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage policies
-- ---------------------------------------------------------------------------
-- The bucket stays public, so this only tightens API reads. A deleted unit's
-- photos remain reachable through their direct public URL until a retention job
-- removes the objects; that cleanup is out of scope for this migration.
drop policy if exists "unit_photos_select_public" on storage.objects;
create policy "unit_photos_select_public"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'unit-photos'
  and exists (
    select 1
    from public.units as u
    where u.id::text = (storage.foldername(name))[1]
      and u.deleted_at is null
  )
);

drop policy if exists "unit_photos_insert_owner_or_team" on storage.objects;
create policy "unit_photos_insert_owner_or_team"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'unit-photos'
  and (
    exists (
      select 1
      from public.units as u
      where u.id::text = (storage.foldername(name))[1]
        and u.owner_id = (select auth.uid())
        and u.deleted_at is null
    )
    or exists (
      select 1
      from public.unit_visits as v
      where v.unit_id::text = (storage.foldername(name))[1]
        and v.team_member_id = (select auth.uid())
        and v.status in ('scheduled', 'completed')
        and v.deleted_at is null
    )
  )
);

drop policy if exists "unit_photos_update_owner" on storage.objects;
create policy "unit_photos_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'unit-photos'
  and exists (
    select 1
    from public.units as u
    where u.id::text = (storage.foldername(name))[1]
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
)
with check (
  bucket_id = 'unit-photos'
  and exists (
    select 1
    from public.units as u
    where u.id::text = (storage.foldername(name))[1]
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "unit_photos_delete_owner" on storage.objects;
create policy "unit_photos_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'unit-photos'
  and exists (
    select 1
    from public.units as u
    where u.id::text = (storage.foldername(name))[1]
      and u.owner_id = (select auth.uid())
      and u.deleted_at is null
  )
);

drop policy if exists "contracts_select_parties" on storage.objects;
create policy "contracts_select_parties"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'contracts'
  and exists (
    select 1
    from public.contracts as c
    where c.file_path = name
      and c.deleted_at is null
      and (
        c.student_id = (select auth.uid())
        or c.owner_id = (select auth.uid())
      )
  )
);
