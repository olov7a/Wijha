# BACKEND.md — Wijha Backend Reference

Stack: **Next.js (App Router) + Supabase (Postgres, Auth, Storage, RLS)**.
Priorities, in this order: **1) Security 2) Logical correctness 3) Response speed.**
Any developer or AI agent (Claude Code, etc.) must read this file before touching backend code, and must follow it over personal preference.

---

## 0. Golden Rules (never break)

1. **Never trust the client.** Every check (who are you, what are you allowed to do, is this input valid) is repeated on the server and in the database.
2. **RLS is ON for every table in `public`.** A table without RLS is a public table.
3. **The `service_role` key never reaches the browser.** It lives only in server-only files.
4. **Business rules live on the server / in the database.** The UI only displays and asks; it never decides.
5. **Validate every input** with a schema (zod) before using it.
6. **Multi-step writes are atomic** (one Postgres function / transaction), never several separate calls from the client.
7. **Ask the database for exactly what you need**: specific columns, filtered, paginated.
8. **Schema changes go through migration files** in `supabase/migrations`, never by clicking in the dashboard on production.

---

## 1. Architecture & Data Flow

```
Browser ──► Next.js (Server Components / Server Actions / Route Handlers)
                 │   1. authenticate  (supabase.auth.getUser)
                 │   2. validate      (zod)
                 │   3. authorize     (ownership / role)
                 ▼
            Supabase Postgres  ──  RLS policies  ──  constraints  ──  RPC functions
```

