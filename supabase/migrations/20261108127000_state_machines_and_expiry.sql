-- Phase C / 08: expiry job + booking/visit state machines.
--
-- Fixes vs audit C5/A8/A11/D10:
-- 1. `expire_pending_payments()` sets long-pending payments to `expired`
--    (and cancels the linked booking) in one call. It is meant to be called
--    from a cron route with the service role; see
--    `app/api/cron/expire-payments/route.ts` (protected by CRON_SECRET).
-- 2. Bookings get an enforced state machine trigger (pending_payment can
--    only go to confirmed/cancelled; confirmed only to completed/cancelled).
-- 3. Unit visits get an enforced state machine trigger (scheduled only to
--    completed/cancelled; completed/cancelled are terminal except for
--    leader/admin reassignments already guarded by protect_visit_assignment).

create function public.expire_pending_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.payments
  set status = 'expired',
      failure_reason = 'payment window expired'
  where status = 'pending'
    and expires_at is not null
    and expires_at < now()
    and deleted_at is null;

  get diagnostics v_count = row_count;

  update public.bookings
  set status = 'cancelled',
      cancellation_reason = 'payment window expired'
  where status = 'pending_payment'
    and deleted_at is null
    and id in (
      select p.booking_id
      from public.payments as p
      where p.status = 'expired'
    );

  return v_count;
end;
$$;

revoke all on function public.expire_pending_payments()
from public, anon, authenticated;
grant execute on function public.expire_pending_payments()
to service_role;

-- ---------------------------------------------------------------------------
-- Booking status state machine
-- ---------------------------------------------------------------------------
create function private.protect_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending_payment' and new.status in ('confirmed', 'cancelled'))
      or (old.status = 'confirmed' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'invalid booking status transition'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_booking_status()
from public, anon, authenticated;

drop trigger if exists bookings_protect_status on public.bookings;
create trigger bookings_protect_status
before update of status on public.bookings
for each row
execute function private.protect_booking_status();

-- ---------------------------------------------------------------------------
-- Visit status state machine
-- ---------------------------------------------------------------------------
create function private.protect_visit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'scheduled' and new.status in ('completed', 'cancelled'))
      or (old.status in ('completed', 'cancelled') and (select private.has_role('leader'::public.app_role) or (select private.has_role('admin'::public.app_role))))
    ) then
      raise exception 'invalid visit status transition'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_visit_status()
from public, anon, authenticated;

drop trigger if exists unit_visits_protect_status on public.unit_visits;
create trigger unit_visits_protect_status
before update of status on public.unit_visits
for each row
execute function private.protect_visit_status();
