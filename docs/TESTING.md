# TESTING — Wijha staging scenarios

Run against staging (or the dev Supabase-backed local build). Use fake data only.
Each scenario: **Steps** → **Expected result**.

## 1. Student (student-e2e@example.com)

1. Open `/signup` → fill name, phone `01012345678`, gender, university, year → create account.
   - **Expected**: redirected to `/check-email?email=...` ("Check your email") with a Resend button (60-second cooldown). Click the inbox link to confirm, then login.
2. Login → `/student` shows bookings (empty initially).
   - **Expected**: no crash, phone saved as E.164 (`+2010...`) visible in `/profile`.
3. `/explore` → open a unit → `/book/{id}` → pick a bed and date → submit.
   - **Expected**: booking appears in `/student` as `pending_payment`.
4. Try to open `/admin`.
   - **Expected**: redirected to `/dashboard` (no admin content).

## 2. Owner (owner-e2e@example.com)

1. Login → `/owner` shows your units.
2. `/owner/units/new` → create unit (title, area, gender, 1 room, 2 beds) + upload photos.
   - **Expected**: unit shows `pending` in `/owner`.
3. Leader approves (`/leader` with leader role or admin role swap), then explore shows it.
4. Check bookings: see student name/phone via `owner_bookings`.

## 3. Admin (admin-e2e@example.com)

1. Login → `/admin` shows real counts, not sample data.
2. `/admin/payments` → confirm / fail / refund / sign contract → booking status moves accordingly.
3. Promote a fresh account (Search by email) → role changes immediately.

## 4. Security-minded tester (try to break it)

- **Cross-user reads**: keeping dev keys in hand, call:
  ```
  GET {SUPABASE_URL}/rest/v1/bookings?select=*  (with student session)
  GET {SUPABASE_URL}/rest/v1/bookings?select=*  (with anon key — no session)
  ```
  - **Expected**: student sees only their own rows; anon sees none.

- **Role change**: PATCH profile to change `role` to `owner`.
  - **Expected**: `403/42501` (database refuses field).

- **Payment writes**: POST/UPDATE directly on `payments`.
  - **Expected**: fails `42501` (payments are admin/RPC only).

- **Upload**: try booking payload as `owner`. Try (`20099` reference) same reference twice.
  - **Expected**: second attempt fails `23505` / idempotent.

## 5. Mobile / slow network

- Open `/login`, `/signup`, `/explore`, `/student` on throttled network (Slow 3G).
  - **Expected**: no horizontal scroll, buttons stay enabled after the request finishes, no console errors after initial load.

---

## Bug report template

```text
Title:
Account / role:
Steps: 1) 2) 3)
Expected:
Actual:
Screenshot:
Device / browser:
Severity: P0 / P1 / P2
```