- **Reads** → Server Components (fast, no extra client JS).
- **Writes** → Server Actions or Route Handlers only.
- Client-side Supabase (`createBrowserClient`) is allowed only for things RLS fully protects (e.g. realtime on the user's own rows). When in doubt, go through the server.

### Folder layout

```
features/<feature>/  # actions, queries, service, schemas, types, components
lib/
  supabase/
    client.ts        # browser client (publishable key, RLS-protected)
    server.ts        # server client (publishable key + user's cookies)
    middleware.ts    # session-refresh helper called by proxy.ts
    admin.ts         # service_role client — import 'server-only', rarely used
  auth/              # getCurrentUser / requireUser / requireRole
  env.ts             # public env validation (NEXT_PUBLIC_* only)
  env.server.ts      # server-only secrets (service_role)
  errors.ts          # shared error codes
  result.ts          # { ok: true, data } | { ok: false, error }
app/
  actions/           # server actions (thin: auth → validate → call service)
proxy.ts             # refreshes the session cookie (Next 16 replaces middleware.ts)
types/
  database.types.ts  # generated Supabase types
supabase/
  migrations/        # every schema change, in order
```

---

## 2. Security

### 2.1 Secrets & environment variables

| Variable | Where it may be used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | anywhere (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anywhere (public, safe **only because of RLS**; older projects call it the anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only**, never prefixed with `NEXT_PUBLIC_` |

- `.env.local` must be in `.gitignore`. If a secret was ever committed, **rotate it** (deleting the commit is not enough).
- The admin client must refuse to load in the browser:

```ts
// lib/supabase/admin.ts
import 'server-only'; // build fails if a client component imports this file
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseConfig } from '@/lib/env';
import { getServerEnv } from '@/lib/env.server';

const { url } = requireSupabaseConfig();
const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

export const supabaseAdmin = createClient(url, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
```

`lib/env.ts` validates `NEXT_PUBLIC_*` once, and `lib/env.server.ts` validates server secrets lazily so a missing key only breaks the admin paths that need it.

`service_role` **bypasses RLS completely**. Use it only for jobs that truly have no user (webhooks, cron). If you use it, you must do the authorization checks by hand.

### 2.2 Authentication

- Use `@supabase/ssr`. The session lives in cookies, refreshed by `proxy.ts` (Next 16's name for middleware).
- On the server always use **`supabase.auth.getUser()`**. It asks the Auth server to verify the token. Do **not** trust `getSession()` for authorization, because it only reads the cookie without verifying it.

```ts
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies(); // Next 15+. On Next 14 remove `await`.
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch { /* called from a Server Component; middleware handles refresh */ }
        },
      },
    }
  );
}
```

### 2.3 Row Level Security (the real wall)

Every table: enable RLS, then write the **minimum** policies. No policy = no access (safe default).

```sql
alter table public.bookings enable row level security;

-- a user can read only their own rows
create policy "read own bookings"
on public.bookings for select
to authenticated
using ( (select auth.uid()) = user_id );

-- a user can insert only rows that belong to them
create policy "insert own bookings"
on public.bookings for insert
to authenticated
with check ( (select auth.uid()) = user_id );
```

- `using` = which existing rows you may see/change. `with check` = what the new row must look like.
- Write `(select auth.uid())` instead of bare `auth.uid()`: Postgres evaluates it **once** instead of once per row (faster).
- Never write `using (true)` on a table with private data.
- Roles (admin, owner…) are stored in a table or in `app_metadata` (server-controlled). **Never** read roles from `user_metadata`, because the user can edit it.

### 2.4 Input validation (zod)

```ts
// lib/validation/booking.ts
import { z } from 'zod';

export const createBookingSchema = z.object({
  placeId: z.string().uuid(),
  startsAt: z.coerce.date(),
  guests: z.number().int().min(1).max(20),
  note: z.string().trim().max(500).optional(),
});
```

- Validate type, range, and length. Use `.strict()` when extra fields must be rejected.
- Never build SQL by concatenating strings. The Supabase client parametrizes queries; keep it that way. For raw SQL use RPC functions with typed arguments.

### 2.5 Authorization on the server

Authentication = **who** you are. Authorization = **what** you may do. RLS covers it in the DB, but check in the server action too, so you return a clean error and never rely on a single layer (defense in depth).

### 2.6 Server Action template (use this for every write)

```ts
// app/actions/create-booking.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { createBookingSchema } from '@/lib/validation/booking';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createBooking(input: unknown): Promise<Result<{ id: string }>> {
  const supabase = await createClient();

  // 1) authenticate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'UNAUTHENTICATED' };

  // 2) validate
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID_INPUT' };

  // 3) do the work atomically inside the database (see section 4.3)
  const { data, error } = await supabase.rpc('create_booking', {
    p_place_id: parsed.data.placeId,
    p_starts_at: parsed.data.startsAt.toISOString(),
    p_guests: parsed.data.guests,
  });

  // 4) never leak internals to the client
  if (error) {
    console.error('create_booking failed', error); // full detail in server logs only
    return { ok: false, error: 'COULD_NOT_CREATE' };
  }
  return { ok: true, data: { id: data } };
}
```

Order is fixed: **authenticate → validate → authorize/execute → sanitized error.**

### 2.7 Rate limiting & abuse

- Login, signup, password reset, OTP: rely on Supabase Auth's built-in limits and enable CAPTCHA (Turnstile/hCaptcha) in Auth settings.
- Any custom public endpoint (contact form, search): add a rate limit (e.g. Upstash Ratelimit keyed by user id or IP).

### 2.8 Security headers

```js
// next.config.js
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];
module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

Add a `Content-Security-Policy` once the list of third-party scripts is known.

### 2.9 Storage

- Buckets are **private by default**. Public only for truly public assets (e.g. place photos).
- Policies on `storage.objects` restrict who can upload/read, and file paths start with the user id (`{user_id}/file.jpg`) so policies can check it.
- `unit-photos` stays public-read for now, so every path must start with the unit UUID (`{unit_id}/{uuid}.{ext}`). Never use a guessable or sequential filename. Because public URLs bypass RLS, a retention job must delete the files of soft-deleted units; removing the DB row alone does not revoke the image.
- Validate file type and size on the server before upload.

### 2.10 Errors & logging

- Client receives short codes (`UNAUTHENTICATED`, `INVALID_INPUT`, `NOT_FOUND`…), never stack traces, SQL errors, or table names.
- Never log passwords, tokens, or full request bodies.

---

## 3. Speed (Response Time)

### 3.1 Query rules

- **Select only the columns you need**, never `select('*')` on big tables.
- **Always paginate** lists (`.range(from, to)` or cursor with `.lt('created_at', last)`), with a hard maximum page size.
- **Filter and sort in the database**, not in JavaScript.
- **Avoid N+1**: fetch related rows in one query with a relation, not one query per row.

```ts
// one round trip: bookings + their place name, 20 at a time
const { data } = await supabase
  .from('bookings')
  .select('id, starts_at, status, place:places(id, name)')
  .order('starts_at', { ascending: false })
  .range(0, 19);
```

### 3.2 Indexes

An index is like a book's table of contents: Postgres jumps to the rows instead of reading the whole table.

Add an index for every column used in **WHERE, JOIN, ORDER BY**, and for every column used inside an **RLS policy** (e.g. `user_id`). Foreign keys are **not** indexed automatically in Postgres.

```sql
create index bookings_user_id_idx on public.bookings (user_id);
-- common query: "my bookings, newest first"
create index bookings_user_starts_idx on public.bookings (user_id, starts_at desc);
```

Do not index everything: each index slows writes and takes space. Index what real queries use. Check with `explain analyze` and Supabase's Query Performance report.

### 3.3 Caching

- Public data that rarely changes (places list, categories): cache with `export const revalidate = 60` on the page/route, or tag-based revalidation after a write.
- **Never cache user-specific data in a shared cache** (one user could see another's data).
- After a write, call `revalidatePath` / `revalidateTag` for the pages affected.

### 3.4 Parallel fetching

Independent queries run together, not one after another:

```ts
const [places, categories] = await Promise.all([getPlaces(), getCategories()]);
```

### 3.5 Server vs Client components

Fetch in Server Components (no JS shipped, data next to the DB). Use `'use client'` only for interactivity. Smaller client bundle = faster first load.

### 3.6 Infrastructure

- Deploy the Next.js app in the **same region** as the Supabase project (avoids cross-ocean latency on every query).
- Use Supabase's pooled connection string for serverless environments.
- Images: use `next/image`, correct sizes, and Supabase image transformations for thumbnails.

---

## 4. Logic & Data Integrity

### 4.1 Single source of truth

Rules such as "can this be booked?", "what is the price?", "who may cancel?" are decided **on the server/database only**. The client may repeat a check for nicer UX, but the server decision is final. Prices and totals are **always recomputed on the server**, never taken from the request.

### 4.2 Let the database enforce the rules

Constraints cannot be bypassed by a bug in the app:

```sql
create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  place_id    uuid not null references public.places(id),
  starts_at   timestamptz not null,
  guests      int  not null check (guests between 1 and 20),
  status      text not null default 'pending'
              check (status in ('pending','confirmed','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

- `NOT NULL` for required fields, `CHECK` for ranges and allowed values, `UNIQUE` for no duplicates, `FOREIGN KEY` for no orphan rows.
- Use `timestamptz` (stored in UTC), never `timestamp`. Convert to the user's timezone only when displaying.

### 4.3 Atomic operations (all-or-nothing)

When one action changes several things (check availability + create booking + reduce a counter), do it in **one Postgres function**. Either everything happens or nothing does.

```sql
create or replace function public.create_booking(
  p_place_id uuid, p_starts_at timestamptz, p_guests int
) returns uuid
language plpgsql
security invoker              -- runs with the caller's permissions, so RLS still applies
set search_path = ''          -- prevents search_path hijacking
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- lock the place row so two people cannot book the same slot at the same time
  perform 1 from public.places where id = p_place_id for update;

  if exists (
    select 1 from public.bookings
    where place_id = p_place_id
      and starts_at = p_starts_at
      and status <> 'cancelled'
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  insert into public.bookings (user_id, place_id, starts_at, guests)
  values ((select auth.uid()), p_place_id, p_starts_at, p_guests)
  returning id into v_id;

  return v_id;
end;
$$;
```

> Adapt table/column names to the real schema. The pattern matters: **lock → check → write, in one function.**

### 4.4 Race conditions & duplicates

- Never do "read, decide in JS, then write". Between the read and the write, someone else can change the data. Use a constraint (`UNIQUE`), `INSERT ... ON CONFLICT`, or a locked function (4.3).
- Make retried requests safe (idempotency): a double click or network retry must not create two records.

### 4.5 Status transitions

Define allowed moves once and enforce them on the server:

```
pending ──► confirmed ──► (done)
   └──────► cancelled
```

A `cancelled` row can never go back to `confirmed`. Reject any transition not in the list.

### 4.6 Consistent responses

Every server action returns the same shape: `{ ok: true, data } | { ok: false, error: CODE }`. The UI maps codes to messages, so logic never depends on parsing error text.

### 4.7 Soft delete (business data)

Deleting business data is a **state change**, not a `DELETE`. Never call `.delete()` or `DELETE FROM` on a business table.

- Add `deleted_at timestamptz` (nullable, default `null`) to every business table: `units`, `rooms`, `beds`, `unit_visits`, `unit_evaluations`, `reviews`, `bookings`, `payments`, `contracts`. Logs and technical tables are excluded.
- Delete only through a Postgres function (`soft_delete_<entity>`): it sets `deleted_at = now()` and handles children in the **same transaction**. Structural children (rooms/beds under a unit) are soft-deleted with the parent and share its deletion timestamp, so a restore reopens only what that cascade closed.
- Exposed delete/restore RPCs: `units`, `rooms`, `beds`, `unit_visits`, `reviews`. `unit_evaluations` follows its visit. `bookings`, `payments`, `contracts` get the column for server-side retention jobs only.
- Refuse to delete a parent while active business children exist (e.g. `ACTIVE_BOOKINGS`); never orphan or silently cancel them. A unit with a **future scheduled visit** returns `HAS_UPCOMING_VISITS` and those visits are never cascade-deleted.
- A delete or restore RPC returns `NOT_FOUND` both when the row is missing and when the caller is not allowed to touch it. Never return `FORBIDDEN` there, because that would confirm the row exists. Run that authorization check **before** the "already deleted / already active" no-op, otherwise an unauthorized caller can tell a deleted row apart from a missing one.
- Every non-admin RLS `SELECT` policy adds `deleted_at is null`, so normal users never see deleted rows. Admins get one extra `SELECT` policy per table and the only restore path.
- Replace business `UNIQUE` constraints/indexes with **partial unique indexes** that ignore deleted rows: `create unique index ... where deleted_at is null`. Exception: payment gateway reference/event idempotency keys stay global, because a soft-deleted payment is still a real gateway event that must not be replayed.
- Index `deleted_at` where lists filter on it.
- Admin restore can fail if a new active row now uses the same unique name/label. The whole restore transaction rolls back and the RPC returns `RESTORE_CONFLICT`; the admin UI should show a clear "another active record already uses this value" message. Never delete those new rows to force a restore.
- Hard delete is allowed only for retention expiry or legal erasure, through an approved admin/retention job — never from normal app code. The same job must delete the `unit-photos` objects of soft-deleted units, because the bucket is public-read.
- Test as a normal authenticated user: deleted rows disappear, cross-user access is still blocked, and restore stays admin-only.

---

## 5. Migrations & Types

- Create: `supabase migration new add_bookings_table` → write SQL → `supabase db push --remote` (or apply via CI).
- Generate the full types only **after** the migrations have been applied to a **dev** database: `supabase gen types typescript --project-id <dev-ref> > types/database.types.ts`, and pass `Database` to the clients so queries are type-checked.
- Never edit an old migration that has been applied. Add a new one.

---

## 6. Definition of Done (checklist for every new feature)

**Security**
- [ ] RLS enabled on every new table, with minimum policies
- [ ] Policies tested as 2 different users (user A cannot see/change user B's data)
- [ ] Input validated with zod
- [ ] Server action checks `getUser()` first
- [ ] No secret or `service_role` usage in client code
- [ ] Errors return codes, not internals

**Logic**
- [ ] Rules enforced in DB (constraints) or RPC, not only in the UI
- [ ] Multi-step writes are atomic
- [ ] Double submit / concurrent requests cannot create bad data
- [ ] Status transitions enforced
- [ ] Deletes are soft (`deleted_at`), performed by an RPC, with children handled in one transaction
- [ ] RLS hides deleted rows; restore is admin-only
- [ ] Business unique rules use partial indexes (`where deleted_at is null`); payment gateway idempotency keys stay global

**Speed**
- [ ] Selects only needed columns, paginated, no N+1
- [ ] Indexes for filters, joins, ordering, and RLS columns
- [ ] Independent queries use `Promise.all`
- [ ] Cache only public data; revalidate after writes

**Housekeeping**
- [ ] Migration file added, types regenerated
- [ ] This file updated if a rule changed

---

## 7. Project Data Model (fill in)

> القاعدة فعلًا بعد الـ migrations في `supabase/migrations`. كل الجداول عليها RLS، والكتابة عبر RPCs بس.

| Table | Purpose | Owner column | Read | Write |
|---|---|---|---|---|
| `profiles` | هوية المستخدم | `id` | owner/staff | owner: full_name, phone فقط |
| `student_profiles` | بيانات طالب | `user_id` | owner/staff | owner |
| `owner_profiles` | بيانات مالك | `user_id` | owner/staff | owner |
| `units` / `rooms` / `beds` | مخزون السكن | `owner_id → unit_id → room_id` | public approved + owner + staff | owner (create), leader (status), RPCs للحذف |
| `unit_visits` / `unit_evaluations` | زيارات المعاينة والتقييمات الميدانية | `team_member_id` / `unit_id` | team assigned + owner + leader/admin | leader يجدول، team يقيّم مرة واحدة لكل زيارة |
| `bookings` | حجوزات | `student_id` | student + owner + staff | `create_booking` / `cancel_booking` RPC فقط |
| `payments` | مدفوعات (piastres + currency) | `booking_id` | student + owner + staff | `confirm/fail/refund` RPC فقط؛ محمية بالـ trigger و`payment_events` |
| `payment_events` | سجل append-only لكل تغيير حالة دفع | `booking_id` | admin | triggers فقط |
| `reviews` | تقييمات الطلاب | `reviewer_id` | public approved + owner + staff | الطالب يضيف pending، الأدمن يفعّل |
| `contracts` | عقود الإيجار | `booking_id` | student/owner/staff | `request_contract` (student/owner/admin) + `sign_contract` (admin) |
| `audit_logs` | سجل append-only | `actor_id` | admin فقط | RPCs/triggers |
| `platform_settings` | عمولة المنصة وتحويلها | — | server/service_role | service_role |
