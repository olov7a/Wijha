/**
 * Single source of truth for the public site URL and the email-confirmation
 * callback URL. Every `signUp` / `resend` call must go through these helpers
 * so the redirect target never drifts between server and client code.
 */

const FALLBACK_SITE_URL = "http://localhost:3000";
const CALLBACK_PATH = "/auth/callback";

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
