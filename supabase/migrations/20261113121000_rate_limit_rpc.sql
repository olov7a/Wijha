-- Rate limiting fix.
--
-- `isRateLimited` used to count rows in `public.audit_logs` with the caller's
-- own client. That table is append-only and server-only: `authenticated` has
-- no SELECT policy for non-admin rows, so every student/owner count returned
-- zero and only admins were actually limited.
--
-- This SECURITY DEFINER function exposes the count of the *caller's own* recent
-- actions and nothing else, so RLS on audit_logs can stay closed.

create index if not exists audit_logs_actor_action_created_idx
  on public.audit_logs (actor_id, action, created_at desc);

create or replace function public.count_my_recent_actions(
  p_action text,
  p_window_seconds integer default 3600
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(count(*), 0)::integer
  from public.audit_logs as a
  where a.actor_id = (select auth.uid())
    and a.action = p_action
    and a.created_at >= now() - make_interval(
      secs => greatest(1, least(coalesce(p_window_seconds, 3600), 86400))
    );
$$;

revoke all on function public.count_my_recent_actions(text, integer)
from public, anon;
grant execute on function public.count_my_recent_actions(text, integer)
to authenticated, service_role;
