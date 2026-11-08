-- Phase B1 / 04: inspection visits and unit evaluations.
-- Leaders assign visits, team members record exactly one evaluation per visit.
-- Evaluations are insert-only: no user can edit or delete one after submitting.

create table public.unit_visits (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  team_member_id uuid not null references public.profiles (id) on delete restrict,
  scheduled_at timestamp with time zone not null,
  status public.visit_status not null default 'scheduled',
  notes text
    check (notes is null or char_length(notes) <= 2000),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.unit_visits enable row level security;

revoke all on table public.unit_visits from anon, authenticated;
grant select on table public.unit_visits to authenticated;
grant insert (
  unit_id, team_member_id, scheduled_at, status, notes
) on table public.unit_visits to authenticated;
grant update (
  scheduled_at, team_member_id, status, notes
) on table public.unit_visits to authenticated;
grant delete on table public.unit_visits to authenticated;

create policy "unit_visits_select_team_own"
on public.unit_visits
for select
to authenticated
using ((select auth.uid()) = team_member_id);

create policy "unit_visits_select_leader_admin"
on public.unit_visits
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "unit_visits_select_owner"
on public.unit_visits
for select
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = unit_visits.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "unit_visits_insert_leader_admin"
on public.unit_visits
for insert
to authenticated
with check ((select private.is_leader_or_admin()));

-- Assignment targets must really be team members. Without this a leader could
-- accidentally assign a visit to a student, who would then be able to read the
-- visit and submit an evaluation.
create function private.validate_visit_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles as p
    where p.id = new.team_member_id
      and p.role = 'team'::public.app_role
  ) then
    raise exception 'inspection visit must be assigned to a team member'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_visit_team_member()
from public, anon, authenticated;

create trigger unit_visits_validate_team_member
before insert or update of team_member_id on public.unit_visits
for each row
execute function private.validate_visit_team_member();

create policy "unit_visits_update_team_own"
on public.unit_visits
for update
to authenticated
using (
  (select auth.uid()) = team_member_id
  or (select private.is_leader_or_admin())
)
with check (
  (select auth.uid()) = team_member_id
  or (select private.is_leader_or_admin())
);

create policy "unit_visits_delete_leader_admin"
on public.unit_visits
for delete
to authenticated
using ((select private.is_leader_or_admin()));

create index unit_visits_unit_id_idx on public.unit_visits (unit_id);
create index unit_visits_team_member_id_idx on public.unit_visits (team_member_id);
create index unit_visits_status_idx on public.unit_visits (status);
create index unit_visits_scheduled_at_idx on public.unit_visits (scheduled_at);

-- A team member may change only status/notes on their own visit. Moving the
-- visit to another unit or another team member is a leader/admin action.
create function private.protect_visit_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.has_role('team'::public.app_role))
     and (
       new.unit_id is distinct from old.unit_id
       or new.team_member_id is distinct from old.team_member_id
       or new.scheduled_at is distinct from old.scheduled_at
     )
  then
    raise exception 'team members cannot reassign an inspection visit'
      using errcode = '42501';
  end if;

  -- Team members may only close their own visit. Reopening a completed or
  -- cancelled visit is a leader/admin action.
  if (select private.has_role('team'::public.app_role))
     and new.status is distinct from old.status
     and not (old.status = 'scheduled' and new.status in ('completed', 'cancelled'))
  then
    raise exception 'invalid visit status transition'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_visit_assignment()
from public, anon, authenticated;

create trigger unit_visits_protect_assignment
before update on public.unit_visits
for each row
execute function private.protect_visit_assignment();

create trigger unit_visits_set_updated_at
before update on public.unit_visits
for each row
execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Unit evaluations
-- ---------------------------------------------------------------------------
create table public.unit_evaluations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  team_member_id uuid not null references public.profiles (id) on delete restrict,
  visit_id uuid not null unique references public.unit_visits (id) on delete restrict,
  checklist jsonb not null default '{}'::jsonb
    check (jsonb_typeof(checklist) = 'object'),
  score smallint not null
    check (score between 0 and 100),
  photo_paths text[] not null default '{}'::text[]
    check (cardinality(photo_paths) <= 10),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.unit_evaluations enable row level security;

revoke all on table public.unit_evaluations from anon, authenticated;
grant select on table public.unit_evaluations to authenticated;
grant insert (
  unit_id, team_member_id, visit_id, checklist, score, photo_paths
) on table public.unit_evaluations to authenticated;

create policy "unit_evaluations_select_team_own"
on public.unit_evaluations
for select
to authenticated
using ((select auth.uid()) = team_member_id);

create policy "unit_evaluations_select_owner"
on public.unit_evaluations
for select
to authenticated
using (
  exists (
    select 1
    from public.units as u
    where u.id = unit_evaluations.unit_id
      and u.owner_id = (select auth.uid())
  )
);

create policy "unit_evaluations_select_leader_admin"
on public.unit_evaluations
for select
to authenticated
using ((select private.is_leader_or_admin()));

create policy "unit_evaluations_insert_assigned_team"
on public.unit_evaluations
for insert
to authenticated
with check (
  (select auth.uid()) = team_member_id
  and (select private.has_role('team'::public.app_role))
  and exists (
    select 1
    from public.unit_visits as v
    where v.id = unit_evaluations.visit_id
      and v.unit_id = unit_evaluations.unit_id
      and v.team_member_id = (select auth.uid())
      and v.status in ('scheduled', 'completed')
  )
);

create index unit_evaluations_unit_id_idx on public.unit_evaluations (unit_id);
create index unit_evaluations_team_member_id_idx
on public.unit_evaluations (team_member_id);

create function private.validate_unit_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.unit_visits as v
    where v.id = new.visit_id
      and v.unit_id = new.unit_id
      and v.team_member_id = new.team_member_id
  ) then
    raise exception 'evaluation does not match its assigned visit'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from unnest(new.photo_paths) as p(path)
    where p.path is null
       or p.path not like new.unit_id::text || '/%'
       or position('..' in p.path) > 0
       or char_length(p.path) > 1024
  ) then
    raise exception 'evaluation photo path must belong to the unit'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_unit_evaluation()
from public, anon, authenticated;

create trigger unit_evaluations_validate
before insert on public.unit_evaluations
for each row
execute function private.validate_unit_evaluation();

create function private.complete_visit_after_evaluation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.unit_visits
  set status = 'completed'
  where id = new.visit_id
    and status = 'scheduled';

  return new;
end;
$$;

revoke all on function private.complete_visit_after_evaluation()
from public, anon, authenticated;

create trigger unit_evaluations_complete_visit
after insert on public.unit_evaluations
for each row
execute function private.complete_visit_after_evaluation();

create trigger unit_evaluations_set_updated_at
before update on public.unit_evaluations
for each row
execute function private.set_updated_at();
