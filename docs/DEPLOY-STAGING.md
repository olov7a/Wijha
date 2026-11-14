# DEPLOY STAGING — Wijha (Vercel + Dev Supabase)

## What "staging" means
- Vercel deployment pointed at a **DEV Supabase project** (never production).
- `NEXT_PUBLIC_APP_ENV=staging` shows the test banner and noindex headers.

## Steps

1. **Import the repo** on Vercel (Git import or `vercel` CLI).
2. **Environment variables** (Vercel → Settings → Environment Variables — staging only):
   - `NEXT_PUBLIC_SUPABASE_URL` (dev project ref)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (dev project)
   - `NEXT_PUBLIC_SITE_URL` = your preview URL (e.g. `https://wijha-dev.vercel.app`)
   - `NEXT_PUBLIC_APP_ENV` = `staging`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Cloudflare Turnstile site key; optional)
   - `SUPABASE_SERVICE_ROLE_KEY` (dev project — server only)
   - `BOOTSTRAP_ADMIN_SECRET` (only if you need first-admin claim)
   - `CRON_SECRET` (only if you run the expiry cron)
3. **Supabase (dev project) → Authentication → URL Configuration**:
   - Site URL = your preview URL
   - Redirect URLs: add `<preview-url>/auth/callback`, `<preview-url>/auth/reset`
     and `<preview-url>/auth/confirm` (legacy alias)
   - Note: `NEXT_PUBLIC_SITE_URL` and this list must agree, otherwise Supabase
     falls back to the Site URL and email links land on the wrong host.
4. **Supabase (dev project) → Authentication → Attack Protection → CAPTCHA**:
   - Enable CAPTCHA, provider **Turnstile**, paste the Turnstile **secret key**.
   - The matching **site key** goes in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
   - Enable confirmation emails first: Authentication → Sign In / Providers → Email →
     "Confirm email" on. The login/signup forms only pass a CAPTCHA token when the
     widget is configured, so deploying the key and the Supabase toggle together avoids lockout.
5. **Deployment Protection**: enable in Vercel (All previews) so only invited testers can open it.
6. **If the Supabase project was paused**: Dashboard → Restore, then wait a few minutes. Migrations will re-apply on wake.

## Notes
- No payment keys are set. Payments stay manual (Approvals at `/admin/payments`).
- The banner ("Test environment - use fake data only. No real payments.") only shows when `NEXT_PUBLIC_APP_ENV=staging`.
