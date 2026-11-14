# EMAIL SETUP — Wijha (manual Supabase checklist)

Everything in this document is configured manually in the Supabase dashboard.
Do **not** commit secrets (SMTP password, `service_role` key) to this repo.

Production site: `https://wijha-rho.vercel.app`

## 0. Current status (verified 2026-11-14 via the Supabase CLI)

- **Custom SMTP**: enabled (`smtp.gmail.com:465`, sender `Wijha <wijhap@gmail.com>`).
- **Email confirmation**: **ON** (`auth.email.enable_confirmations = true`).
- **Site URL**: `https://wijha-rho.vercel.app`.
- **Redirect URLs**: exact entries for `/auth/callback`, `/auth/reset` and
  `/auth/confirm` on the production domain and on `localhost`/`127.0.0.1:3000`.
- **CAPTCHA**: **OFF** — it stays off until the Turnstile *site key* is set in
  Vercel, the build that renders the widget is deployed, and the *secret* is
  pasted into the dashboard. Enabling it earlier rejects every sign-in.

## 1. Custom SMTP (names only — fill values in the dashboard)

Supabase → **Authentication → SMTP Settings → Enable custom SMTP**, then enter:

- [ ] **Host** (e.g. your provider's SMTP host)
- [ ] **Port** (e.g. `465` / `587`)
- [ ] **Username**
- [ ] **Password** *(type it in the dashboard only — never in git)*
- [ ] **Sender email** (from-address)
- [ ] **Sender name / Admin email**
- [ ] **Secure / encryption** (SSL or TLS matching the provider)
- [ ] Save, then send a test email to confirm

## 2. Email confirmation

- [x] Supabase → **Authentication → Providers → Email**: **Confirm email = ON**.
- [ ] With confirmation ON, signup lands on `/check-email` and the inbox link
      goes to `/auth/callback` (see `lib/auth/site-url.ts`).
- [ ] **Password recovery** links go to `/auth/reset`, which exchanges the code
      and forwards to `/reset-password`. Requested from `/forgot-password`.

## 3. URL configuration

Supabase → **Authentication → URL Configuration**:

- [x] **Site URL** = `https://wijha-rho.vercel.app`
- [x] **Redirect URLs** — exact paths configured (see status above):
  - `https://wijha-rho.vercel.app/auth/callback` (signup confirmation)
  - `https://wijha-rho.vercel.app/auth/reset` (password recovery)
  - `https://wijha-rho.vercel.app/auth/confirm` (legacy links)
  - the same three on `http://localhost:3000` and `http://127.0.0.1:3000`
- [ ] If you ever move to a new domain, add `<new-site>/auth/callback` and
      `<new-site>/auth/reset` there before switching `NEXT_PUBLIC_SITE_URL`.

The app's callback is `https://wijha-rho.vercel.app/auth/callback` (legacy
links to `/auth/confirm` still work — see `app/auth/confirm/route.ts`), and
recovery links use `https://wijha-rho.vercel.app/auth/reset`.

## 4. Vercel environment variables

Vercel → **Settings → Environment Variables** (Production):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
      *(this project uses the publishable/anon key under the name above — not
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`)*
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://wijha-rho.vercel.app`
- [ ] **Redeploy** after saving so the new `NEXT_PUBLIC_*` values are inlined.

> Local dev: put the same names in `.env.local` (git-ignored), with
> `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. `.env.example` already lists
> the public names with no real values.

## 5. Email templates

Supabase → **Authentication → Emails**:

- [ ] **Confirm signup** — paste the template; it must use the confirmation
      link (`{{ .ConfirmationURL }}` or the equivalent variable) so Supabase
      routes the user back to `/auth/callback`.
- [ ] **Resend confirmation / Magic link** (if used) — same link requirement.
- [ ] Preview with a test signup, then confirm the click lands on the role
      dashboard (`/student`, `/owner`, `/team`, `/leader`, `/admin`).

## Verification flow

1. Sign up → **Check your email** screen shows the entered email.
2. Click the inbox link **in the same browser** → your role dashboard.
3. Open the link **again** (or in another browser) → login shows
   *“Your email may already be confirmed, try logging in”*.
