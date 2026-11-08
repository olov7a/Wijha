- --cleanup_e2e
-- Run in the DEV project only. Removes rows created with the e2e- prefix.
-- Do NOT delete any users' own data.

begin;

delete from public.payment_events
where booking_id in (select id from public.bookings where student_id in (select id from auth.users where email like 'e2e-%.example.com' or email like '%-e2e@example.com'));

delete from public.payments
where booking_id in (select id from public.bookings where student_id in (select id from auth.users where email like '%-e2e@example.com' or email like 'e2e-%.example.com'));

delete from public.contracts
where booking_id in (select id from public.bookings where student_id in (select id from auth.users where email like '%-e2e@example.com'));

delete from public.bookings
where student_id in (select id from auth.users where email like '%-e2e@example.com');

delete from public.unit_visits where unit_id in (select id from public.units where title like 'e2e-%');
delete from public.unit_evaluations where unit_id in (select id from public.units where title like 'e2e-%');
delete from public.reviews where target_id in (select id from public.units where title like 'e2e-%');
delete from public.beds where room_id in (select id from public.rooms where unit_id in (select id from public.units where title like 'e2e-%'));
delete from public.rooms where unit_id in (select id from public.units where title like 'e2e-%');
delete from public.units where title like 'e2e-%';

delete from public.audit_logs where actor_id in (select id from auth.users where email like '%-e2e@example.com');

-- Keep the users themselves; only remove their data. Add user removal here if wanted.
commit;
