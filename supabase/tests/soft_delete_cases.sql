-- Wijha soft-delete regression suite.
--
-- Run inside one transaction; every inserted test row is rolled back.
-- Local: psql "$DATABASE_URL" -f supabase/tests/soft_delete_cases.sql
-- Supabase SQL editor: paste the whole file as the postgres role.
--
-- Proves:
--   * the nine business tables have deleted_at,
--   * soft delete hides rows from normal users but not from admins,
--   * parent deletion cascades to structural children in one transaction,
--   * active bookings block deletion,
--   * upcoming scheduled visits block unit deletion (HAS_UPCOMING_VISITS),
--   * unauthorised deletes return NOT_FOUND, even for already-deleted rows,
--   * direct hard DELETE is rejected,
--   * restore is admin-only,
--   * a conflicting restore returns RESTORE_CONFLICT,
--   * partial unique indexes ignore deleted rows,
--   * unit-photos paths start with the unit UUID.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema assertions
-- ---------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(t, ', ' order by t)
    into missing
  from unnest(array[
    'beds', 'bookings', 'contracts', 'payments', 'reviews',
    'rooms', 'unit_evaluations', 'unit_visits', 'units'
  ]) as t
  where not exists (
    select 1
    from information_schema.columns as c
    where c.table_schema = 'public'
      and c.table_name = t
      and c.column_name = 'deleted_at'
  );

  if missing is not null then
    raise exception 'missing deleted_at column on: %', missing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Seed
-- ---------------------------------------------------------------------------
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, created_at, updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'student-a@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Student A"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'student-b@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Student B"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'owner-a@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"owner","full_name":"Owner A"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'owner-b@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"owner","full_name":"Owner B"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'team-a@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Team A"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '77777777-7777-4777-8777-777777777777',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'leader@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Leader"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'admin@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Admin"}'::jsonb,
    '', '', '', '', '', '', '', '', now(), now()
  );

update public.profiles set role = 'owner'
where id in (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);
update public.profiles set role = 'team'
where id = '55555555-5555-4555-8555-555555555555';
update public.profiles set role = 'leader'
where id = '77777777-7777-4777-8777-777777777777';
update public.profiles set role = 'admin'
where id = '88888888-8888-4888-8888-888888888888';

insert into public.student_profiles (user_id, gender, university, study_year)
values
  ('11111111-1111-4111-8111-111111111111', 'male', 'Cairo University', 3),
  ('22222222-2222-4222-8222-222222222222', 'female', 'Ain Shams University', 2)
on conflict (user_id) do nothing;

insert into public.owner_profiles (user_id, id_document_path)
values
  (
    '33333333-3333-4333-8333-333333333333',
    '33333333-3333-4333-8333-333333333333/owner-id.jpg'
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '44444444-4444-4444-8444-444444444444/owner-id.jpg'
  )
on conflict (user_id) do nothing;

insert into public.units (id, owner_id, title, area, gender_type, status, description, amenities)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'Unit A', 'Nasr City', 'male', 'approved',
    'A clean unit', array['wifi', 'kitchen']
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444',
    'Unit B', 'Dokki', 'female', 'pending',
    'A pending unit', array['wifi']
  ),
  (
    -- Unit C has no bookings, only an upcoming visit, so it isolates the
    -- HAS_UPCOMING_VISITS rule from the ACTIVE_BOOKINGS rule.
    'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
    '33333333-3333-4333-8333-333333333333',
    'Unit C', 'Maadi', 'male', 'approved',
    'A unit with a scheduled inspection', array['wifi']
  );

insert into public.rooms (id, unit_id, name)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Room 1'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Room 1');

insert into public.beds (id, room_id, label, price_piastres)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Bed 1', 500000),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Bed 1', 400000);

insert into public.bookings (
  id, student_id, unit_id, room_id, bed_id, move_in_date,
  rent_amount_piastres, status
)
values (
  '99999999-9999-4999-8999-999999999999',
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  '2026-12-01', 500000, 'confirmed'
);

insert into public.payments (
  id, booking_id, amount_piastres, method, gateway_reference,
  gateway_event_id, status, paid_at
)
values (
  '12121212-1212-4212-8212-121212121212',
  '99999999-9999-4999-8999-999999999999',
  575000, 'card', 'soft-delete-ref-1', 'soft-delete-event-1', 'paid', now()
);

insert into public.contracts (id, booking_id, status, file_path)
values (
  '13131313-1313-4313-8313-131313131313',
  '99999999-9999-4999-8999-999999999999',
  'signed',
  '99999999-9999-4999-8999-999999999999/contract.pdf'
);

insert into public.unit_visits (id, unit_id, team_member_id, scheduled_at)
values
  (
    '14141414-1414-4414-8414-141414141414',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    now()
  ),
  (
    '17171717-1717-4717-8717-171717171717',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '55555555-5555-4555-8555-555555555555',
    now()
  ),
  (
    '19191919-1919-4919-8919-191919191919',
    'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
    '55555555-5555-4555-8555-555555555555',
    now() + interval '7 days'
  );

