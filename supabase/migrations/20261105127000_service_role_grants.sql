-- Phase B1 / 08: explicit service-role grants.
-- service_role bypasses RLS by design and is used only by server code. Supabase
-- usually grants these by default, but making them explicit keeps a fresh
-- environment working even if the platform defaults change.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
