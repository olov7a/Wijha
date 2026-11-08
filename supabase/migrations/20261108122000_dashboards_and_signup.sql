-- Phase C / 02: real dashboards and a complete signup.
--
-- 1. The auth trigger now creates the role-specific profile row (student or
--    owner) from the metadata collected on the signup form, so a new student
--    can book immediately and a new owner has a verification row to review.
-- 2. `owner_bookings` is a read model for the owner dashboard: an owner cannot
--    read `profiles`, so the RPC exposes only the data of bookings on their own
--    units (admins see everything).
-- 3. Admin can read the audit trail and upload/sign contract PDFs.
-- 4. `admin_set_user_role` lets an admin promote test accounts to team/leader
--    without direct SQL access.

-- ---------------------------------------------------------------------------
-- Signup trigger: profiles + role-specific rows
-- ---------------------------------------------------------------------------
create or replace function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.app_role;
  safe_phone text;
  safe_gender public.gender_type;
  safe_university text;
  safe_study_year integer;
  safe_smoker boolean := false;
  safe_hobbies text[] := '{}'::text[];
  raw_hobbies jsonb;
begin
  requested_role := new.raw_user_meta_data ->> 'role';

  if requested_role in ('student', 'owner') then
    safe_role := requested_role::public.app_role;
  else
    safe_role := 'student';
  end if;

  safe_phone := nullif(btrim(new.raw_user_meta_data ->> 'phone'), '');
  if safe_phone is not null and safe_phone !~ '^\+?[1-9][0-9]{7,14}$' then
    safe_phone := null;
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    safe_role,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100), ''),
    safe_phone
  );

  if safe_role = 'owner'::public.app_role then
    insert into public.owner_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
  end if;

  if safe_role <> 'student'::public.app_role then
    return new;
  end if;

  -- Gender is required by the table. If the form omitted it (or sent an
  -- invalid value) the row is created on the profile page instead; the signup
  -- form always sends it, so this only protects legacy callers.
  if (new.raw_user_meta_data ->> 'gender') in ('male', 'female') then
    safe_gender := (new.raw_user_meta_data ->> 'gender')::public.gender_type;
  end if;

  safe_university := nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'university', '')), 160), '');

  begin
    safe_study_year := (new.raw_user_meta_data ->> 'study_year')::integer;
  exception
    when others then
      safe_study_year := null;
  end;
  if safe_study_year is null or safe_study_year not between 1 and 12 then
    safe_study_year := null;
  end if;

  safe_smoker := coalesce((new.raw_user_meta_data ->> 'is_smoker')::boolean, false);

  raw_hobbies := new.raw_user_meta_data -> 'hobbies';
  if jsonb_typeof(raw_hobbies) = 'array' then
    select coalesce(array_agg(left(btrim(value), 40)), '{}'::text[])
      into safe_hobbies
    from jsonb_array_elements_text(raw_hobbies) as hobby(value)
    where btrim(value) <> '';
  end if;

  if safe_gender is not null then
    insert into public.student_profiles (
      user_id, gender, university, study_year, is_smoker, hobbies
    )
    values (
      new.id, safe_gender, safe_university, safe_study_year, safe_smoker,
      safe_hobbies[1:12]
    )
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner bookings read model
-- ---------------------------------------------------------------------------
create or replace function public.owner_bookings(p_limit integer default 100)
returns table (
  booking_id uuid,
  unit_id uuid,
  unit_title text,
  unit_area text,
  room_name text,
  bed_label text,
  student_name text,
  student_phone text,
  move_in_date date,
  move_out_date date,
  rent_piastres integer,
  total_piastres integer,
  status public.booking_status,
  payment_status public.payment_status,
  contract_id uuid,
  contract_status public.contract_status,
  created_at timestamp with time zone
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.unit_id,
    u.title,
    u.area,
    r.name,
    bd.label,
    p.full_name,
    p.phone,
    b.move_in_date,
    b.move_out_date,
    b.rent_amount_piastres,
    b.total_amount_piastres,
    b.status,
    pay.status,
    c.id,
    coalesce(c.status, 'not_requested'::public.contract_status),
    b.created_at
  from public.bookings as b
  join public.units as u on u.id = b.unit_id
  left join public.rooms as r on r.id = b.room_id
  left join public.beds as bd on bd.id = b.bed_id
  join public.profiles as p on p.id = b.student_id
  left join lateral (
    select pm.status
    from public.payments as pm
    where pm.booking_id = b.id
      and pm.deleted_at is null
    order by pm.created_at desc
    limit 1
  ) as pay on true
  left join public.contracts as c
    on c.booking_id = b.id
   and c.deleted_at is null
  where b.deleted_at is null
    and (
      (select private.has_role('admin'::public.app_role))
      or u.owner_id = (select auth.uid())
    )
  order by b.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

revoke all on function public.owner_bookings(integer)
from public, anon, authenticated;
grant execute on function public.owner_bookings(integer)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Admin audit trail
-- ---------------------------------------------------------------------------
grant select on table public.audit_logs to authenticated;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
on public.audit_logs
for select
to authenticated
using ((select private.has_role('admin'::public.app_role)));

-- ---------------------------------------------------------------------------
-- Contract uploads (admin reconciles and signs a PDF by hand for now)
-- ---------------------------------------------------------------------------
drop policy if exists "contracts_insert_admin" on storage.objects;
create policy "contracts_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'contracts'
  and (select private.has_role('admin'::public.app_role))
);

drop policy if exists "contracts_update_admin" on storage.objects;
create policy "contracts_update_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'contracts'
  and (select private.has_role('admin'::public.app_role))
)
with check (
  bucket_id = 'contracts'
  and (select private.has_role('admin'::public.app_role))
);

-- ---------------------------------------------------------------------------
-- Role management for test/operations accounts
-- ---------------------------------------------------------------------------
create function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_previous public.app_role;
begin
  if not (select private.has_role('admin'::public.app_role)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select p.role
    into v_previous
  from public.profiles as p
  where p.id = p_user_id;

  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_role not in (
    'student'::public.app_role,
    'owner'::public.app_role,
    'team'::public.app_role,
    'leader'::public.app_role,
    'admin'::public.app_role
  ) then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  -- Keep the owner verification row when someone is promoted to owner. A
  -- student profile cannot be guessed (gender is required), so the student
  -- completes it once on /student/profile and the booking RPC accepts it.
  if p_role = 'owner'::public.app_role then
    insert into public.owner_profiles (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    'profile.role_changed',
    'profile',
    p_user_id,
    jsonb_build_object('from', v_previous, 'to', p_role)
  );
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role)
from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid, public.app_role)
to authenticated, service_role;
