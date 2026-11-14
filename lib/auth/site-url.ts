/**
 * Single source of truth for the public site URL and the email-confirmation
 * callback URL. Every `signUp` / `resend` call must go through these helpers
 * so the redirect target never drifts between server and client code.
 */

const FALLBACK_SITE_URL = "http://localhost:3000";
const CALLBACK_PATH = "/auth/callback";
const RESET_CALLBACK_PATH = "/auth/reset";

function stripTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function envSiteUrl() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return value && value.length > 0 ? stripTrailingSlash(value) : undefined;
}

/**
 * Server-safe site URL: `NEXT_PUBLIC_SITE_URL`, falling back to the local
 * dev origin when the variable is not set (mirrors the `lib/env` default).
 */
export function getSiteUrl() {
  return envSiteUrl() ?? FALLBACK_SITE_URL;
}

/** Absolute callback URL used as `options.emailRedirectTo` on the server. */
export function getEmailRedirectTo() {
  return `${getSiteUrl()}${CALLBACK_PATH}`;
}

/**
 * Recovery links use a dedicated callback with no query string, so the
 * redirect target matches the Supabase allow-list exactly. That route
 * exchanges the code for a session and forwards to `/reset-password`.
 */
export function getPasswordResetRedirectTo() {
  return `${getSiteUrl()}${RESET_CALLBACK_PATH}`;
}

/**
 * Only allow same-site relative paths as a post-auth destination. Rejects
 * `//evil.com`, absolute URLs, backslashes and control characters so the
 * callback can never become an open redirect.
 */
export function safeNextPath(value: string | null | undefined) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/**
 * Client site URL: prefers the inlined `NEXT_PUBLIC_SITE_URL` and falls back
 * to `window.location.origin` so local development works without extra env.
 */
export function getClientSiteUrl() {
  const fromEnv = envSiteUrl();
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return stripTrailingSlash(window.location.origin);
  }
  return FALLBACK_SITE_URL;
}

/** Client-side twin of {@link getEmailRedirectTo}. */
export function getClientEmailRedirectTo() {
  return `${getClientSiteUrl()}${CALLBACK_PATH}`;
}
