# WIJHA — Full Technical Report

> **Purpose of this document.** A single, deep reference for the WIJHA codebase so that any
> technical question about the project — architecture, database, security, business logic,
> deployment, testing, trade-offs, or "why did you do it this way?" — can be answered from it.
>
> Written in English; a few Arabic notes are added where the domain wording matters.
>
> Snapshot: 2026-11-12 · branch `main` · HEAD `a81db07`.

---

## 1. Executive summary

**WIJHA (وِجهة)** is an Arabic-first, RTL, mobile-first **student-housing marketplace** for Egypt.
It connects university students with property owners, but **the company is the middleman**: the
student never negotiates or pays the owner directly. WIJHA handles discovery, booking, payment
collection, commission, contracts, and quality control (field visits + leader approval of units).

The application is a **Next.js 16 App Router** project backed by **Supabase** (Postgres + Auth +
Storage). Almost all business logic lives in the database as **`SECURITY DEFINER` RPCs** wrapped
in transactions, while the Next.js layer is deliberately thin: Server Components read data, Server
Actions call RPCs, and the client only renders and collects input.

Three ideas explain most of the design:

1. **The database is the source of truth for authorization.** RLS is enabled on every table; roles
   come from `public.profiles`, never from `user_metadata`. Writes that touch money, ownership, or
   state transitions go through RPCs that re-check everything.
2. **Two layers of authorization.** Every Server Action calls `guardAction()` (auth + role), and
   every RPC repeats the ownership/role check in SQL. A UI bypass is not enough to do damage.
3. **Nothing is hard-deleted.** Business rows get `deleted_at`; only admins can restore; partial
   unique indexes keep uniqueness correct across live rows only.

Current maturity: **feature-complete MVP with manual payments** (no gateway yet), deployed to
Vercel (`fra1`) against a Supabase project in `eu-central-1` (Frankfurt), with a staging
environment, a negative-case RLS test suite, and a documented set of open product decisions.

---

## 2. Product & domain

### 2.1 Problem

Students moving to a new city need verified, gender-separated housing near their university.
Owners need demand and a trusted intermediary. Informal Facebook groups are the status quo:
no verification, no escrow, no contract, no accountability.

### 2.2 WIJHA's model

```
Student ──discovers──▶ Unit listing ──belongs to──▶ Owner
   │                        ▲
   │                        │ verified by
   │                   Field team ──evaluates──▶ visit + score
   │                        │
   │                   Leader ──approves/rejects──▶ unit status
   │
   └──books──▶ Booking ──▶ Payment (to WIJHA) ──▶ Contract ──▶ Move-in
                                   │
                              commission (default 15%)
```

The company collects rent + commission, keeps the commission, and settles with the owner offline.
That is why `bookings` stores a **commission snapshot** (`commission_rate_snapshot`,
`commission_amount_piastres`) — changing the platform rate later must never rewrite history.

### 2.3 MVP scope (v1)

In scope:

- Student signup: name, phone, ID photo, university card photo, university, study year, smoker flag, hobbies.
- Owner signup: name, phone, ID photo, number of units, proof of ownership, unit photos.
- Unit onboarding: owner creates unit → field team visits and evaluates → leader approves/rejects.
- Booking: instant booking, optional pre-booking visit, **rent per bed** with the option to book a
  whole room, strict male/female separation. (`unit_visits` currently models **field-team
  inspections**; a separate student pre-booking visit flow is not built yet.)
- Payment: deposit or full amount, money to the company first, commission deducted. (Current
  implementation creates **one** payment for the full `total_amount_piastres` with method `'card'`
  as a placeholder; splitting a deposit from the remainder is not built yet.)
- Cancellation: refund only if cancelled ≥ 24h before check-in (configurable via
  `platform_settings.cancellation_window_hours`); gateway fees are deducted using
  `platform_settings.gateway_fee_rate`. The database now computes the refund and marks the payment
  `refund_pending`; an admin transfers the money and confirms it (or declines it). The old
  `refund_booking_payment` remains as a manual dispute override.
- Recommendations for students (rule-based scoring, no AI/LLM).
- Student matching by traits (simple rules/scoring), student ratings, optional external contracts.

Explicitly out of scope for v1: AI evaluation/acceptance percentage, VIP section, automated
gateway integration, automated payouts to owners, dispute workflow.

### 2.4 Open product decisions (documented, not assumed)

These are intentionally **not** hard-coded because the product owner has not decided:

| Decision | Current handling |
|---|---|
| Commission percentage | `platform_settings.commission_rate`, default `0.1500`; snapshotted per booking |
| Gateway fee percentage deducted from refunds | `platform_settings.gateway_fee_rate`, default `0.0150` **placeholder**; must be replaced with the provider rate |
| Which matching traits are mandatory vs optional | `match_units()` scores available signals; weights are simple |
| Student-to-student ratings: who/when/visibility/moderation | `reviews.target_type = 'student'` exists; rules pending |
| External contract template ownership | `contracts` table + `request_contract`/`sign_contract` exist; template pending |
| Dispute process | Not modelled; `cancellation_reason` + `audit_logs` only |

---

## 3. Roles & permissions

Five roles in the `public.app_role` enum:

| Role | Arabic | Purpose | Home |
|---|---|---|---|
| `student` | طالب | Browse, get matched, book, pay, review, manage profile | `/student` |
| `owner` | مالك | Create/manage units, rooms, beds; see bookings & payments | `/owner` |
| `team` | فريق ميداني | Visit units, record evaluations, upload photos | `/team` |
| `leader` | ليدر | Approve/reject units, oversee visits/evaluations | `/leader` |
| `admin` | أدمن | Superuser: every dashboard + users, roles, payments, refunds, moderation, restore | `/admin` |

Key rules:

- Signup can only request `student` or `owner`. The DB trigger clamps anything else to `student`
  (`private.create_profile_for_new_user`). Team/leader/admin are assigned by an admin.
- Role is read **only** from `public.profiles` (server-side). `auth.users.raw_user_meta_data.role`
  is treated as untrusted input.
- `private.has_role(role)` and `private.is_leader_or_admin()` are the SQL helpers used in policies.
- Admins are **superusers**: page guards accept `admin` for every dashboard, and the UI shows all
  navigation entries to admins.

Permission matrix (read as "who can do it"):

| Capability | student | owner | team | leader | admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Browse approved units (anon too) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create unit | | ✅ | | | ✅ |
| Create room/bed | | ✅ | | | ✅ |
| Soft-delete own unit/room/bed | | ✅ | | | ✅ |
| Schedule/complete visit | | | ✅ | ✅ | ✅ |
| Record evaluation | | | ✅ | | ✅ |
| Approve/reject unit | | | | ✅ | ✅ |
| Create booking | ✅ | | | | |
| Cancel booking | ✅ (own) | | | | ✅ |
| Confirm/fail payment | | | | | ✅ (+ service_role) |
| Refund payment | | | | | ✅ (+ service_role) |
| Request contract | ✅ | ✅ | | | ✅ |
| Sign contract | | | | | ✅ (+ service_role) |
| Write review | ✅ | ✅ | | | ✅ |
| Moderate review | | | | | ✅ |
| Restore soft-deleted row | | | | | ✅ |
| Change user role | | | | | ✅ |
| Claim first admin (bootstrap) | once, with secret | | | | — |

---

## 4. Technology stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, RSC, Server Actions) | `16.4.4` |
| UI runtime | React / React DOM | `19.3.1` |
| Language | TypeScript (strict) | `6.0.3` |
| Styling | Tailwind CSS v4 (`@theme` tokens, no config file) | `4.3.4` |
| Validation | Zod | `4.6.7` |
| Phone parsing | libphonenumber-js | `^1.13.15` |
| Backend | Supabase Postgres + Auth + Storage | project `aekmncnyhuhsleshaewg`, `eu-central-1` |
| Supabase clients | `@supabase/ssr` / `supabase-js` | `0.12.7` / `2.118.0` |
| Unit tests | Vitest | `^5.1.0` |
| E2E | Playwright | `^1.65.0` |
| Lint | ESLint + `eslint-config-next` | `10.14.0` |
| Supabase CLI | migrations / local dev | `3.0.0` |
| Hosting | Vercel, region `fra1` | — |

