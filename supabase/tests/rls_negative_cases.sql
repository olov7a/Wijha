-- WIJHA Phase B1 RLS negative-case suite.
--
-- Run inside one transaction; every inserted test row is rolled back.
-- Local: psql "$DATABASE_URL" -f supabase/tests/rls_negative_cases.sql
-- Supabase SQL editor: paste the whole file as the postgres role.
--
-- The suite proves:
--   * every public table has RLS enabled,
--   * anon/authenticated have no grants on settings or audit logs,
--   * students/owners/team cannot cross user boundaries,
--   * direct booking/payment writes are rejected,
--   * leaders may only change unit status,
--   * gender separation and financial snapshots are enforced by triggers.

begin;

-- ---------------------------------------------------------------------------
-- 1. Schema-level assertions
-- ---------------------------------------------------------------------------
do $$
declare
  missing_rls text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into missing_rls
  from pg_class as c
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception 'RLS is disabled on: %', missing_rls;
  end if;
end $$;

do $$
begin
  -- platform_settings stays server-only. audit_logs keeps a SELECT grant for
  -- authenticated so the admin dashboard can read it; RLS (audit_logs_select_admin)
  -- is what actually limits rows to admins. Any other grant is a finding.
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'platform_settings'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'sensitive tables expose table grants to anon/authenticated';
  end if;
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and grantee in ('anon', 'authenticated')
      and privilege_type <> 'SELECT'
  ) then
    raise exception 'sensitive tables expose table grants to anon/authenticated';
  end if;
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'audit_logs'
      and grantee = 'anon'
  ) then
    raise exception 'sensitive tables expose table grants to anon/authenticated';
  end if;
end $$;

do $$
declare
  policy_count integer;
begin
  select count(*)
    into policy_count
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects';

  if policy_count < 14 then
    raise exception 'expected at least 14 storage policies, found %', policy_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Seed data as the migration owner (postgres). RLS is bypassed, triggers
--    still run, so this also exercises the integrity triggers.
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
    '66666666-6666-4666-8666-666666666666',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'team-b@wijha.test', 'x', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"student","full_name":"Team B"}'::jsonb,
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

-- Signup can only create student/owner. Staff roles are assigned server-side.
update public.profiles set role = 'owner'
where id in (
  '33333333-3333-4333-8333-333333333333',
  '44444444-4444-4444-8444-444444444444'
);
update public.profiles set role = 'team'
where id in (
  '55555555-5555-4555-8555-555555555555',
  '66666666-6666-4666-8666-666666666666'
);
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
    'Unit A', 'Nasr City', 'male', 'approved', 'A clean unit', array['wifi', 'kitchen']
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444',
    'Unit B', 'Dokki', 'female', 'pending', 'A pending unit', array['wifi']
  );

insert into public.rooms (id, unit_id, name)
values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Room 1'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Room 1');

insert into public.beds (id, room_id, label, price_piastres)
values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Bed 1', 500000),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Bed 1', 400000);

-- Commission is filled by trigger from platform_settings (15%).
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
  575000, 'card', 'test-ref-1', 'test-event-1', 'paid', now()
);

insert into public.contracts (id, booking_id, status, file_path)
values (
  '13131313-1313-4313-8313-131313131313',
  '99999999-9999-4999-8999-999999999999',
  'signed',
  '99999999-9999-4999-8999-999999999999/contract.pdf'
);

insert into public.unit_visits (id, unit_id, team_member_id, scheduled_at)
values (
  '14141414-1414-4414-8414-141414141414',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  now()
);

insert into public.unit_evaluations (
  id, unit_id, team_member_id, visit_id, score, photo_paths
)
values (
  '15151515-1515-4515-8515-151515151515',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  '14141414-1414-4414-8414-141414141414',
  90,
  array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/inspection.jpg']
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

-- ---------------------------------------------------------------------------
-- 3. Student B: can only see their own profile; cannot write money rows.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.student_profiles) <> 1 then
    raise exception 'student B sees the wrong number of student profiles';
  end if;

  if exists (
    select 1 from public.student_profiles
    where user_id = '11111111-1111-4111-8111-111111111111'
  ) then
    raise exception 'student B can read student A profile';
  end if;

  if exists (select 1 from public.bookings) then
    raise exception 'student B can read another student booking';
  end if;

  if exists (select 1 from public.payments) then
    raise exception 'student B can read another student payment';
  end if;

  if exists (select 1 from public.contracts) then
    raise exception 'student B can read another student contract';
  end if;
end $$;

do $$
declare
  affected integer;
begin
  update public.student_profiles
  set university = 'Hacked'
  where user_id = '11111111-1111-4111-8111-111111111111';

  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'student B updated student A profile';
  end if;
end $$;

