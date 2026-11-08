-- Staging roles: run this in the DEV Supabase SQL editor AFTER creating the
-- auth users in the dashboard. It maps emails to roles by email, never by
-- hand-copied UUIDs, so the test accounts stay created in the UI.
--
-- Replace the placeholder emails with the ones you created.

update public.profiles
set role = 'student'
where id in (select id from auth.users where email = 'student-e2e@example.com');

update public.profiles
set role = 'owner'
where id in (select id from auth.users where email = 'owner-e2e@example.com');

update public.profiles
set role = 'admin'
where id in (select id from auth.users where email = 'admin-e2e@example.com');