insert into public.unit_evaluations (
  id, unit_id, team_member_id, visit_id, score, photo_paths
)
values
  (
    '15151515-1515-4515-8515-151515151515',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    '14141414-1414-4414-8414-141414141414',
    90,
    array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/inspection-a.jpg']
  ),
  (
    '18181818-1818-4818-8818-181818181818',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '55555555-5555-4555-8555-555555555555',
    '17171717-1717-4717-8717-171717171717',
    80,
    array['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/inspection-b.jpg']
  );

insert into public.reviews (
  id, reviewer_id, target_type, target_id, rating, body, moderation_status
)
values (
  '16161616-1616-4616-8616-161616161616',
  '11111111-1111-4111-8111-111111111111',
  'unit', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  5, 'Excellent stay', 'approved'
);

-- Public unit-photos URLs are unguessable only while the path starts with the
-- unit UUID. This mirrors the {unit_id}/{filename} storage policy.
do $$
begin
  if exists (
    select 1
    from public.unit_evaluations as e
    cross join lateral unnest(e.photo_paths) as p(path)
    where p.path not like e.unit_id::text || '/%'
  ) then
    raise exception 'unit-photos path does not start with its unit UUID';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Owner B soft-deletes unit B; children cascade; admin restores.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

do $$
begin
  perform public.soft_delete_unit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
end $$;

