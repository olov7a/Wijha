-- Phase B1 / 06: reviews, contracts, audit log.
-- Reviews are moderated server-side. Contract mutations are server-only.
-- The audit log is append-only and service-role only.

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.review_target_type not null,
  target_id uuid not null,
  rating smallint not null
    check (rating between 1 and 5),
  body text
    check (body is null or char_length(body) between 1 and 2000),
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reviews_one_per_target unique (reviewer_id, target_type, target_id)
);

alter table public.reviews enable row level security;

revoke all on table public.reviews from anon, authenticated;
grant select on table public.reviews to anon, authenticated;
grant insert (
  reviewer_id, target_type, target_id, rating, body
) on table public.reviews to authenticated;

create policy "reviews_select_public_approved"
on public.reviews
for select
to anon, authenticated
using (
  target_type = 'unit'
  and moderation_status = 'approved'
);

create policy "reviews_select_own"
on public.reviews
for select
to authenticated
using ((select auth.uid()) = reviewer_id);

create policy "reviews_select_owner"
on public.reviews
for select
to authenticated
using (
  target_type = 'unit'
  and moderation_status = 'approved'
  and exists (
    select 1
    from public.units as u
    where u.id = reviews.target_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "reviews_select_staff"
on public.reviews
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "reviews_insert_own"
on public.reviews
for insert
to authenticated
with check (
  (select auth.uid()) = reviewer_id
  and moderation_status = 'pending'
);

create index reviews_target_idx on public.reviews (target_type, target_id);
create index reviews_reviewer_id_idx on public.reviews (reviewer_id);
create index reviews_moderation_status_idx
on public.reviews (moderation_status)
where moderation_status = 'pending';

create function private.validate_review_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_type = 'unit' then
    if not exists (
      select 1
      from public.units as u
      where u.id = new.target_id
    ) then
      raise exception 'review target unit does not exist'
        using errcode = '23503';
    end if;

    if not exists (
      select 1
      from public.bookings as b
      where b.student_id = new.reviewer_id
        and b.unit_id = new.target_id
        and b.status in ('confirmed', 'completed')
    ) then
      raise exception 'only students with a confirmed booking can review a unit'
        using errcode = '42501';
    end if;
  elsif new.target_type = 'student' then
    if new.target_id = new.reviewer_id then
      raise exception 'a student cannot review themselves'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.student_profiles as sp
      where sp.user_id = new.target_id
    ) then
      raise exception 'review target student does not exist'
        using errcode = '23503';
    end if;

    -- Who may rate whom is still an open product decision (CLAUDE.md). For now
    -- we only guarantee that the target is a real student and not the author.
  else
    raise exception 'unsupported review target type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_review_target()
from public, anon, authenticated;

create trigger reviews_validate_target
before insert on public.reviews
for each row
execute function private.validate_review_target();

create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  status public.contract_status not null default 'not_requested',
  file_path text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint contracts_file_path_valid check (
    file_path is null
    or (
      char_length(file_path) between 3 and 1024
      and position('..' in file_path) = 0
      and (
        (booking_id is not null and file_path like booking_id::text || '/%')
        or (
          booking_id is null
          and file_path like 'external/' || student_id::text || '/%'
        )
      )
    )
  )
);

alter table public.contracts enable row level security;

revoke all on table public.contracts from anon, authenticated;
grant select on table public.contracts to authenticated;

create policy "contracts_select_student_own"
on public.contracts
for select
to authenticated
using ((select auth.uid()) = student_id);

create policy "contracts_select_owner_own"
on public.contracts
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "contracts_select_staff"
on public.contracts
for select
to authenticated
using ((select private.is_leader_or_admin()));

create index contracts_booking_id_idx on public.contracts (booking_id);
create index contracts_student_id_idx on public.contracts (student_id);
create index contracts_owner_id_idx on public.contracts (owner_id);
create index contracts_status_idx on public.contracts (status);

-- One booking has at most one tracked contract. External contracts have no
-- booking and stay outside this restriction.
create unique index contracts_one_per_booking
on public.contracts (booking_id)
where booking_id is not null;

-- Fills the parties from the booking so a booking-linked contract can never
-- point at an unrelated student or owner.
create function private.fill_contract_parties()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_student_id uuid;
  booking_owner_id uuid;
begin
  if new.booking_id is not null then
    select b.student_id, u.owner_id
      into booking_student_id, booking_owner_id
    from public.bookings as b
    join public.units as u on u.id = b.unit_id
    where b.id = new.booking_id;

    if booking_student_id is null then
      raise exception 'contract booking does not exist'
        using errcode = '23503';
    end if;

    new.student_id := booking_student_id;
    new.owner_id := booking_owner_id;
  end if;

  return new;
end;
$$;

revoke all on function private.fill_contract_parties()
from public, anon, authenticated;

create trigger contracts_fill_parties
before insert or update of booking_id on public.contracts
for each row
execute function private.fill_contract_parties();

create function private.protect_contract_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'not_requested' and new.status = 'requested')
      or (old.status = 'requested' and new.status in ('not_requested', 'signed'))
    ) then
      raise exception 'invalid contract status transition'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_contract_status()
from public, anon, authenticated;

create trigger contracts_protect_status
before update on public.contracts
for each row
execute function private.protect_contract_status();

create trigger contracts_set_updated_at
before update on public.contracts
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log (append-only, server-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null
    check (char_length(action) between 3 and 80),
  entity_type text not null
    check (entity_type ~ '^[a-z_]{3,40}$'),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamp with time zone not null default now()
);

alter table public.audit_logs enable row level security;

revoke all on table public.audit_logs from anon, authenticated;

create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function private.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only'
    using errcode = '42501';
end;
$$;

revoke all on function private.prevent_audit_log_mutation()
from public, anon, authenticated;

create trigger audit_logs_prevent_update
before update on public.audit_logs
for each row
execute function private.prevent_audit_log_mutation();

create trigger audit_logs_prevent_delete
before delete on public.audit_logs
for each row
execute function private.prevent_audit_log_mutation();
