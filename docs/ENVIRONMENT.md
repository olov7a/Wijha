# Environment & Accounts Inventory (no secrets here)

## Environment variables

| Name | Where it lives | Public? | Notes |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Vercel + .env.local | yes | Supabase project URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Vercel + .env.local | yes | Safe for the browser (anon/publishable key) |
| NEXT_PUBLIC_SITE_URL | Vercel + .env.local | yes | https://wijha-rho.vercel.app |
| NEXT_PUBLIC_APP_ENV | Vercel + .env.local | yes | `staging` shows the test banner and noindex headers |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY | Vercel + .env.local | yes | Cloudflare Turnstile site key. When empty the CAPTCHA widget is not rendered |
| SUPABASE_SERVICE_ROLE_KEY | Vercel + .env.local | NO | Server-only, bypasses RLS. Never prefix with `NEXT_PUBLIC_` |
| BOOTSTRAP_ADMIN_SECRET | Vercel + .env.local | NO | Server-only, min 8 chars. Used once to claim the first admin at `/admin/bootstrap` |
| CRON_SECRET | Vercel + .env.local | NO | Server-only, min 16 chars. Protects the expiry cron `/api/cron/expire-payments` |

> `.env.example` lists every variable above with no real values. Anything not in
> this table is not a project variable.
>
> The Turnstile **secret** is not a project variable: it goes in Supabase
> Dashboard → Authentication → Attack Protection → CAPTCHA. Never put it in
> Vercel or `.env.local`.

## Services

| Service | Purpose | Credentials stored in |
|---|---|---|
| Vercel | Hosting (deployed from `main`, `https://wijha-rho.vercel.app`) | Password manager (folder Wijha) |
| Supabase | Database + Auth + Storage | Password manager |
| GitHub | Code | Password manager |
| Gmail (project) | Sends signup emails (SMTP) | Password manager |

## Rules

- Never commit .env* files (only .env.example).
- If a secret leaks (chat, screenshot, git), rotate it immediately.
- Never print a secret, ask for one, or paste one into a ticket or screenshot.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only: no `NEXT_PUBLIC_` prefix, no client component imports it (`lib/supabase/admin.ts` uses `server-only`).
- After changing any `NEXT_PUBLIC_*` value on Vercel, **redeploy** so it is picked up.
- `.env.local` and `.env.test.local` stay git-ignored; the E2E guard (`playwright.config.ts`) refuses to run unless the test env points at a dev project.
