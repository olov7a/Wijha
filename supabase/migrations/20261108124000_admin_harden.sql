-- Phase C / 05: harden first-admin bootstrap.
--
-- Previously `claim_first_admin()` was executable by any authenticated user,
-- so anyone could call it directly from the browser console while zero
-- admins existed. The claim now lives in a server action that checks the
-- BOOTSTRAP_ADMIN_SECRET env var (never exposed to clients) and writes with
-- the service-role client. This migration removes the browser path entirely:
-- only service_role may execute the function now.

revoke execute on function public.claim_first_admin()
from public, anon, authenticated;

grant execute on function public.claim_first_admin()
to service_role;