Deliberate non-choices: no ORM (raw SQL migrations + typed Supabase client), no state manager
(URL + RSC + `useState`), no component library (hand-rolled primitives), no i18n library
(cookie + typed dictionaries), no payment SDK yet.

### 4.1 Scripts

```
npm run dev          next dev
npm run build        next build
npm run start        next start
npm run lint         eslint .
npm run typecheck    tsc --noEmit
npm run test:unit    vitest run
npm run test:e2e     playwright test
npm run test:e2e:ui  playwright test --ui
npm run test:e2e:headed
```

---

## 5. Repository layout

```
wijha/
├─ app/
│  ├─ (auth)/                 login, signup, check-email, forgot-password, reset-password
│  ├─ (protected)/            requireUser() layout + role dashboards
│  │  ├─ admin/               dashboard, payments, reviews, restore, bootstrap
│  │  ├─ owner/               dashboard, units/new
│  │  ├─ student/             dashboard, profile, recommendations
│  │  ├─ team/  leader/  profile/
│  ├─ actions/                server actions (the write API)
│  ├─ api/cron/expire-payments/route.ts
│  ├─ auth/callback|confirm|reset/route.ts
│  ├─ book/[id]/  units/[id]/  explore/  page.tsx
│  ├─ error.tsx  loading.tsx  not-found.tsx  robots.ts
│  ├─ layout.tsx  globals.css
├─ components/
│  ├─ ui/                     Button, Input, Card, StatusChip, Stepper, EmptyState, icons…
│  ├─ layout/                 header, footer, dashboard nav, site controls, brand
│  └─ providers/              locale provider
├─ features/<domain>/         schemas, types, queries, components (colocated per domain)
├─ lib/
│  ├─ auth/                   get-current-user, require-user, require-role, redirects, errors
│  ├─ supabase/               server, client, admin (service-role), middleware
│  ├─ i18n/                   config, dictionary, pages, server
│  ├─ validation/             phone
│  ├─ action-pipeline.ts      guardAction, failureResult, toErrorCode, isRateLimited
│  ├─ action-errors.ts  errors.ts  result.ts  roles.ts  env.ts  env.server.ts  cn.ts
├─ supabase/
│  ├─ migrations/             25 chronological SQL migrations
│  └─ tests/                  rls_negative_cases, soft_delete_cases, staging-roles, cleanup-e2e
├─ tests/                     unit (Vitest) + e2e (Playwright)
├─ types/database.types.ts    hand-maintained Database type (15 tables + view + enums + RPCs)
├─ proxy.ts                   Next 16 request proxy (session refresh + CSP/security headers)
├─ next.config.ts  vercel.json  vitest.config.ts  playwright.config.ts
├─ BACKEND.md  TESTING.md  CLAUDE.md  docs/*.md
```

Why `features/` instead of a flat `components/`: each domain owns its schemas, types, server
queries, and components together. Pages stay thin and import from `features/<domain>`.

---

## 6. Architecture & request lifecycle

### 6.1 Rendering model

- **Server Components by default.** Pages fetch with the request-scoped Supabase server client,
  then pass plain props to client components.
- **Client components only where interaction is needed**: auth form, booking flow, explore
  filters, admin panels, review form, theme/locale controls.
- **Server Actions for all database writes.** No REST/GraphQL write endpoints except the cron route.
- **No client-side database writes.** Mutations go through actions so they can be gated and
  rate-limited. The one exception is **file upload**: the browser uploads directly to a Supabase
  Storage bucket (guarded by storage policies and `<user_id>/<uuid>` path rules), then a server
  action validates and attaches the resulting path to the row.

### 6.2 A write, end to end

```
<form action={serverAction}>
  └─ app/actions/<domain>.ts
       ├─ zod schema parse (features/<domain>/schemas.ts)     → INVALID_INPUT
       ├─ guardAction({ roles })                              → UNAUTHENTICATED / FORBIDDEN
       ├─ isRateLimited(...) (audit_logs count)               → CONFLICT (retry later)
       ├─ supabase.rpc("<business_rpc>", args)
       │    └─ SECURITY DEFINER function
       │         ├─ auth.uid() / private.has_role(...)
       │         ├─ SELECT ... FOR UPDATE (lock rows)
       │         ├─ validate state machine + invariants
       │         ├─ INSERT/UPDATE + triggers (bed status, payment events, audit)
       │         └─ raise exception 'STABLE_CODE' on failure
       ├─ failureResult(error) → { ok:false, error: ErrorCode }
       └─ revalidatePath(...) / redirect(...)
```

The client receives only a stable `ErrorCode`, never a raw Postgres message. `lib/action-errors.ts`
maps codes to AR/EN copy.

### 6.3 Error contract

`lib/errors.ts` defines: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `NOT_FOUND`,
`CONFLICT`, `INVALID_STATE`, `BED_UNAVAILABLE`, `UNIT_NOT_APPROVED`, `PROFILE_INCOMPLETE`,
`ACTIVE_BOOKINGS`, `HAS_UPCOMING_VISITS`, `RESTORE_CONFLICT`, `UNEXPECTED`.

`toErrorCode()` prefers a **stable code in the exception message** (RPCs raise e.g.
`raise exception 'BED_UNAVAILABLE'`), then falls back to SQLSTATE mapping:

| SQLSTATE | Mapped code | Typical cause |
|---|---|---|
| `42501` | `FORBIDDEN` | RLS / explicit deny |
| `23503` | `NOT_FOUND` | FK violation |
| `23505` | `CONFLICT` | unique violation |
| `23514` | `INVALID_STATE` | check constraint |
| `22023` | `INVALID_INPUT` | invalid parameter |
| `P0002` | `NOT_FOUND` | `no_data_found` |

This makes errors **locale-independent** and safe to log (the real message is `console.error`'d
server-side only).

### 6.4 Session & request pipeline

- `proxy.ts` (Next 16 replacement for `middleware.ts`) runs `updateSession()` for every request:
  refreshes the Supabase auth cookie, calls `auth.getUser()` (verifies with the Auth server, does
  not trust the cookie), and sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.
- The proxy **never redirects** unauthenticated users. Route protection is done in layouts/pages
  via `requireUser()` / `requireRole()`. Reason: `/auth/callback` must stay reachable, and
  redirects in middleware create loops with expired sessions.
- `app/(protected)/layout.tsx` calls `requireUser()` once and renders the role-aware shell
  (header, sidebar, bottom nav, logout form).
- Each page additionally calls `requireRole("<role>")`; admins pass every check.

### 6.5 Supabase client split

| File | Key | Runs where | Notes |
|---|---|---|---|
| `lib/supabase/server.ts` | publishable/anon | Server Components, Actions, Route Handlers | Cookie-bound; respects RLS |
| `lib/supabase/client.ts` | publishable/anon | Browser | Respects RLS; no service key |
| `lib/supabase/admin.ts` | **service role** | Server only (`import "server-only"`) | Bypasses RLS; used by cron/bootstrap |
| `lib/supabase/middleware.ts` | publishable/anon | Proxy | Cookie refresh only |

The service-role key is never imported by a client component, never prefixed `NEXT_PUBLIC_`, and
`lib/env.server.ts` validates it at use time.

---

## 7. Data model

### 7.1 Enums

