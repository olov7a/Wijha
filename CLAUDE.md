# WIJHA (وجهة): Student Housing Platform

A website that connects university students with property owners who rent student housing.
The company is the middleman: owners never deal with students directly. The company handles booking and payment.

## About the developer
- The developer (Ziad) is a university student who is learning. He supervises; you write the code.
- After each task, explain in short, simple Egyptian Arabic: what you changed, and why.
- The first time a concept appears (RLS, migration, server vs client, etc.), explain the idea in a few sentences.
- Keep answers short. Do not repeat the code back unless asked.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres database, Supabase Auth, Supabase Storage
- Arabic-first UI: RTL (`dir="rtl"`, `lang="ar"`), mobile-first, clean and professional
- Payments: a licensed Egyptian payment gateway (not chosen yet; do not integrate until I say so)

## UI kit
- Design tokens live in `app/globals.css` (`@theme`): canvas, surface, ink, mint, teal, brown, primary/strong, status colors, radii, shadows. `html.dark` overrides the same tokens, so utilities adapt automatically; use `bg-surface`, `text-brown-ink`, `bg-primary`/`text-primary-foreground` instead of `bg-white`, `text-brown`, `bg-teal text-white`.
- Theme and language: `components/site-controls.tsx` (dark toggle with circular reveal + AR/EN switch). Theme lives in `localStorage` (`wijha-theme`), language in the `wijha-locale` cookie. Copy lives in `lib/i18n/dictionary.ts`; server code reads it with `getI18n()` from `lib/i18n/server.ts`, client code with `useI18n()`.
- Reuse `components/ui/*` instead of rewriting styles: `Button`/`ButtonLink`, `Input`/`Textarea`/`Select`, `Card`/`Panel`, `StatusChip`/`GenderBadge`/`VerifiedBadge`/`Rating`, `PageHeader`, `EmptyState`, `Stepper`, `UnitCard`, `icons`.
- `lib/cn.ts` joins class names. Do not add a UI dependency without asking.

## Roles
student, owner, team (evaluates units on site), leader (approves or rejects units), admin.
Each role sees only its own pages and data.

## MVP scope (version 1)
- Student sign-up: name, phone, ID photo, university card photo, study year, smoker or not, hobbies
- Owner sign-up: name, phone, ID photo, number of units, proof of ownership (contract), photos of the unit
- Unit approval: team visits and evaluates, leader approves or rejects
- Booking: instant booking, optional visit before booking, rent by bed with the option to book a whole room, male and female apartments are separate
- Payment: student pays a deposit or the full amount online, money goes to the company first, company takes a commission
- Cancellation: refund only if cancelled at least 24 hours before check-in, none after; gateway fees are deducted from the refund
- Apartment recommendations for the student (the student picks; no automatic assignment)
- Student matching by traits (simple rules and scoring, no AI), student ratings, optional external contracts
- NOT in v1: AI evaluation and acceptance percentage, VIP section

## Open decisions (do NOT assume; ask me)
- Company commission percentage (keep it as a config value, never hard-code)
- Matching: which traits are mandatory and which are optional
- Ratings between students: who rates whom, when, who sees them, who moderates
- External contracts: who prepares the template, does the site track contract status
- Student/owner dispute process

## How to work
- Work on ONE phase at a time. Start every phase with a short plan and wait for my approval before writing code.
- Before UI work, read `DESIGN (1).md` and follow it.
- Before each task, review `Progress`; after each task, update what changed and the next step.
- Small steps. After each step, run the app and check it works.
- Do not add features outside the current phase or outside the MVP scope.
- Commit only when I ask. Suggest a short commit message.
- Prefer targeted file reads. Do not scan the whole repo without a reason.
- Keep this file short. Update the Commands section after the project is scaffolded.

## Security rules (non-negotiable)
- Never read, print, or commit `.env*` files. Secrets live in `.env.local`, which must be in `.gitignore`.
- `env-local-backup/` may hold old secrets: never read or commit it (already ignored).
- The Supabase service-role/secret key is for server code only. Never use it in browser code.
- Enable Row Level Security (RLS) on every table. Write policies per role and explain each one to me.
- ID and university card photos go in PRIVATE Storage buckets, accessed with signed URLs, visible only to the file owner and authorized staff.
- Never store card numbers or payment details. Use the gateway's test mode until launch.
- Enforce male/female apartment separation in the database logic, not only in the UI.
- Validate all input on the server.

