-- Phase B1 / 03: units, rooms, beds.
-- Owners manage their own inventory. Only leaders/admins may change unit status.
-- Bed status is booking state, so owners cannot write it; server code owns it.

create table public.units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  title text not null
    check (char_length(btrim(title)) between 3 and 120),
  area text not null
    check (char_length(btrim(area)) between 2 and 120),
  gender_type public.gender_type not null,
  status public.unit_status not null default 'pending',
  description text
    check (description is null or char_length(description) <= 3000),
  amenities text[] not null default '{}'::text[]
    check (cardinality(amenities) <= 30),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.units enable row level security;

revoke all on table public.units from anon, authenticated;
grant select on table public.units to anon, authenticated;
grant insert (
  owner_id, title, area, gender_type, description, amenities
) on table public.units to authenticated;
grant update (
  title, area, gender_type, description, amenities
) on table public.units to authenticated;
grant update (status) on table public.units to authenticated;

create policy "units_select_public"
on public.units
for select
to anon, authenticated
using (status = 'approved');

create policy "units_select_owner"
on public.units
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "units_select_staff"
on public.units
for select
to authenticated
using ((select private.is_staff()));

create policy "units_insert_owner"
on public.units
for insert
to authenticated
with check (
  (select auth.uid()) = owner_id
  and (select private.has_role('owner'::public.app_role))
  and status = 'pending'
);

create policy "units_update_owner"
on public.units
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "units_update_leader_status"
on public.units
for update
to authenticated
using ((select private.is_leader_or_admin()))
with check ((select private.is_leader_or_admin()));

create index units_owner_id_idx on public.units (owner_id);
create index units_status_idx on public.units (status);
create index units_gender_status_idx on public.units (gender_type, status);

-- Owner grants include update(status) only because PostgreSQL privileges are
-- shared by the whole `authenticated` role. This trigger is the real guard.
create function private.protect_unit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and not (select private.is_leader_or_admin()) then
    raise exception 'only a leader or admin can change unit status'
      using errcode = '42501';
  end if;

  -- A leader's update policy exists only to approve/reject a unit. Without this
  -- guard the shared `authenticated` column grants would let a leader edit the
  -- owner's listing text too.
  if (select private.has_role('leader'::public.app_role))
     and not (select private.has_role('admin'::public.app_role))
     and (select auth.uid()) is distinct from old.owner_id
     and (
       new.owner_id is distinct from old.owner_id
       or new.title is distinct from old.title
       or new.area is distinct from old.area
       or new.gender_type is distinct from old.gender_type
       or new.description is distinct from old.description
       or new.amenities is distinct from old.amenities
     )
  then
    raise exception 'leaders may only change unit status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_unit_status()
from public, anon, authenticated;

create trigger units_protect_status
before update on public.units
for each row
execute function private.protect_unit_status();

create trigger units_set_updated_at
before update on public.units
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  name text not null
    check (char_length(btrim(name)) between 1 and 60),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint rooms_unit_name_unique unique (unit_id, name),
  constraint rooms_id_unit_unique unique (id, unit_id)
);

alter table public.rooms enable row level security;

revoke all on table public.rooms from anon, authenticated;
grant select on table public.rooms to anon, authenticated;
grant insert (unit_id, name) on table public.rooms to authenticated;
grant update (name) on table public.rooms to authenticated;
grant delete on table public.rooms to authenticated;

create policy "rooms_select_public"
on public.rooms
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.status = 'approved'
  )
);

create policy "rooms_select_owner"
on public.rooms
for select
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "rooms_select_staff"
on public.rooms
for select
to authenticated
using ((select private.is_staff()));

create policy "rooms_insert_owner"
on public.rooms
for insert
to authenticated
with check (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "rooms_update_owner"
on public.rooms
for update
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "rooms_delete_owner"
on public.rooms
for delete
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = rooms.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create index rooms_unit_id_idx on public.rooms (unit_id);

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Beds
-- ---------------------------------------------------------------------------
create table public.beds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  label text not null
    check (char_length(btrim(label)) between 1 and 40),
  price_piastres integer not null
    check (price_piastres > 0 and price_piastres <= 100000000),
  status public.bed_status not null default 'available',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint beds_room_label_unique unique (room_id, label),
  constraint beds_id_room_unique unique (id, room_id)
);

alter table public.beds enable row level security;

revoke all on table public.beds from anon, authenticated;
grant select on table public.beds to anon, authenticated;
grant insert (room_id, label, price_piastres) on table public.beds to authenticated;
grant update (label, price_piastres) on table public.beds to authenticated;
grant delete on table public.beds to authenticated;

create policy "beds_select_public"
on public.beds
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.status = 'approved'
  )
);

create policy "beds_select_owner"
on public.beds
for select
to authenticated
using (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "beds_select_staff"
on public.beds
for select
to authenticated
using ((select private.is_staff()));

create policy "beds_insert_owner"
on public.beds
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "beds_update_owner"
on public.beds
for update
to authenticated
using (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "beds_delete_owner"
on public.beds
for delete
to authenticated
using (
  exists (
    select 1
    from public.rooms as r
    join public.units as u on u.id = r.unit_id
    where r.id = beds.room_id
      and u.owner_id = (select auth.uid())
  )
);

create index beds_room_id_idx on public.beds (room_id);
create index beds_status_idx on public.beds (status);
create index beds_status_available_idx on public.beds (room_id)
where status = 'available';

create trigger beds_set_updated_at
before update on public.beds
for each row
execute function private.set_updated_at();
