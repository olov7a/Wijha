import { getDictionary } from "@/lib/i18n/dictionary";
import type { Locale } from "@/lib/i18n/config";

/**
 * Central mapper: Supabase Auth errors -> friendly bilingual messages.
 *
 * Raw Supabase messages are NEVER shown to users (they leak internals and
 * are English-only). The mapper reads only `error.code` plus a few message
 * substrings as a fallback for older `supabase-js` versions that omit the
 * code, and always returns a dictionary message for the active locale.
 */

export type AuthErrorInput = {
  code?: string | null;
  message?: string | null;
};

export type MappedAuthError = {
  /** Stable internal key; `"generic"` when nothing matches. */
  code: string;
  message: string;
  /** True only for `email_not_confirmed`, so login can offer a Resend button. */
  needsResend: boolean;
};

type Rule = {
  code: string;
  messageKey:
    | "emailRateLimit"
    | "emailNotAuthorized"
    | "userAlreadyExists"
    | "invalidCredentials"
    | "emailNotConfirmed"
    | "weakPassword"
    | "samePassword"
    | "invalidEmail"
    | "captchaFailed";
  needsResend?: boolean;
  messageHints?: string[];
};

function normalize(value: string | null | undefined) {
  return (value ?? "").toLowerCase();
}

// Code matching is exact; message hints catch SDK versions without `code`.
const RULES: Rule[] = [
  { code: "over_email_send_rate_limit", messageKey: "emailRateLimit", messageHints: ["over_email_send_rate_limit", "over email send rate limit", "email rate limit", "rate limit"] },
  { code: "email_address_not_authorized", messageKey: "emailNotAuthorized", messageHints: ["not authorized", "not allowed"] },
  { code: "user_already_exists", messageKey: "userAlreadyExists", messageHints: ["already registered", "already exists", "user already"] },
  { code: "email_not_confirmed", messageKey: "emailNotConfirmed", needsResend: true, messageHints: ["email not confirmed", "not confirmed", "not verified"] },
  { code: "weak_password", messageKey: "weakPassword", messageHints: ["weak password"] },
  { code: "same_password", messageKey: "samePassword", messageHints: ["different from the old password", "same password"] },
  { code: "captcha_failed", messageKey: "captchaFailed", messageHints: ["captcha"] },
  // Callers treat this as a generic invalid login to avoid user enumeration.
  { code: "invalid_credentials", messageKey: "invalidCredentials", messageHints: ["invalid login credentials", "invalid credentials"] },
  { code: "email_address_invalid", messageKey: "invalidEmail", messageHints: ["invalid email", "invalid address", "not a valid email"] },
];

function findRule(code: string | null | undefined, message: string | null | undefined): Rule | undefined {
  const normalizedCode = normalize(code);
  const normalizedMessage = normalize(message);
  for (const rule of RULES) {
    if (normalizedCode && normalizedCode === rule.code) return rule;
  }
  // Some SDK versions surface the failure as a code-like substring inside
  // `message` instead of a structured `code` field.
  if (normalizedMessage) {
    for (const rule of RULES) {
      if (normalizedMessage.includes(rule.code)) return rule;
      if (rule.messageHints?.some((hint) => normalizedMessage.includes(hint))) {
        // `invalid_credentials` hints are intentionally narrow: a bare
        // "invalid login" without "credentials" must not mask other errors.
        return rule;
      }
    }
  }
  return undefined;
}

/**
 * Map any Supabase auth error (or `null`/`undefined`) to a friendly message.
 * The returned `message` is always a dictionary string — never raw SDK text.
 */
export function mapAuthError(error: AuthErrorInput | null | undefined, locale: Locale): MappedAuthError {
  const t = getDictionary(locale);
  const rule = findRule(error?.code, error?.message);
  if (!rule) return { code: "generic", message: t.auth.errors.generic, needsResend: false };
  return {
    code: rule.code,
    message: t.auth.errors[rule.messageKey],
    needsResend: rule.needsResend ?? false,
  };
}