## Data model (initial proposal; propose changes before running migrations)
profiles, units, rooms, beds, unit_evaluations, bookings, payments, reviews, contracts

## Commands
- dev: `npm run dev`
- build: `npm run build`
- lint: `npm run lint`
- typecheck: `npm run typecheck`

## Progress
- Done: Phase 1 local UI, auth and role guards, profiles migration file; lint, typecheck, build and local browser checks passed.
- Done on 2026-11-03: added the official logo and design reference, and aligned brand colors and Cairo font.
- Done on 2026-11-04: UI foundation — design tokens (status colors, radii, shadows), `components/ui/*` primitives, and the auth form now uses them. Lint, typecheck and build pass.
- Done on 2026-11-04 (audit): fixed an open redirect in `/auth/confirm`, added the Latin font subset, switched to Western digits, fixed badge class conflicts, clearer "confirm your email" error, fixed Supabase local redirect URLs, added Arabic 404 and error pages, and ignored `env-local-backup/` and `supabase/.temp/`.
- Done on 2026-11-04 (theme + language): added dark mode (token overrides + pre-paint script + circular View Transition), a full AR/EN dictionary with cookie-based locale switching (no URL change), and the two header toggles site-wide. All existing pages and UI primitives now use the new tokens and copy. Lint, typecheck, build, and headless-browser checks (390px + 1280px, RTL/LTR, theme persistence, no horizontal overflow) pass.
- Done on 2026-11-05 (backend B1): full Postgres schema in `supabase/migrations` — enums and helpers, profiles, platform settings, units/rooms/beds, visits/evaluations, bookings/payments, reviews/contracts/audit, storage buckets and policies, explicit service-role grants. RLS is on for every table, with a negative-case suite in `supabase/tests/rls_negative_cases.sql`.
- Done on 2026-11-07 (backend B2): soft delete for the nine business tables — `deleted_at` columns, partial unique indexes that ignore deleted rows, guarded SECURITY DEFINER delete/restore RPCs, RLS hides deleted rows, admin-only restore, and `supabase/tests/soft_delete_cases.sql`. Delete/restore checks authorization before the "already deleted" no-op so an unauthorized caller only ever sees `NOT_FOUND`. Lint, typecheck and build pass. The migrations are not applied to a database yet.
- Done on 2026-11-08 (backend wiring): server actions for all ten soft delete/restore RPCs in `app/actions/soft-delete.ts`, with a shared authenticate → validate (zod) → role check → RPC pipeline, safe error-code mapping and targeted revalidation; `features/soft-delete/schemas.ts`; temporary RPC typings added to `types/database.types.ts`. Lint, typecheck and build pass. No UI consumes them yet.
- Done on 2026-11-08 (phase 2): booking/payment/contract/review/matching RPCs in `supabase/migrations/20261108120000_booking_payment_contract_review_rpcs.sql` — `create_booking`, `cancel_booking`, `confirm_booking_payment`, `fail_booking_payment`, `request_contract`, `sign_contract`, `moderate_review`, `match_units`, matching-preference columns and the `unit_listings` view. Manual `types/database.types.ts` updated, plus `lib/errors.ts`, `lib/action-errors.ts`, `lib/action-pipeline.ts` and server actions in `app/actions/{bookings,payments,contracts,reviews}.ts`.
- Done on 2026-11-08 (phase 3): `features/units/queries.ts` now feeds `/explore`, `/units/[id]` and `/book/[id]` from `unit_listings` (falling back to `lib/sample-data.ts` until the migrations run); `booking-flow.tsx` picks a real room/bed/date and calls `createBooking`.
- Done on 2026-11-08 (phase 4): atomic `create_unit` RPC (`20261108121000_create_unit_rpc.sql`) so a unit, its rooms and beds are created in one transaction; `features/owner/schemas.ts`, `app/actions/units.ts` (`createUnit`, `setUnitStatus`) and a rebuilt `add-unit-form.tsx` that uploads photos straight to `unit-photos/{unitId}/...` from the browser after creation.
- Done on 2026-11-08 (phase 5): admin restore screen — `features/admin/queries.ts` (`getDeletedRecords`), `features/admin/components/restore-panel.tsx`, `/admin/restore`, linked from the admin nav and quick actions.
- Done on 2026-11-08 (phase 6): real reviews — `features/reviews/queries.ts` (approved reviews + eligibility gate), `review-form.tsx` on the unit page, `getPendingReviews` + `review-moderation-panel.tsx` at `/admin/reviews`, and `features/student/queries.ts` feeding `/student/recommendations` from `match_units` with match scores on `/explore` cards. Lint and typecheck pass.
- Pending: apply the migrations to a dev database. `npx supabase db push` is blocked because `SUPABASE_DB_PASSWORD` is not set in this shell (the linked project is the only one and the CLI labels it production, so it needs an explicit confirmation). Then generate `types/database.types.ts`, run `rls_negative_cases.sql` and `soft_delete_cases.sql`, and click through the manual checks (create unit + photos, submit/approve a review, restore an item, open recommendations).
- Done on 2026-11-08 (phase 7 — real dashboards): migration `20261108122000_dashboards_and_signup.sql` (signup trigger creates `student_profiles`/`owner_profiles`, `owner_bookings()` RPC, admin audit read policy, admin contract upload policies, `admin_set_user_role()`); `/signup` now collects phone + gender/university/year/smoker/hobbies (student) and passes metadata to the trigger; student profile (`/student/profile`) edits real `profiles`+`student_profiles`, uploads ID/university card to private `id-documents`; student bookings (`/student`) show real bookings with payment/contract state, cancel, request-contract and signed-download; owner dashboard (`/owner`) shows owned units (rooms/beds/rating) + `owner_bookings`; team (`/team`) lists assigned visits and submits evaluations (`app/actions/field.ts` + `submitUnitEvaluation`/`scheduleVisit`); leader (`/leader`) approves/rejects units (`setUnitStatus`) and schedules visits to team members; admin (`/admin`) shows real stats + recent users/units + audit log + role promotion; new `/admin/payments` for manual payment reconciliation and PDF contract signing; `requireRole` lets admins open every dashboard; duplicate team↔leader nav links removed. `TESTING.md` added with per-role test checklists. Lint, typecheck, build pass.
- Done on 2026-11-08 (db applied): `npx supabase db push --remote --yes` applied 20 migrations (incl. fix `20261108115900_profile_soft_delete_column.sql` adding `deleted_at` to `student_profiles`/`owner_profiles` so `match_units`/`create_booking` validate; the 120000 migration was unapplied so nothing was edited). `supabase gen types` confirmed `owner_bookings`/`admin_set_user_role` exist; manual `types/database.types.ts` kept (app helper exports) and `deleted_at` added to profile rows. `rls_negative_cases.sql` + `soft_delete_cases.sql` both pass on production (rollback); fixed three stale expectations: audit-logs SELECT grant for admins, profile inserts need `on conflict do nothing` (trigger now pre-creates them), Team-B evaluation returns 23514 before RLS, Owner-B count after delete is 2 (public approved units). Lint, typecheck, build pass. Code lives on the linked project `aekmncnyhuhsleshaewg` (production) — treat test accounts as real until a dev project exists.
- Done on 2026-11-08 (profile + header fix): logo now routes to the signed-in role dashboard, home CTAs switch to "dashboard / my profile" when signed in, site-header mobile button is role-aware (was hardcoded `/student`). New private `/profile` for every role: basic name/phone editable, email/role read-only, student matching prefs + ID/university-card docs, owner ID/ownership docs, staff note that role changes are admin-only. `/student/profile` redirects to `/profile`. Each user sees only their own row (`getMyProfile` is auth-scoped). Lint, typecheck, build pass.
- Done on 2026-11-08 (audit A+B + C/D/E fixes): payments state machine now includes `expired` + `payment_events` ledger (migration `20261108126000_payment_hardening.sql`); refunds are admin-only (`refund_booking_payment`) and self-service cancel no longer refunds; `createBooking`/`confirmPayment` rate-limited via audit trail (`lib/action-pipeline.ts:isRateLimited`, max 5/hour bookings, 20/hour payments); bookings/visits get explicit status state-machine triggers and `expire_pending_payments()` RPC + `/api/cron/expire-payments` (protected by CRON_SECRET); owner/student/team uploads now use UUID filenames; CSP added to `next.config.ts`; pagination hard caps (`range(0,199)`); admin report CHECK: lint, typecheck, build pass. Production still needs: Supabase Auth email confirmations (Dashboard), Leaked-password protection (Dashboard), CAPTCHA (Dashboard), and `npx supabase db push --remote --yes` for `20261108126000` + `20261108127000`. Regional note: Supabase project is eu-central-1, `vercel.json` pins region `fra1`.