| Enum | Values |
|---|---|
| `app_role` | `student`, `owner`, `team`, `leader`, `admin` |
| `gender_type` | `male`, `female` |
| `unit_status` | `pending`, `approved`, `rejected` |
| `bed_status` | `available`, `held`, `booked` |
| `booking_status` | `pending_payment`, `confirmed`, `cancelled`, `completed` |
| `payment_status` | `pending`, `paid`, `failed`, `expired`, `refund_pending`, `refunded` |
| `review_target_type` | `unit`, `student` |
| `moderation_status` | `pending`, `approved`, `rejected` |
| `contract_status` | `not_requested`, `requested`, `signed` |
| `visit_status` | `scheduled`, `completed`, `cancelled` |

### 7.2 Tables (15)

**Identity**

- `profiles` — `id` (PK → `auth.users`), `role app_role default 'student'`, `full_name` (≤100),
  `phone` (E.164-ish regex), `created_at`, `updated_at`, `deleted_at`. Created automatically by
  trigger on signup.
- `student_profiles` — `user_id` PK/FK, `gender` (required), `university`, `study_year` (1–7),
  `is_smoker`, `hobbies text[]` (≤20), `id_document_path`, `university_card_path`,
  `verification_status moderation_status`, timestamps, `deleted_at`.
  Matching preferences (all optional, so old profiles keep working): `budget_min_piastres`,
  `budget_max_piastres` (with a min ≤ max check), `preferred_areas text[]` (≤10),
  `preferred_amenities text[]` (≤30).
  Path checks force `<user_id>/...` and forbid `..`.
- `owner_profiles` — `user_id` PK/FK, `id_document_path`, `ownership_proof_path`,
  `verification_status`, timestamps, `deleted_at`.

**Configuration**

- `platform_settings` — singleton (`id boolean PK default true` + `check (id)`),
  `commission_rate numeric(5,4) default 0.1500` (0–1), `currency` (ISO-3, default `EGP`),
  `gateway_fee_rate numeric(5,4) default 0.0150` (0–1), `cancellation_window_hours integer
  default 24` (0–720), `updated_by`, timestamps. Seeded with 15% commission and a **placeholder**
  1.5% gateway fee that must be replaced with the real provider rate.

**Inventory**

- `units` — `id`, `owner_id` (FK, restrict), `title` (3–120), `area` (2–120), `gender_type`,
  `status` (default `pending`), `description` (≤3000), `amenities text[]` (≤30), timestamps,
  `deleted_at`.
- `rooms` — `id`, `unit_id` (cascade), `name` (1–60), `unique(unit_id, name)`,
  `unique(id, unit_id)` (composite-FK target), timestamps, `deleted_at`.
- `beds` — `id`, `room_id` (cascade), `label` (1–40), `price_piastres` (>0, ≤100,000,000),
  `status bed_status default 'available'`, `unique(room_id, label)`, `unique(id, room_id)`,
  timestamps, `deleted_at`.

**Quality control**

- `unit_visits` — `id`, `unit_id`, `team_member_id`, `scheduled_at`, `status visit_status`,
  `notes` (≤2000), timestamps, `deleted_at`.
- `unit_evaluations` — `id`, `unit_id`, `team_member_id`, `visit_id` **unique**,
  `checklist jsonb` (object), `score smallint` (0–100), `photo_paths text[]` (≤10), timestamps,
  `deleted_at`.

**Commerce**

- `bookings` — `id`, `student_id`, `unit_id`, `room_id`, `bed_id` (nullable = whole room),
  `move_in_date`, `move_out_date` (null or > move-in), `rent_amount_piastres`,
  `commission_rate_snapshot numeric(5,4)`, `commission_amount_piastres`,
  `total_amount_piastres` **generated stored** = rent + commission,
  `status booking_status default 'pending_payment'`, `cancellation_reason` (≤500), timestamps,
  `deleted_at`.
  Composite FKs guarantee the room belongs to the unit and the bed belongs to the room:
  `(room_id, unit_id) → rooms(id, unit_id)`, `(bed_id, room_id) → beds(id, room_id)`.
  A check enforces `commission_amount = round(rent * rate)`.
- `payments` — `id`, `booking_id`, `amount_piastres`, `currency`, `method` (`^[a-z0-9_-]{2,40}$`),
  `gateway_reference`, `gateway_event_id`, `status payment_status default 'pending'`,
  `failure_reason` (≤500), `paid_at`, `expires_at` (added in hardening),
  `refund_amount_piastres`, `refund_fee_piastres`, `refund_requested_at`, `refunded_at`,
  `refund_reason` (≤500), timestamps, `deleted_at`.
- `payment_events` — append-only audit of payment transitions: `booking_id`, `payment_id`,
  `from_status`, `to_status`, `amount_piastres`, `currency`, `created_at`.
- `contracts` — `id`, `booking_id`, `student_id`, `owner_id`, `status contract_status`,
  `file_path`, timestamps, `deleted_at`.
- `reviews` — `id`, `reviewer_id`, `target_type`, `target_id`, `rating` (1–5), `body` (1–2000),
  `moderation_status`, `unique(reviewer_id, target_type, target_id)`, timestamps, `deleted_at`.

**Operations**

- `audit_logs` — append-only trail used for dashboards, rate limiting, and admin actions:
  actor, action, target, metadata, `created_at`.

### 7.3 View

`public.unit_listings` — public read model (`security_invoker = true`, so the caller's RLS still
applies) joining units with room/bed aggregates (`room_count`, `available_beds`, `total_beds`,
`min/max_price_piastres`) and approved-review aggregates (`rating`, `review_count`). Used by
`/explore` and the unit page.

### 7.4 Indexes & constraints (highlights)

- `units_status_idx` — approved listing scans.
- `bookings_status_created_at_idx` — dashboards and status filters.
- `payments_status_idx` — pending-payment sweeps.
- `payments_expires_at_idx` — partial index on `expires_at where status = 'pending'`, for the
  expiry cron.
- Partial unique indexes for soft delete, e.g. one active booking per bed/room:
  `unique (bed_id) where bed_id is not null and status in ('pending_payment','confirmed') and deleted_at is null`
  and the room equivalent for whole-room bookings.
- Partial unique indexes on `rooms(unit_id, name)` / `beds(room_id, label)` **where
  `deleted_at is null`**, so a deleted name can be reused.
- `unit_evaluations.visit_id` unique — one evaluation per visit.
- `reviews(reviewer_id, target_type, target_id)` unique — one review per target per reviewer.
- `platform_settings` singleton check.

### 7.5 Entity relationships

```
auth.users 1─1 profiles
profiles 1─0..1 student_profiles
profiles 1─0..1 owner_profiles
profiles(owner) 1─* units 1─* rooms 1─* beds
units 1─* unit_visits 1─1 unit_evaluations
profiles(student) 1─* bookings *─1 units
bookings *─1 rooms (room_id, unit_id)
bookings *─0..1 beds  (bed_id, room_id)
bookings 1─* payments 1─* payment_events
bookings 1─0..1 contracts
profiles 1─* reviews (reviewer)   reviews ─▶ units|students (target_id, polymorphic)
profiles 1─* audit_logs (actor)
```

`reviews.target_id` is polymorphic (no FK) by design; integrity is enforced in
`moderate_review`/insert policies and application checks.

---

## 8. Security model

### 8.1 RLS doctrine

- **RLS enabled on every table.** No exceptions.
- Policies use `(select auth.uid())` rather than bare `auth.uid()` so Postgres evaluates it once
  per statement (initplan) instead of per row — a documented performance pattern.
- Roles are resolved with `private.has_role(...)` / `private.is_leader_or_admin()`, which read
  `profiles`, **not** JWT metadata. A user cannot promote themselves by editing signup metadata.
- `anon` can read only: approved units, their rooms/beds, approved unit reviews, and the
  `unit_listings` view.
