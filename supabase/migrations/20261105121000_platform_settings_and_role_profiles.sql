-- Phase B1 / 02: platform configuration, student profiles, owner profiles.
-- Every table has RLS enabled in this same migration.

-- ---------------------------------------------------------------------------
-- Platform settings (single row). Read/written only by server-side code using
-- the service-role client, so no anon/authenticated grants are issued.
-- ---------------------------------------------------------------------------
create table public.platform_settings (
  id boolean primary key default true,
  commission_rate numeric(5, 4) not null default 0.1500
    check (commission_rate between 0 and 1),
  currency text not null default 'EGP'
    check (currency ~ '^[A-Z]{3}$'),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint platform_settings_singleton check (id)
);

-- 15% is the approved starting value. A later admin action may change it; past
-- bookings keep their own snapshot, so changing this row never rewrites history.
insert into public.platform_settings (id, commission_rate, currency)
values (true, 0.1500, 'EGP')
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

revoke all on table public.platform_settings from anon, authenticated;

create trigger platform_settings_set_updated_at
before update on public.platform_settings
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Student profiles
-- ---------------------------------------------------------------------------
create table public.student_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  gender public.gender_type not null,
  university text
    check (university is null or char_length(btrim(university)) between 2 and 150),
  study_year smallint
    check (study_year is null or study_year between 1 and 7),
  is_smoker boolean not null default false,
  hobbies text[] not null default '{}'::text[]
    check (cardinality(hobbies) <= 20),
  id_document_path text,
  university_card_path text,
  verification_status public.moderation_status not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint student_profiles_id_document_path_valid check (
    id_document_path is null
    or (
      id_document_path like user_id::text || '/%'
      and char_length(id_document_path) between 38 and 1024
      and position('..' in id_document_path) = 0
    )
  ),
  constraint student_profiles_university_card_path_valid check (
    university_card_path is null
    or (
      university_card_path like user_id::text || '/%'
      and char_length(university_card_path) between 38 and 1024
      and position('..' in university_card_path) = 0
    )
  )
);

alter table public.student_profiles enable row level security;

revoke all on table public.student_profiles from anon, authenticated;
grant select on table public.student_profiles to authenticated;
grant insert (
  user_id, gender, university, study_year, is_smoker, hobbies,
  id_document_path, university_card_path
) on table public.student_profiles to authenticated;
grant update (
  gender, university, study_year, is_smoker, hobbies,
  id_document_path, university_card_path
) on table public.student_profiles to authenticated;

create policy "student_profiles_select_own"
on public.student_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "student_profiles_select_staff"
on public.student_profiles
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "student_profiles_insert_own"
on public.student_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "student_profiles_update_own"
on public.student_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index student_profiles_verification_status_idx
on public.student_profiles (verification_status)
where verification_status = 'pending';

create index student_profiles_gender_idx
on public.student_profiles (gender);

-- ---------------------------------------------------------------------------
-- Owner profiles
-- ---------------------------------------------------------------------------
create table public.owner_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  id_document_path text,
  ownership_proof_path text,
  verification_status public.moderation_status not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint owner_profiles_id_document_path_valid check (
    id_document_path is null
    or (
      id_document_path like user_id::text || '/%'
      and char_length(id_document_path) between 38 and 1024
      and position('..' in id_document_path) = 0
    )
  ),
  constraint owner_profiles_ownership_proof_path_valid check (
    ownership_proof_path is null
    or (
      ownership_proof_path like user_id::text || '/%'
      and char_length(ownership_proof_path) between 38 and 1024
      and position('..' in ownership_proof_path) = 0
    )
  )
);

alter table public.owner_profiles enable row level security;

revoke all on table public.owner_profiles from anon, authenticated;
grant select on table public.owner_profiles to authenticated;
grant insert (
  user_id, id_document_path, ownership_proof_path
) on table public.owner_profiles to authenticated;
grant update (
  id_document_path, ownership_proof_path
) on table public.owner_profiles to authenticated;

create policy "owner_profiles_select_own"
on public.owner_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "owner_profiles_select_staff"
on public.owner_profiles
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "owner_profiles_insert_own"
on public.owner_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "owner_profiles_update_own"
on public.owner_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index owner_profiles_verification_status_idx
on public.owner_profiles (verification_status)
where verification_status = 'pending';

-- ---------------------------------------------------------------------------
-- A student profile can only belong to a student, and an owner profile only to
-- an owner. This blocks a user from creating the wrong profile type even if the
-- client sends forged data.
-- ---------------------------------------------------------------------------
create function private.enforce_profile_subtype_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_role public.app_role;
  actual_role public.app_role;
begin
  expected_role := case tg_table_name
    when 'student_profiles' then 'student'::public.app_role
    when 'owner_profiles' then 'owner'::public.app_role
  end;

  select p.role
    into actual_role
  from public.profiles as p
  where p.id = new.user_id;

  if actual_role is null then
    raise exception 'profile row is missing' using errcode = '23503';
  end if;

  if actual_role <> expected_role then
    raise exception 'profile role does not match this profile type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_profile_subtype_role()
from public, anon, authenticated;

create trigger student_profiles_enforce_role
before insert or update of user_id on public.student_profiles
for each row
execute function private.enforce_profile_subtype_role();

create trigger owner_profiles_enforce_role
before insert or update of user_id on public.owner_profiles
for each row
execute function private.enforce_profile_subtype_role();

create trigger student_profiles_set_updated_at
before update on public.student_profiles
for each row
execute function private.set_updated_at();

create trigger owner_profiles_set_updated_at
before update on public.owner_profiles
for each row
execute function private.set_updated_at();
