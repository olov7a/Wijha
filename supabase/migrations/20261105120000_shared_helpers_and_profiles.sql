-- Phase B1 / 01: shared enums, helpers, and profile hardening.
-- RLS stays enabled on every table from the migration that creates it.

create type public.gender_type as enum ('male', 'female');
create type public.unit_status as enum ('pending', 'approved', 'rejected');
create type public.bed_status as enum ('available', 'held', 'booked');
create type public.booking_status as enum ('pending_payment', 'confirmed', 'cancelled', 'completed');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.review_target_type as enum ('unit', 'student');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.contract_status as enum ('not_requested', 'requested', 'signed');
create type public.visit_status as enum ('scheduled', 'completed', 'cancelled');

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

-- Reads the caller's role from the database. SECURITY DEFINER prevents RLS
-- recursion when the function is used inside policies on public.profiles.
create function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.role = required_role
  );
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.has_role('team'::public.app_role))
    or (select private.has_role('leader'::public.app_role))
    or (select private.has_role('admin'::public.app_role));
$$;

create function private.is_leader_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.has_role('leader'::public.app_role))
    or (select private.has_role('admin'::public.app_role));
$$;

revoke all on function private.has_role(public.app_role) from public, anon;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_leader_or_admin() from public, anon;
grant execute on function private.has_role(public.app_role) to authenticated, service_role;
grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.is_leader_or_admin() to authenticated, service_role;

-- RLS policies live in `public` but call helpers that live in `private`. The
-- caller therefore needs USAGE on the schema in addition to EXECUTE on the
-- function. `anon` never calls a private helper, so it stays locked out.
grant usage on schema private to authenticated, service_role;

alter table public.profiles
  add column phone text,
  add column updated_at timestamp with time zone not null default now();

-- Normalise any pre-existing display name so the stricter constraint below can
-- be applied without failing on old test data.
update public.profiles
set full_name = case
  when full_name is null then null
  when char_length(btrim(full_name)) between 2 and 100
    then left(btrim(full_name), 100)
  else null
end
where full_name is not null;

alter table public.profiles
  add constraint profiles_phone_valid
    check (phone is null or phone ~ '^\+?[1-9][0-9]{7,14}$'),
  add constraint profiles_full_name_trimmed
    check (full_name is null or char_length(btrim(full_name)) between 2 and 100);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();

-- Column-level grants stop a user from promoting their own role. Role changes
-- happen only through a protected admin action using the server-only admin client.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone) on table public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_select_staff"
on public.profiles
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

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

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;