- Owners see their own units (any status) and bookings/payments for their units.
- Students see their own profile, bookings, payments, contracts, reviews.
- Team sees visits/evaluations they created; leaders/admins see all.
- `audit_logs` has no direct insert grant: rows are written inside `SECURITY DEFINER` RPCs.
  Update/delete are blocked by triggers (append-only), and select is admin-only.

### 8.2 Column-level grants

`revoke all` then targeted `grant select/insert/update (columns)`. This is what blocks
self-role-promotion and status tampering:

- `profiles`: authenticated can `select`, and `update (full_name, phone)` only. `role` is not
  grantable, so role changes can only happen through `admin_set_user_role`.
- `units`: authenticated can insert/update descriptive columns, and `update (status)` is granted
  but the RLS policy restricts it to leader/admin.
- `student_profiles`: insert on identity/descriptor/document columns; update limited to the four
  matching-preference columns. `owner_profiles`: insert + update on document paths.
  `verification_status` is never grantable to the user.
- `bookings` / `payments` / `contracts`: **select only**; all writes via RPC.
- `reviews`: insert on content columns; `moderation_status` not writable by the author.

### 8.3 `SECURITY DEFINER` RPC catalogue

All functions use `set search_path = ''` (fully qualified names) to prevent search-path hijacking.

**Booking / payment / contract / review** (`20261108120000`, hardened later)

| RPC | Caller | What it does |
|---|---|---|
| `create_booking(unit, room, bed, move_in, move_out?) → uuid` | student | Locks unit/room/bed `FOR UPDATE`; requires approved unit + complete student profile + gender match + bed availability; snapshots commission; inserts booking (`pending_payment`) + pending payment with `expires_at = now() + 7 days`; sets bed `held`. |
| `cancel_booking(booking_id, reason?)` | student (own) / admin | Allowed from `pending_payment` or `confirmed`; releases bed; records reason; blocks cancellation of `completed`. Applies the refund policy: an unpaid payment becomes `failed`, a paid payment inside the window becomes `refund_pending` with the exact amount/fee, and one outside the window stays `paid` with a "no refund" note. |
| `confirm_booking_payment(booking_id, gateway_reference)` | admin / `service_role` | `pending|failed → paid`, sets `paid_at`, booking → `confirmed`, bed → `booked`; reference ≥3 chars; idempotency guard. |
| `fail_booking_payment(booking_id, reason)` | admin / `service_role` | `pending → failed`, releases bed, booking → `cancelled`. |
| `confirm_booking_refund(booking_id)` | admin / `service_role` | `refund_pending → refunded`; records `refunded_at`; admin confirms the money was actually transferred. |
| `decline_booking_refund(booking_id, reason?)` | admin / `service_role` | `refund_pending → paid`; clears the pending amount; used when the policy is disputed. |
| `refund_booking_payment(booking_id)` | admin / `service_role` | Manual override: `paid → refunded`, computes amount minus gateway fee; booking → `cancelled`; bed released. |
| `count_my_recent_actions(action, window_seconds?) → integer` | authenticated | `SECURITY DEFINER` count of the caller's **own** audit rows; powers the rate limiter without opening `audit_logs` RLS. |
| `request_contract(booking_id) → uuid` | student/owner/admin on a confirmed booking | `not_requested → requested`, creates contract row. |
| `sign_contract(contract_id, file_path)` | admin / `service_role` | `requested → signed`, validates storage path. |
| `moderate_review(review_id, status)` | admin | Sets `approved|rejected`, writes audit. |
| `match_units(limit?)` | student | Rule-based scoring over approved units using gender, area/university, amenities, price, rating. |

**Inventory / admin / dashboards**

| RPC | Caller | What it does |
|---|---|---|
| `create_unit(title, area, gender, description, amenities, rooms jsonb) → uuid` | owner/admin | Atomic unit + rooms + beds creation in one transaction; validates JSON shape and prices. |
| `owner_bookings(limit?)` | owner/admin | Owner dashboard read model with student contact + amounts. |
| `admin_set_user_role(user_id, role)` | admin | Changes role; guards last-admin demotion. |
| `claim_first_admin(actor)` | bootstrap route only | Advisory-lock (`pg_advisory_xact_lock(727272727)`) + "zero admins" check → atomic first-admin claim. |
| `admin_find_users(query)` | admin | Search users by name/phone/email fragment. |
| `expire_pending_payments() → integer` | `service_role` (cron) | Finds `pending` payments past `expires_at`, marks `expired`, cancels bookings, releases beds; returns count. |

**Soft delete** (5 exposed + 5 restore)

| RPC | Caller | Notes |
|---|---|---|
| `soft_delete_unit/room/bed/unit_visit/review(id)` | owner/team/admin per object | Sets `deleted_at`; unauthorized callers get `NOT_FOUND` (no existence leak). |
| `restore_unit/room/bed/unit_visit/review(id)` | admin | Re-checks parent chain; may raise `RESTORE_CONFLICT`. |

Guards: `ACTIVE_BOOKINGS` (unit/room/bed with live bookings), `HAS_UPCOMING_VISITS` (unit),
`RESTORE_CONFLICT` (name/label collision or missing parent).

### 8.4 Triggers (business invariants enforced in SQL)

- `create_profile_for_new_user` — creates `profiles` + role profile; clamps role to student/owner;
  sanitises phone/gender/university/hobbies.
- `set_updated_at` — timestamps on mutable tables.
- Bed status sync — booking insert/state change moves beds `available → held → booked → available`.
- Gender lock — changing a unit's `gender_type` is blocked while it has active bookings.
- Payment immutability — `booking_id`, `amount_piastres`, `currency`, `method` cannot change after
  insert (`protect_payment_fields`).
- Payment event log — every status change appends to `payment_events`.
- State-machine triggers — reject illegal transitions (see §10).

### 8.5 Storage buckets

| Bucket | Visibility | Path convention | Access |
|---|---|---|---|
| `id-documents` | **private** | `<user_id>/<uuid>.<ext>` | Owner + authorized staff, via signed URLs |
| `ownership-documents` | **private** | `<user_id>/<uuid>.<ext>` | Owner + leaders/admins |
| `contracts` | **private** | `<booking_id or user_id>/<uuid>.<ext>` | Parties + admin, signed URLs |
| `unit-photos` | public read | `<unit_id>/<uuid>.<ext>` | Public read; writes restricted to the unit owner/team |

Path constraints in the table checks (`like user_id || '/%'`, no `..`, length bounds) plus
storage policies prevent path traversal and cross-user writes. Filenames are UUIDs (added in the
security pass) so uploads cannot overwrite or guess each other.

### 8.6 HTTP & browser hardening (`next.config.ts`)

- Content-Security-Policy: `default-src 'self'`, `script-src 'self' 'unsafe-inline'`
  (`'unsafe-eval'` added in development only), `style-src 'self' 'unsafe-inline'`,
  `img-src`/`connect-src` limited to self + the Supabase project (plus `wss://*.supabase.co` for
  realtime), `font-src 'self' data:`, `frame-ancestors 'none'`, `base-uri 'self'`,
  `form-action 'self'`. Note: `'unsafe-inline'` is required by the pre-paint theme script; a nonce
  would be the next hardening step.
- `https://challenges.cloudflare.com` is additionally allowed in `script-src`, `connect-src` and
  `frame-src` for the Turnstile CAPTCHA (the widget injects a script and renders its challenge in an
  iframe). Without those entries the widget fails silently under the production CSP.
- `Strict-Transport-Security` (2 years, includeSubDomains, preload).
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- `app/robots.ts` disallows **all** crawlers in every environment for now (MVP/test deployment);
  when `NEXT_PUBLIC_APP_ENV=staging` the app also sends `X-Robots-Tag: noindex, nofollow`.

### 8.7 Secrets & environment isolation

