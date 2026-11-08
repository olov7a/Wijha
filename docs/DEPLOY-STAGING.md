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
   - `SUPABASE_SERVICE_ROLE_KEY` (dev project — server only)
   - `BOOTSTRAP_ADMIN_SECRET` (only if you need first-admin claim)
   - `CRON_SECRET` (only if you run the expiry cron)
3. **Supabase (dev project) → Authentication → URL Configuration**:
   - Site URL = your preview URL
   - Redirect URLs: add `<preview-url>/auth/confirm`
4. **Deployment Protection**: enable in Vercel (All previews) so only invited testers can open it.
5. **If the Supabase project was paused**: Dashboard → Restore, then wait a few minutes. Migrations will re-apply on wake.

## Notes
- No payment keys are set. Payments stay manual (Approvals at `/admin/payments`).
- The banner ("Test environment - use fake data only. No real payments.") only shows when `NEXT_PUBLIC_APP_ENV=staging`.