do $$
begin
  -- Owner B sees the two approved public units (A and C) after deleting B.
  if (select count(*) from public.units) <> 2 then
    raise exception 'owner B still sees the deleted unit';
  end if;

  if exists (select 1 from public.rooms where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') then
    raise exception 'owner B still sees the deleted room';
  end if;

  if exists (select 1 from public.beds where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') then
    raise exception 'owner B still sees the deleted bed';
  end if;

  if exists (select 1 from public.unit_visits where id = '17171717-1717-4717-8717-171717171717') then
    raise exception 'owner B still sees the deleted visit';
  end if;

  if exists (select 1 from public.unit_evaluations where id = '18181818-1818-4818-8818-181818181818') then
    raise exception 'owner B still sees the deleted evaluation';
  end if;
end $$;

do $$
begin
  begin
    perform public.restore_unit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'a non-admin restored a unit';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

-- Owner A does not own unit B and must not learn that it is already deleted:
-- the "already deleted" no-op only runs after authorisation.
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_unit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    raise exception 'owner A deleted owner B already-deleted unit';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.units
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and deleted_at is not null
  ) then
    raise exception 'unit B was not soft-deleted';
  end if;

  if not exists (
    select 1 from public.rooms
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and deleted_at is not null
  ) then
    raise exception 'room B did not cascade';
  end if;

  if not exists (
    select 1 from public.beds
    where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      and deleted_at is not null
  ) then
    raise exception 'bed B did not cascade';
  end if;

  if not exists (
    select 1 from public.unit_visits
    where id = '17171717-1717-4717-8717-171717171717'
      and deleted_at is not null
  ) then
    raise exception 'visit B did not cascade';
  end if;

  if not exists (
    select 1 from public.unit_evaluations
    where id = '18181818-1818-4818-8818-181818181818'
      and deleted_at is not null
  ) then
    raise exception 'evaluation B did not cascade';
  end if;
end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if exists (select 1 from public.units where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') then
    raise exception 'anon sees a deleted unit';
  end if;

  if exists (select 1 from public.rooms where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd') then
    raise exception 'anon sees a deleted room';
  end if;

  if exists (select 1 from public.beds where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') then
    raise exception 'anon sees a deleted bed';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

do $$
begin
  if not exists (
    select 1 from public.units
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and deleted_at is not null
  ) then
    raise exception 'admin cannot see the deleted unit';
  end if;

  perform public.restore_unit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
end $$;

do $$
begin
  if exists (
    select 1 from public.units
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear the unit';
  end if;

  if exists (
    select 1 from public.rooms
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear room B';
  end if;

  if exists (
    select 1 from public.beds
    where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear bed B';
  end if;

  if exists (
    select 1 from public.unit_visits
    where id = '17171717-1717-4717-8717-171717171717'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear visit B';
  end if;

  if exists (
    select 1 from public.unit_evaluations
    where id = '18181818-1818-4818-8818-181818181818'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear evaluation B';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Active bookings block unit, room and bed deletion.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_unit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'unit with an active booking was deleted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    perform public.soft_delete_room('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    raise exception 'room with an active booking was deleted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    perform public.soft_delete_bed('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
    raise exception 'bed with an active booking was deleted';
  exception
    when foreign_key_violation then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_unit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    raise exception 'a student deleted someone else unit';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

-- Unit C has no active booking, only an upcoming scheduled visit. The visit
-- must block the deletion instead of being silently cascaded. Unit C belongs to
-- owner A, so switch back to the owner before testing the rule.
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_unit('c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3');
    raise exception 'unit with an upcoming visit was deleted';
  exception
    when raise_exception then
      if sqlerrm <> 'HAS_UPCOMING_VISITS' then
        raise;
      end if;
  end;
end $$;

reset role;
do $$
begin
  if exists (
    select 1 from public.units
    where id = 'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3'
      and deleted_at is not null
  ) then
    raise exception 'unit C was deleted despite the upcoming visit';
  end if;

  if not exists (
    select 1 from public.unit_visits
    where id = '19191919-1919-4919-8919-191919191919'
      and deleted_at is null
  ) then
    raise exception 'the upcoming visit was cascaded';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_unit_visit('14141414-1414-4414-8414-141414141414');
    raise exception 'a team member deleted a visit';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Leader soft-deletes a visit; its evaluation cascades; admin restores.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';

do $$
begin
  perform public.soft_delete_unit_visit('14141414-1414-4414-8414-141414141414');
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.unit_visits
    where id = '14141414-1414-4414-8414-141414141414'
      and deleted_at is not null
  ) then
    raise exception 'visit A was not soft-deleted';
  end if;

  if not exists (
    select 1 from public.unit_evaluations
    where id = '15151515-1515-4515-8515-151515151515'
      and deleted_at is not null
  ) then
    raise exception 'evaluation A did not cascade from visit A';
  end if;
end $$;

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  if exists (select 1 from public.unit_visits where id = '14141414-1414-4414-8414-141414141414') then
    raise exception 'owner A sees the deleted visit';
  end if;

  if exists (select 1 from public.unit_evaluations where id = '15151515-1515-4515-8515-151515151515') then
    raise exception 'owner A sees the deleted evaluation';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

do $$
begin
  perform public.restore_unit_visit('14141414-1414-4414-8414-141414141414');
end $$;

do $$
begin
  if exists (
    select 1 from public.unit_visits
    where id = '14141414-1414-4414-8414-141414141414'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear visit A';
  end if;

  if exists (
    select 1 from public.unit_evaluations
    where id = '15151515-1515-4515-8515-151515151515'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear evaluation A';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Room/bed deletion and partial unique indexes.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

do $$
declare
  v_room_id uuid;
  v_bed_id uuid;
begin
  perform public.soft_delete_room('dddddddd-dddd-4ddd-8ddd-dddddddddddd');

  -- Same name as the soft-deleted room must be accepted.
  insert into public.rooms (unit_id, name)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Room 1')
  returning id into v_room_id;

  insert into public.beds (room_id, label, price_piastres)
  values (v_room_id, 'Bed 1', 300000)
  returning id into v_bed_id;

  perform public.soft_delete_bed(v_bed_id);

  -- Same label in the same room must be accepted after the first bed is deleted.
  insert into public.beds (room_id, label, price_piastres)
  values (v_room_id, 'Bed 1', 300000);
end $$;

reset role;
do $$
begin
  if not exists (
    select 1 from public.rooms
    where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      and deleted_at is not null
  ) then
    raise exception 'room B was not soft-deleted';
  end if;

  if not exists (
    select 1 from public.beds
    where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
      and deleted_at is not null
  ) then
    raise exception 'bed B did not cascade with room B';
  end if;
end $$;

-- Owner A must get NOT_FOUND for owner B's already-deleted room, exactly as for
-- a room that never existed.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_room('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    raise exception 'owner A deleted owner B already-deleted room';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Review deletion, visibility, admin restore and partial uniqueness.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  perform public.soft_delete_review('16161616-1616-4616-8616-161616161616');
end $$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if exists (select 1 from public.reviews where id = '16161616-1616-4616-8616-161616161616') then
    raise exception 'anon sees a deleted review';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
begin
  begin
    perform public.soft_delete_review('16161616-1616-4616-8616-161616161616');
    raise exception 'a non-reviewer deleted someone else review';
  exception
    when no_data_found then
      if sqlerrm <> 'NOT_FOUND' then
        raise;
      end if;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

do $$
begin
  perform public.restore_review('16161616-1616-4616-8616-161616161616');
end $$;

do $$
begin
  if exists (
    select 1 from public.reviews
    where id = '16161616-1616-4616-8616-161616161616'
      and deleted_at is not null
  ) then
    raise exception 'admin restore did not clear the review';
  end if;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  perform public.soft_delete_review('16161616-1616-4616-8616-161616161616');

  -- Partial unique index must allow a new review for the same target.
  insert into public.reviews (reviewer_id, target_type, target_id, rating, body)
  values (
    '11111111-1111-4111-8111-111111111111',
    'unit',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    4,
    'Second review after soft delete'
  );
end $$;

-- Restoring the old review would now duplicate the active review, so the RPC
-- must return RESTORE_CONFLICT and leave the transaction usable.
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

do $$
begin
  begin
    perform public.restore_review('16161616-1616-4616-8616-161616161616');
    raise exception 'a conflicting restore was allowed';
  exception
    when unique_violation then
      if sqlerrm <> 'RESTORE_CONFLICT' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Hard DELETE is rejected for authenticated users.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  begin
    delete from public.units where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    raise exception 'hard delete on units was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.rooms where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    raise exception 'hard delete on rooms was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.beds where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    raise exception 'hard delete on beds was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.unit_visits where id = '14141414-1414-4414-8414-141414141414';
    raise exception 'hard delete on unit_visits was allowed';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;

rollback;