| Variable | Public | Purpose |
|---|:--:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | Anon/publishable key (RLS-bound) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical site URL (email redirects) |
| `NEXT_PUBLIC_APP_ENV` | ✅ | `staging` toggles banner + noindex |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✅ | Cloudflare Turnstile site key; widget hidden when empty |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Server only, bypasses RLS |
| `BOOTSTRAP_ADMIN_SECRET` | ❌ | First-admin claim (min 8 chars) |
| `CRON_SECRET` | ❌ | Protects the expiry cron (min 16 chars) |

Rules: `.env*` never committed (only `.env.example`); `lib/supabase/admin.ts` imports
`server-only`; `lib/env.server.ts` validates server secrets; rotate on any leak; redeploy after
changing `NEXT_PUBLIC_*`.

### 8.8 Rate limiting

`isRateLimited(supabase, action, maxAttempts, windowMinutes)` calls
`count_my_recent_actions(action, windowSeconds)`, a `SECURITY DEFINER` function that counts only
the caller's own rows in `audit_logs` for that action inside the window. Used on abuse-prone
actions: bootstrap claim, payment confirm/refund, booking creation/cancellation. Because the counter
is in Postgres, a redeploy cannot reset it. Rejections are themselves logged so the counter
advances.

**Why the RPC:** `audit_logs` is append-only and admin-read-only, so the old direct `select count(*)`
returned zero for students and owners and only admins were actually limited. The function keeps the
table closed while exposing exactly one aggregate for the caller. An
`(actor_id, action, created_at desc)` index supports it.

---

## 9. Core business flows

### 9.1 Signup & authentication

1. `/signup` collects name, phone (validated with libphonenumber-js), password + confirmation,
   role (student/owner), and role-specific fields.
2. Supabase Auth creates the user. A DB trigger `create_profile_for_new_user` creates `profiles`
   plus `student_profiles`/`owner_profiles`, sanitising everything and clamping the role.
3. Confirmation email → `/auth/confirm` (legacy alias) → `/auth/callback?code=...` →
   `exchangeCodeForSession` server-side → read `profiles.role` → redirect to the role home.
4. Login uses `signInWithPassword`; `signOut` clears the session; the protected layout re-checks
   the user on every request.
5. Already-confirmed links degrade gracefully to `/login?error=already_confirmed`.
6. CAPTCHA: when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, signup/login/resend render a Cloudflare
   Turnstile widget and pass its single-use token to Supabase. The widget resets after every submit
   so a retry always carries a fresh token. The secret stays in Supabase Dashboard → Authentication
   → Attack Protection → CAPTCHA; an empty site key simply hides the widget (local dev).
7. Password recovery: `/forgot-password` → server action `requestPasswordReset` →
   `resetPasswordForEmail({ redirectTo: <site>/auth/reset })` → recovery email → `/auth/reset`
   exchanges the PKCE code and forwards to `/reset-password` → `updatePassword` calls
   `updateUser({ password })`, signs the recovery session out, and redirects to `/login?reset=1`.
   The request action answers identically for unknown emails (no user enumeration) and only
   surfaces mail-rate-limit, CAPTCHA, and invalid-address errors. Expired/reused/cross-browser
   links land on `/forgot-password?error=link_invalid`.

Design notes: the callback is intentionally outside `(protected)` and the proxy never redirects,
so email links can never be blocked. The legacy `/auth/confirm` route was kept so previously sent
emails still work; its old same-origin check was removed because confirmation links arrive
cross-browser/cross-origin.

### 9.2 Unit onboarding & quality control

```
owner create_unit (atomic unit+rooms+beds, status=pending)
   ↓
team schedules unit_visit (scheduled)
   ↓
team completes visit + unit_evaluation (score 0–100, checklist, ≤10 photos)
   ↓
leader reviews → units.status = approved | rejected
   ↓
approved → appears in unit_listings / explore / matching
```

`unit_evaluations.visit_id` is unique: a visit produces at most one evaluation. Owners can see
their own unit's evaluation but cannot edit it.

### 9.3 Booking

`create_booking` is the most important transaction. Simplified:

```sql
-- 1. authenticate
v_student_id := auth.uid();
-- 2. lock inventory (prevents double-booking races)
select * into v_unit from units where id = p_unit_id for update;
select * into v_room from rooms where id = p_room_id for update;
select * into v_bed  from beds  where id = p_bed_id  for update;  -- when bed booking
-- 3. invariants
--    unit.status = 'approved'
--    student_profiles exists and is complete
--    unit.gender_type = student.gender
--    bed.status = 'available' (or whole room: all beds available)
-- 4. money
v_rate := platform_settings.commission_rate;
commission := round(rent * v_rate);
-- 5. write
insert booking(status='pending_payment', commission snapshot…);
insert payment(status='pending', expires_at = now() + interval '7 days');
-- the booking trigger then flips the bed to 'held'
```

Race safety comes from `FOR UPDATE` row locks plus partial unique indexes on active bed/room
bookings. If two students tap "book" simultaneously, one transaction wins the lock and the other
gets `BED_UNAVAILABLE`/`CONFLICT`.

Whole-room booking: `bed_id = null`; the room is treated as one inventory unit, and the partial
unique index on `(room_id)` where active prevents a second whole-room booking.

### 9.4 Payment (manual, current MVP)

There is **no gateway integration**. The flow is deliberately human-in-the-loop:

1. Booking creates a `pending` payment with `expires_at` (7 days).
2. Student pays by bank transfer / wallet / cash and submits the reference offline.
3. Admin opens `/admin/payments`, enters the receipt reference (≥3 chars) and confirms.
4. `confirm_booking_payment` → payment `paid`, booking `confirmed`, bed `booked`.
5. Cancellation applies the written policy: inside the window the payment becomes `refund_pending`
   with `refund_amount_piastres = amount - gateway fee`; outside the window it stays `paid` with no
   refund owed.
6. Admin transfers the money outside the app, then confirms at `/admin/payments` →
   `confirm_booking_refund` → payment `refunded`. Declining returns it to `paid`.
7. Unpaid after expiry: the daily cron calls `expire_pending_payments()` → payment `expired`,
   booking `cancelled`, bed released.

`payment_events` records every transition, so the money trail is reconstructible even though the
gateway is absent. `payments` never stores card data (policy + schema).

### 9.5 Contracts

`contracts.status`: `not_requested → requested → signed`.

- `request_contract(booking_id)` — allowed for the booking's student/owner or admin, only on a
  confirmed booking; creates the contract row and moves it to `requested`.
- `sign_contract(contract_id, file_path)` — admin/service-role only; validates the storage path,
  sets `signed`.
- External template ownership is still an open product decision; the schema is ready for it.

### 9.6 Reviews & moderation

- A user can review a `unit` or a `student`, once per target (`unique` constraint).
- New reviews are `pending`; only `approved` unit reviews are publicly readable.
- Authors always see their own reviews; owners see reviews for their units.
- `moderate_review` (admin) approves/rejects and writes an audit entry.
- `soft_delete_review` (author or admin) / `restore_review` (admin).

### 9.7 Matching (`match_units`)

A `stable`, `security invoker` SQL function, not AI. Hard filters first:

- `units.status = 'approved'` and `deleted_at is null`;
- `units.gender_type = student.gender` (gender separation is a filter, not a preference);
- at least one available bed.

Then a weighted score, rounded to 4 decimals:

| Signal | Weight | Rule |
|---|---:|---|
| Budget fit | 0.35 | `1` if `min_price` is inside `[budget_min, budget_max]`, else `0`; `0.5` if the student set no budget |
| Preferred area | 0.25 | `1` if `units.area` is in `preferred_areas`, else `0`; `0.5` if the list is empty |
| Amenities overlap | 0.20 | matched amenities ÷ preferred amenities |
| Rating | 0.20 | `rating / 5` |