do $$
begin
  begin
    update public.student_profiles
    set verification_status = 'approved'
    where user_id = '22222222-2222-4222-8222-222222222222';

    raise exception 'student B self-approved verification';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.bookings (
      student_id, unit_id, room_id, bed_id, move_in_date, rent_amount_piastres
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '2026-12-15', 500000
    );

    raise exception 'student B inserted a booking directly';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update public.bookings
    set status = 'cancelled'
    where id = '99999999-9999-4999-8999-999999999999';

    raise exception 'student B updated a booking directly';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.reviews (reviewer_id, target_type, target_id, rating, body)
    values (
      '22222222-2222-4222-8222-222222222222',
      'unit',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      5,
      'fake review'
    );

    raise exception 'student B reviewed a unit without a booking';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Student A: owns the seeded booking, payment, contract and review.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.bookings) <> 1 then
    raise exception 'student A cannot read their booking';
  end if;

  if (select count(*) from public.payments) <> 1 then
    raise exception 'student A cannot read their payment';
  end if;

  if (select count(*) from public.contracts) <> 1 then
    raise exception 'student A cannot read their contract';
  end if;

  if (select count(*) from public.reviews) < 1 then
    raise exception 'student A cannot read their review';
  end if;
end $$;

do $$
begin
  begin
    insert into public.reviews (reviewer_id, target_type, target_id, rating, body)
    values (
      '11111111-1111-4111-8111-111111111111',
      'unit',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      4,
      'duplicate review'
    );

    raise exception 'duplicate review was accepted';
  exception
    when unique_violation then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.units (owner_id, title, area, gender_type)
    values (
      '11111111-1111-4111-8111-111111111111',
      'Fake Unit', 'Cairo', 'male'
    );

    raise exception 'student inserted a unit';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Owner A: sees own unit, bookings, evaluation; cannot change status.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.units) <> 1 then
    raise exception 'owner A sees the wrong number of units';
  end if;

  if (select count(*) from public.bookings) <> 1 then
    raise exception 'owner A cannot read a booking for their unit';
  end if;

  if (select count(*) from public.payments) <> 1 then
    raise exception 'owner A cannot read a payment for their unit';
  end if;

  if (select count(*) from public.contracts) <> 1 then
    raise exception 'owner A cannot read a contract for their unit';
  end if;

  if (select count(*) from public.unit_evaluations) <> 1 then
    raise exception 'owner A cannot read an evaluation for their unit';
  end if;

  if (select count(*) from public.unit_visits) <> 1 then
    raise exception 'owner A cannot read a visit for their unit';
  end if;

  if (select count(*) from public.reviews) <> 1 then
    raise exception 'owner A cannot read approved reviews for their unit';
  end if;
end $$;

do $$
declare
  affected integer;
begin
  update public.units
  set title = 'Unit A updated'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'owner A could not update their own unit title';
  end if;
end $$;

do $$
begin
  begin
    update public.units
    set status = 'rejected'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    raise exception 'owner A changed unit status';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    perform 1 from public.platform_settings;
    raise exception 'owner A read platform settings';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Owner B: cannot read Owner A's bookings, payments, contracts, evaluations.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

do $$
begin
  -- Owner B sees their own pending unit plus the approved public unit.
  if (select count(*) from public.units) <> 2 then
    raise exception 'owner B sees the wrong number of units';
  end if;

  if not exists (
    select 1 from public.units
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and status = 'pending'
  ) then
    raise exception 'owner B cannot read their own pending unit';
  end if;

  if exists (select 1 from public.bookings) then
    raise exception 'owner B can read another owner booking';
  end if;

  if exists (select 1 from public.payments) then
    raise exception 'owner B can read another owner payment';
  end if;

  if exists (select 1 from public.contracts) then
    raise exception 'owner B can read another owner contract';
  end if;

  if exists (select 1 from public.unit_evaluations) then
    raise exception 'owner B can read another owner evaluation';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Team A: own visit/evaluation only, and cannot reassign its visit.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.unit_visits) <> 1 then
    raise exception 'team A cannot read their assigned visit';
  end if;

  if (select count(*) from public.unit_evaluations) <> 1 then
    raise exception 'team A cannot read their evaluation';
  end if;

  if exists (select 1 from public.bookings) then
    raise exception 'team A can read bookings';
  end if;

  if exists (select 1 from public.payments) then
    raise exception 'team A can read payments';
  end if;

  if exists (select 1 from public.contracts) then
    raise exception 'team A can read contracts';
  end if;

  if exists (select 1 from public.student_profiles) then
    raise exception 'team A can read student ID documents';
  end if;

  if exists (select 1 from public.owner_profiles) then
    raise exception 'team A can read owner ID documents';
  end if;
end $$;

do $$
declare
  affected integer;
begin
  update public.unit_visits
  set notes = 'Checked'
  where id = '14141414-1414-4414-8414-141414141414';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'team A could not update their own visit notes';
  end if;
end $$;

