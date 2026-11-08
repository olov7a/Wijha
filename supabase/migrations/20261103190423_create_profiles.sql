create type public.app_role as enum ('student', 'owner', 'team', 'leader', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text check (char_length(full_name) <= 100),
  created_at timestamp with time zone not null default now()
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.app_role;
begin
  requested_role := new.raw_user_meta_data ->> 'role';

  if requested_role in ('student', 'owner') then
    safe_role := requested_role::public.app_role;
  else
    safe_role := 'student';
  end if;

  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    safe_role,
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 100), '')
  );

  return new;
end;
$$;

revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function private.create_profile_for_new_user();