Ordering: `score desc, rating desc, created_at desc`, limit clamped to `1..50` (default 20).
The student always chooses; there is no automatic assignment. The UI previously had a sample-data
fallback, which was removed so only real matches appear.

### 9.8 Soft delete

- `deleted_at` on 9 business tables + `student_profiles` + `owner_profiles`.
- Normal reads filter `deleted_at is null`; partial unique indexes ignore deleted rows.
- Only 5 delete RPCs are exposed (unit, room, bed, visit, review); restore is admin-only.
- Unauthorized callers receive `NOT_FOUND`, so the API does not leak whether a row exists.
- Guards: cannot delete a unit/room/bed with `ACTIVE_BOOKINGS`; cannot delete a unit with
  `HAS_UPCOMING_VISITS`; restore fails with `RESTORE_CONFLICT` on name/label collisions.
- Why soft delete: bookings/payments/contracts reference inventory with `on delete restrict`;
  physical deletion would either fail or destroy financial history. Soft delete also enables
  admin undo and keeps auditability.

### 9.9 Expiry cron

`GET /api/cron/expire-payments` requires header `x-cron-secret` equal to `CRON_SECRET` (403
otherwise). It uses the service-role client to call `expire_pending_payments()`, which is
idempotent and returns the number of expired payments. It is intended to run daily (Vercel Cron or
any scheduler). `vercel.json` pins the region.

---

## 10. State machines

Enforced by RPC logic **and** triggers, so even a direct SQL update cannot skip a step.

**Booking**

```
pending_payment ──confirm_payment──▶ confirmed ──complete──▶ completed
       │                                  │
       ├──cancel / expire──▶ cancelled ◀──┘ (cancel)
```

**Payment**

```
pending ──confirm──▶ paid ──cancel in window──▶ refund_pending ──admin confirms──▶ refunded
   │  ▲                 │                              │
   │  └── retry (failed → pending)                     └──admin declines──▶ paid
   ├──fail──▶ failed
   └──expire──▶ expired
```

**Visit**

```
scheduled ──complete──▶ completed
    └──cancel──▶ cancelled ──reopen (leader/admin)──▶ scheduled
```

**Contract**

```
not_requested ──request──▶ requested ──sign──▶ signed
```

**Unit**

```
pending ──approve──▶ approved
   └────reject────▶ rejected
```

**Bed**

```
available ──hold (booking created)──▶ held ──confirm payment──▶ booked
    ▲                                    │                         │
    └──────── cancel / fail / expire ─────┴─────────────────────────┘
```

Illegal transitions raise `INVALID_STATE`. Examples: confirming an already-paid booking,
cancelling a completed booking, refunding an unpaid payment, signing a contract that was never
requested.

---

## 11. Frontend architecture

### 11.1 Design system

- Tokens declared in `app/globals.css` via Tailwind v4 `@theme`: `canvas`, `surface`, `ink`,
  `mint`, `teal`, `brown`, `primary`/`primary-strong`, status colours, radii, shadows.
- `html.dark` overrides the same tokens, so every utility adapts automatically. Components use
  semantic classes (`bg-surface`, `text-ink`, `bg-primary`) — never `bg-white`/`text-black`.
- Brand: Cairo font (Arabic + Latin subsets), official logo, Western digits.
- Primitives in `components/ui/`: `Button`/`ButtonLink`, `Input`/`Textarea`/`Select`,
  `Card`/`Panel`, `StatusChip`/`GenderBadge`/`VerifiedBadge`/`Rating`, `PageHeader`,
  `EmptyState`, `Stepper`, `UnitCard`, `icons`. `lib/cn.ts` joins classes (no `clsx` dependency).

### 11.2 Theming

- Theme stored in `localStorage` under `wijha-theme`.
- A pre-paint inline script in `app/layout.tsx` applies `html.dark` **before** first paint to
  avoid a flash.
- The toggle uses a circular `View Transition` reveal. No server round-trip.

### 11.3 Internationalisation

- Locales: `ar` (default, RTL) and `en` (LTR).
- Choice stored in the `wijha-locale` cookie; switching does **not** change the URL (no `[locale]`
  segment). `lib/i18n/server.ts` reads it once per request with React `cache()`.
- Copy lives in `lib/i18n/dictionary.ts` (global) and `lib/i18n/pages.ts` (page-level, ~1,200
  lines). Server code uses `getI18n()`; client code uses `useI18n()` from the locale provider.
- `<html lang dir>` is set from the locale; Arabic is the default for SEO and first paint.
- Error messages are **codes**, localised at render time, so the same failure reads correctly in
  both languages.

### 11.4 Layouts

- Public shell: header (brand, nav, theme/language controls), footer, mobile bottom nav.
- Auth shell: centred card, minimal chrome.
- Protected shell: sticky header with role badge + profile + controls + logout; desktop sidebar and
  mobile bottom nav generated from the role's allowed routes; admins see everything.
- Loading/error/not-found are localised and styled (no default Next.js screens).

### 11.5 Accessibility & responsiveness

- Minimum 44px touch targets, visible focus rings, semantic landmarks, `aria-*` on toggles and
  status chips, `lang`/`dir` correctness, no horizontal overflow at 390px, reduced-motion respected
  by transitions.

---

## 12. Testing strategy

### 12.1 Unit tests (Vitest)

Four focused suites: `auth-errors`, `phone`, `resend-cooldown`, `site-url`. These cover pure logic
that is easy to regress: error-code mapping, E.164 phone normalisation, resend throttling, and
safe site-URL construction (open-redirect prevention).

### 12.2 E2E (Playwright)

`playwright.config.ts` is fully configured (desktop Chrome + Pixel 7 projects, HTML report,
trace on retry) and includes a hard guard: it refuses to run unless `E2E_ALLOWED_SUPABASE_URL`
matches the configured Supabase URL, which prevents accidentally running destructive tests against
production. Helpers in `tests/e2e/helpers/auth.ts` create/log in users.

**Current state:** the harness and helper exist, but there are **no committed `.spec.ts` files
yet** — E2E coverage is the next testing milestone (the manual checklists in `TESTING.md` cover the
flows meanwhile).

### 12.3 SQL test suites (`supabase/tests/`)