do $$
begin
  begin
    update public.unit_visits
    set scheduled_at = now() + interval '1 day'
    where id = '14141414-1414-4414-8414-141414141414';

    raise exception 'team A reassigned its own visit';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Team B: cannot read or write Team A's visit/evaluation.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';

do $$
begin
  if exists (select 1 from public.unit_visits) then
    raise exception 'team B can read team A visit';
  end if;

  if exists (select 1 from public.unit_evaluations) then
    raise exception 'team B can read team A evaluation';
  end if;
end $$;

do $$
begin
  begin
    insert into public.unit_evaluations (
      unit_id, team_member_id, visit_id, score, photo_paths
    ) values (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '66666666-6666-4666-8666-666666666666',
      '14141414-1414-4414-8414-141414141414',
      50,
      array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/fake.jpg']
    );

    raise exception 'team B evaluated a visit assigned to team A';
  exception
    -- BEFORE trigger (validate_unit_evaluation) fires before the RLS WITH
    -- CHECK, so the mismatch surfaces as 23514 instead of 42501.
    when insufficient_privilege then null;
    when check_violation then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Anon: approved units/rooms/beds/reviews only; no settings/audit/bookings.
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if (select count(*) from public.units) <> 1 then
    raise exception 'anon can see non-approved units';
  end if;

  if (select count(*) from public.rooms) <> 1 then
    raise exception 'anon can see rooms of a non-approved unit';
  end if;

  if (select count(*) from public.beds) <> 1 then
    raise exception 'anon can see beds of a non-approved unit';
  end if;

  if (select count(*) from public.reviews) <> 1 then
    raise exception 'anon cannot see approved unit reviews';
  end if;
end $$;

do $$
begin
  begin
    perform 1 from public.bookings;
    raise exception 'anon read bookings';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.platform_settings;
    raise exception 'anon read platform settings';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.audit_logs;
    raise exception 'anon read audit logs';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Leader: may change status only; admin may edit listing text.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';

do $$
begin
  if (select count(*) from public.units) <> 2 then
    raise exception 'leader cannot see all units';
  end if;

  if (select count(*) from public.bookings) <> 1 then
    raise exception 'leader cannot see bookings';
  end if;
end $$;

do $$
declare
  affected integer;
begin
  update public.units
  set status = 'approved'
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'leader could not approve a pending unit';
  end if;
end $$;

do $$
begin
  begin
    update public.units
    set title = 'Leader edit'
    where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    raise exception 'leader edited a unit title';
  exception
    when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role authenticated;
set local request.jwt.claims =
  '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

do $$
declare
  affected integer;
begin
  update public.units
  set title = 'Admin edit'
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'admin could not edit a unit';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11. Database integrity: gender separation, immutable money, commission.
-- ---------------------------------------------------------------------------
reset role;

insert into public.audit_logs (actor_id, action, entity_type, entity_id)
values (
  '88888888-8888-4888-8888-888888888888',
  'test.action', 'booking', '99999999-9999-4999-8999-999999999999'
);

do $$
begin
  begin
    insert into public.bookings (
      student_id, unit_id, room_id, bed_id, move_in_date,
      rent_amount_piastres, status
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '2026-12-20', 500000, 'pending_payment'
    );

    raise exception 'gender mismatch booking was accepted';
  exception
    when check_violation then null;
  end;
end $$;

do $$
begin
  begin
    update public.bookings
    set rent_amount_piastres = 1
    where id = '99999999-9999-4999-8999-999999999999';

    raise exception 'booking financial snapshot was mutable';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  snapshot_rate numeric(5, 4);
  snapshot_amount integer;
  expected_amount integer;
begin
  select commission_rate_snapshot, commission_amount_piastres
    into snapshot_rate, snapshot_amount
  from public.bookings
  where id = '99999999-9999-4999-8999-999999999999';

  expected_amount := round(500000 * 0.1500)::integer;

  if snapshot_rate <> 0.1500 then
    raise exception 'commission rate snapshot is not 15 percent';
  end if;

  if snapshot_amount <> expected_amount then
    raise exception 'commission amount does not match the 15 percent snapshot';
  end if;
end $$;

do $$
begin
  begin
    update public.units
    set gender_type = 'female'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    raise exception 'unit gender changed while an active booking exists';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.student_profiles
    set gender = 'female'
    where user_id = '11111111-1111-4111-8111-111111111111';

    raise exception 'student gender changed while an active booking exists';
  exception
    when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    update public.audit_logs
    set action = 'tampered'
    where action = 'test.action';

    raise exception 'audit log update was allowed';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.audit_logs
    where action = 'test.action';

    raise exception 'audit log delete was allowed';
  exception
    when insufficient_privilege then null;
  end;
end $$;

set local role service_role;

do $$
declare
  configured_rate numeric(5, 4);
begin
  select commission_rate
    into configured_rate
  from public.platform_settings
  where id = true;

  if configured_rate <> 0.1500 then
    raise exception 'service role cannot read the configured commission';
  end if;
end $$;

reset role;

rollback;
