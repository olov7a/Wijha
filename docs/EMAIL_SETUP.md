# EMAIL SETUP — Wijha (manual Supabase checklist)

Everything in this document is configured manually in the Supabase dashboard.
Do **not** commit secrets (SMTP password, `service_role` key) to this repo.

Production site: `https://wijha-rho.vercel.app`

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

- [ ] Supabase → **Authentication → Providers → Email**: **Confirm email = ON**.
- [ ] With confirmation ON, signup lands on `/check-email` and the inbox link
      goes to `/auth/callback` (see `lib/auth/site-url.ts`).

## 3. URL configuration

Supabase → **Authentication → URL Configuration**:

- [ ] **Site URL** = `https://wijha-rho.vercel.app`
- [ ] **Redirect URLs** — add both:
  - `https://wijha-rho.vercel.app/**`
  - `http://localhost:3000/**`

The app's callback is `https://wijha-rho.vercel.app/auth/callback` (legacy
links to `/auth/confirm` still work — see `app/auth/confirm/route.ts`).

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