- `rls_negative_cases.sql` — asserts that the wrong role cannot read/write what it shouldn't
  (students can't see other students' bookings, owners can't approve units, etc.).
- `soft_delete_cases.sql` — deletion guards, `NOT_FOUND` for unauthorized callers, restore
  conflicts, uniqueness after delete.
- `staging-roles.sql` — seeds one user per role for manual/staging testing.
- `cleanup-e2e.sql` — removes E2E fixtures.

### 12.4 Manual QA

`TESTING.md` contains per-role checklists and known negative cases (double booking, gender
mismatch, expired payment, unauthorized restore, last-admin demotion). `TEAM_TESTING.md` is the
pack for the non-technical team.

### 12.5 Performance verification

`EXPLAIN_ANALYZE.md` records production read-only plans for the three hottest queries
(`unit_listings` by status, bookings by student+status, payments pending by booking). All use
index scans (bitmap index scans on `units_status_idx`, `bookings_status_created_at_idx`,
`payments_status_idx`); no sequential scans at current data volume.

---

## 13. Deployment & operations

### 13.1 Topology

```
GitHub (main) ──▶ Vercel (fra1) ──▶ Supabase (eu-central-1, Frankfurt)
                        │                     ├─ Postgres + RLS + RPCs
                        │                     ├─ Auth (email confirmation)
                        │                     └─ Storage (4 buckets)
                        └─ Vercel Cron ──▶ /api/cron/expire-payments
```

Region choice: Frankfurt is the closest stable region to Egypt for both Vercel and Supabase,
minimising round-trip latency for the mostly-Egyptian audience.

### 13.2 Environments

| Env | App | Supabase | Notes |
|---|---|---|---|
| Local | `next dev` | local or dev project | `.env.local` |
| Staging | Vercel preview/prod alias | **dev** project | `NEXT_PUBLIC_APP_ENV=staging` → test banner + noindex; Vercel Deployment Protection |
| Production | Vercel `main` | production project | real data, manual payments |

`docs/DEPLOY-STAGING.md` documents the exact steps (env vars, Supabase URL configuration,
deployment protection, project wake-up). `docs/ENVIRONMENT.md` is the no-secrets inventory.

### 13.3 Migrations

25 migrations applied chronologically. They are grouped by concern:

1. `20261103–20261105` — profiles, enums/helpers, settings/role profiles, inventory, visits/
   evaluations, bookings/payments, reviews/contracts/audit, storage, service-role grants.
2. `20261107` — soft delete (columns → indexes → functions → RLS → guards → review fixes →
   auth order).
3. `20261108` — profile soft-delete column, business RPCs, `create_unit`, dashboards/signup,
   admin bootstrap/find, admin hardening, atomic bootstrap, payment hardening, state machines +
   expiry.

Operational note: `20261108126000_payment_hardening.sql` and
`20261108127000_state_machines_and_expiry.sql` still need to be pushed to the remote project
(`npx supabase db push --remote --yes`) if that has not been done since the last code change.
Always push to staging first, run the SQL test suites, then production.

### 13.4 Cron

`vercel.json` pins the function region (`fra1`); the schedule itself is configured in the Vercel
project (or any external scheduler). The route rejects any request whose `x-cron-secret` header does
not match `CRON_SECRET`. The function is idempotent, so a retry is safe.

### 13.5 Incident checklist

1. Rotate the leaked secret (service role, cron, bootstrap, Supabase JWT) immediately.
2. Redeploy after changing `NEXT_PUBLIC_*`.
3. Check Supabase logs (Postgres + Auth + Storage) and Vercel function logs; actions log the real
   error server-side and return only stable codes.
4. For data issues, prefer RPCs/`restore_*` over raw SQL so audit + guards still apply.

---

## 14. Key design decisions & trade-offs

| Decision | Why | Cost |
|---|---|---|
| Business logic in Postgres RPCs | Atomicity, race safety, one authorization source, reusable from cron/service role | SQL is harder to unit-test than TS; needs migrations discipline |
| Thin Next.js action layer | Clear separation, stable error codes, easy to gate/rate-limit | Some duplication of role checks (intentional, defence in depth) |
| Roles in `profiles`, not JWT | Role changes take effect immediately; no stale-token privilege | One extra read per guard (cached per request) |
| Column-level grants + RLS | Prevents mass-assignment/self-promotion even if UI is bypassed | More verbose migrations |
| Soft delete everywhere | Financial history + undo + FK safety | Every query must filter `deleted_at`; retention job needed |
| Manual payments for MVP | No gateway chosen; avoids storing card data and compliance work | Admin toil; no automated reconciliation |
| Cookie locale, no URL prefix | Simple, no duplicate routes/SEO split, instant switch | Can't share a link that forces a language; SEO hreflang limited |
| `proxy.ts` refreshes but never redirects | Avoids auth loops and keeps callback reachable | Each page must guard itself (done via layouts) |
| Snapshot commission per booking | Rate changes never rewrite history | Slight denormalisation |
| No ORM | Full SQL control, typed client, fewer deps | Manual `database.types.ts` maintenance |

---

## 15. Known gaps & next steps

**Must-do before real launch**

- Replace the placeholder `platform_settings.gateway_fee_rate` (1.5%) with the real provider rate.
- CAPTCHA is implemented in the app but stays off until the Turnstile keys are added (site key in
  Vercel, secret in Supabase) **and the build that renders the widget is deployed** — enabling it
  against an older deployment would reject every sign-in.
- Deploy the current build: production still serves a pre-2026-11-13 build, so `/forgot-password`,
  `/reset-password` and `/auth/reset` return 404 there.
- Add a retention/cleanup job for `unit-photos` of soft-deleted units (files are not deleted today).

**Product decisions still open**

- Commission value governance (who can change it, audit trail is there via `platform_settings`).
- Matching weights and mandatory traits.
- Student-to-student rating rules (who rates whom, visibility, moderation).
- External contract template + who prepares it.
- Dispute process and evidence handling.

**Engineering backlog**

- Real payment gateway (Egyptian licensed provider) with webhooks → replace manual confirm and
  make refund execution automatic; `gateway_event_id` is already reserved for idempotency.
- Automated owner payouts/settlement ledger.
- Contract PDF generation and e-signature.
- Notifications (email/push) for booking/payment/visit events.
- Observability: structured logs, error tracking, cron alerting.
- Write the missing Playwright specs (the harness exists but has no `.spec.ts` files): auth,
  booking → payment → contract, role guards, and the negative cases already listed in `TESTING.md`.
- Expand unit tests around action schemas.
- Consider generated DB types (`supabase gen types`) instead of the hand-maintained file.

---

## 16. Technical Q&A bank

Short, interview-ready answers. Each one maps to a section above.

**Q: What is WIJHA in one sentence?**
An Arabic-first student-housing marketplace where WIJHA acts as the middleman between students and
owners — handling discovery, verification, booking, payment, commission, and contracts.

**Q: What's the stack?**
Next.js 16 App Router + React 19 + TypeScript 6 + Tailwind 4, Supabase (Postgres/Auth/Storage),
Zod, Vitest + Playwright, deployed on Vercel `fra1` with Supabase in `eu-central-1`.

**Q: Why Next.js App Router?**
Server Components let us read from Supabase on the server without shipping data-fetching code to
the browser; Server Actions give typed, colocated mutations; layouts give per-role shells; and
`proxy.ts` handles session refresh in one place.

**Q: Where does business logic live?**
In Postgres `SECURITY DEFINER` RPCs. The Next.js actions validate input, gate the role, rate-limit,
and call the RPC. The DB owns transactions, locks, invariants, and state machines.

**Q: Why not put logic in Server Actions?**
Two reasons: race safety (row locks + partial unique indexes must be in the same transaction as the
write) and a single authorization source that also works for cron/service-role and future
integrations. Actions alone cannot guarantee atomic inventory updates.

**Q: How do you prevent double booking?**
`create_booking` locks the unit/room/bed rows `FOR UPDATE`, checks availability inside the
transaction, and partial unique indexes on active bookings per bed/room act as the final guard.
The loser gets `BED_UNAVAILABLE`/`CONFLICT`.

**Q: How is authorization enforced?**
Two layers: `guardAction({ roles })` in every Server Action, and RLS + ownership checks inside every
RPC. Roles are read from `profiles`, never from `user_metadata`.

**Q: Why not trust `user_metadata.role`?**
Users can edit their own metadata at signup. The trigger clamps it to `student`/`owner`, and all
authorization reads `profiles.role`, which is only writable via `admin_set_user_role`.

**Q: How does RLS work here?**
RLS is on every table. Policies use `(select auth.uid())` for a per-statement initplan, and helpers
like `private.has_role()` / `private.is_leader_or_admin()` resolve roles from `profiles`. `anon`
sees only approved public data.

**Q: What are column-level grants for?**
They stop mass-assignment: e.g. users can update profile descriptors but not `role` or
`verification_status`; bookings/payments are select-only and mutate through RPCs.

**Q: What is `SECURITY DEFINER` and why use it?**
It runs the function with the definer's privileges, so the function can perform controlled writes
the caller cannot do directly. Every function sets `search_path = ''` and fully qualifies names to
avoid hijacking.

**Q: How do you keep money consistent?**
Integer piastres (no floats), `total_amount_piastres` generated from rent + commission, commission
snapshotted per booking with a check constraint, payment financial fields immutable after insert,
and every status change appended to `payment_events`.

**Q: What's the payment flow today?**
Manual: booking creates a pending payment with a 7-day expiry; an admin confirms with a receipt
reference from `/admin/payments`. A cancellation inside the refund window marks the payment
`refund_pending` with the exact amount after the gateway fee; the admin transfers the money and
confirms it (`confirm_booking_refund`) or declines it. A cron expires stale pending payments and
cancels their bookings. No card data is ever stored.

**Q: How does the expiry cron work?**
`/api/cron/expire-payments` checks `x-cron-secret` against `CRON_SECRET`, then uses the service-role
client to call idempotent `expire_pending_payments()`, which marks payments `expired`, cancels
bookings, and frees beds.

**Q: Why soft delete instead of hard delete?**
Bookings/payments/contracts reference inventory with `on delete restrict`; deleting physically would
break financial history. Soft delete gives undo, keeps references valid, and lets partial unique
indexes allow name reuse. Only 5 delete RPCs are exposed; restore is admin-only.

**Q: How do you avoid leaking existence of other users' rows?**
Unauthorized soft-delete calls return `NOT_FOUND` rather than `FORBIDDEN`, so an attacker cannot
distinguish "doesn't exist" from "not yours".

**Q: How is gender separation enforced?**
`units.gender_type` must equal `student_profiles.gender` inside `create_booking`, plus RLS/listing
filters. A trigger blocks changing a unit's gender while it has active bookings. It is a DB rule,
not a UI rule.

**Q: How does the state machine work?**
Each entity has an allowed transition set enforced both in RPC logic and in triggers. Illegal
transitions raise `INVALID_STATE`, so even direct SQL cannot skip steps (e.g. refund an unpaid
payment, cancel a completed booking).

**Q: How does the app handle errors?**
RPCs raise stable codes; `toErrorCode()` maps them (with SQLSTATE fallbacks) to a closed set in
`lib/errors.ts`; the UI localises the code. Raw DB messages never reach the browser; they are
logged server-side.

**Q: How does authentication/session work?**
Supabase Auth with `@supabase/ssr` cookie sessions. `proxy.ts` refreshes the cookie and calls
`auth.getUser()` on every request. Layouts call `requireUser()` / `requireRole()`. The proxy never
redirects, which keeps `/auth/callback` reachable and avoids loops.

**Q: Why is `/auth/confirm` still there?**
Backward compatibility: emails sent before the callback moved still point to it. It forwards the
query string to `/auth/callback`, which owns the code exchange and role-based redirect.

**Q: How does i18n work without URL prefixes?**
Locale lives in the `wijha-locale` cookie, read once per request via React `cache()`. Copy is typed
in `dictionary.ts`/`pages.ts`. `<html lang dir>` is derived from it. Trade-off: no language-specific
shareable URLs.

**Q: How does dark mode avoid a flash?**
A pre-paint inline script applies `html.dark` from `localStorage` before React hydrates; tokens are
overridden under `html.dark`, so all utilities adapt without per-component logic.

**Q: What's the security header setup?**
CSP (self + Supabase origins, `frame-ancestors 'none'`, `form-action 'self'`), HSTS with preload,
`nosniff`, `DENY` framing, referrer and permissions policies, and `no-store` on authenticated
responses. `robots.ts` disallows everything until public launch.

**Q: How is rate limiting implemented?**
It counts recent `audit_logs` rows per actor/action in a time window (`isRateLimited`) through the
`SECURITY DEFINER` RPC `count_my_recent_actions`, which only ever counts the caller's own rows. It
is durable across redeploys because it lives in Postgres. Because the RPC bypasses the admin-only
`audit_logs` select policy without exposing the table, the limiter works for every role —
students, owners and admins (verified on the remote project by calling it as an `authenticated`
non-admin). Note that the counter advances on **committed** actions, since the audit row is written
inside the same transaction as the write it limits; failed attempts roll back with it.

**Q: How is the first admin created safely?**
`/admin/bootstrap` requires `BOOTSTRAP_ADMIN_SECRET`; `claim_first_admin(p_actor)` takes an advisory
lock, verifies there are zero admins, then promotes the caller. The advisory lock makes concurrent
claims atomic. `admin_set_user_role` refuses to demote the last admin.

**Q: How do you test security?**
Three layers: SQL negative-case suites (`rls_negative_cases.sql`, `soft_delete_cases.sql`), unit
tests for auth/phone/URL logic, and a Playwright setup guarded by `E2E_ALLOWED_SUPABASE_URL` so it
can never run against production. Honest caveat: the Playwright harness is configured but the spec
files are not written yet; security-critical assertions live in the SQL suites today.

**Q: What are the performance hotspots?**
Approved listing scans, bookings by student+status, and pending payments by booking. All three are
covered by indexes and verified with `EXPLAIN ANALYZE` (bitmap index scans, no seq scans at current
volume).

**Q: What would you do differently at 10× scale?**
Move listing/rating aggregates to materialized views or a cache, add read replicas for explore,
partition `audit_logs`/`payment_events` by month, add a queue for notifications and payouts, and
introduce generated DB types plus contract tests around RPCs.

**Q: What's the biggest current risk?**
Manual payments: reconciliation depends on an admin and there is no gateway webhook. It is an
explicit MVP trade-off, and `gateway_event_id` + `payment_events` are already in place to make the
switch to a gateway idempotent and auditable.

**Q: What's intentionally missing from v1?**
AI evaluation, VIP tier, automated gateway/payouts, dispute workflow, notifications, and
student-to-student rating rules (schema exists, policy pending).

---

## 17. Glossary (AR/EN)

| Term | Arabic | Meaning |
|---|---|---|
| Unit | وحدة | An apartment/property listed by an owner |
| Room | غرفة | A room inside a unit |
| Bed | سرير | The rentable inventory unit; rent is per bed by default |
| Visit | زيارة | Field-team inspection of a unit |
| Evaluation | تقييم | Score + checklist + photos recorded after a visit |
| Booking | حجز | A student's reservation of a bed or whole room |
| Commission | عمولة | WIJHA's cut, default 15%, snapshotted per booking |
| Deposit | مقدم | Partial upfront payment option |
| Contract | عقد | Agreement between the parties, tracked by status |
| Soft delete | حذف ناعم | Marking `deleted_at` instead of removing the row |
| RLS | أمان الصفوف | Postgres Row Level Security |
| RPC | دالة قاعدة بيانات | `SECURITY DEFINER` SQL function called from the app |
| Guard | حماية | Server-side auth/role check before an action |

---

## 18. File map for deep dives

| Question | Start here |
|---|---|
| Backend rules & doctrine | `BACKEND.md` |
| Product scope, open decisions, progress | `CLAUDE.md` |
| QA checklists | `TESTING.md`, `docs/TEAM_TESTING.md` |
| Env vars / accounts | `docs/ENVIRONMENT.md` |
| Staging deploy | `docs/DEPLOY-STAGING.md` |
| Email/SMTP setup | `docs/EMAIL_SETUP.md` |
| Schema & all logic | `supabase/migrations/*.sql` |
| Core RPCs | `…20261108120000_booking_payment_contract_review_rpcs.sql` |
| Payment hardening | `…20261108126000_payment_hardening.sql` |
| State machines + cron | `…20261108127000_state_machines_and_expiry.sql` |
| Action pipeline / errors | `lib/action-pipeline.ts`, `lib/errors.ts`, `lib/action-errors.ts` |
| Auth guards | `lib/auth/*`, `app/(protected)/layout.tsx` |
| Supabase clients | `lib/supabase/*`, `proxy.ts` |
| Read models | `features/*/queries.ts`, `features/admin/admin-data.ts` |
| Copy | `lib/i18n/dictionary.ts`, `lib/i18n/pages.ts` |
| Types | `types/database.types.ts` |
| Performance evidence | `EXPLAIN_ANALYZE.md` |
| Tests | `tests/`, `supabase/tests/` |
