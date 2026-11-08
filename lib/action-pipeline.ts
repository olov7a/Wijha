import "server-only";

import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database.types";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type RpcError = { message: string; code?: string } | null | undefined;

const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));

/**
 * Fallback only. The RPCs raise a stable code inside the exception message and
 * that message always wins; these SQLSTATEs cover errors raised by constraints
 * and triggers before a function gets the chance to produce its own code.
 */
const SQLSTATE_CODES: Record<string, ErrorCode> = {
  "42501": ERROR_CODES.FORBIDDEN,
  "23503": ERROR_CODES.NOT_FOUND,
  "23505": ERROR_CODES.CONFLICT,
  "23514": ERROR_CODES.INVALID_STATE,
  "22023": ERROR_CODES.INVALID_INPUT,
  P0002: ERROR_CODES.NOT_FOUND,
};

export function toErrorCode(error: NonNullable<RpcError>, fallback: ErrorCode): ErrorCode {
  const message = error.message?.trim();
  if (message && KNOWN_CODES.has(message)) return message as ErrorCode;
  if (error.code && SQLSTATE_CODES[error.code]) return SQLSTATE_CODES[error.code];
  return fallback;
}

/** Log the real error server-side and return only a stable code to the client. */
export function failureResult(
  error: NonNullable<RpcError>,
  fallback: ErrorCode = ERROR_CODES.UNEXPECTED,
): Result<never> {
  console.error("server action failed", { code: error.code, message: error.message });
  return { ok: false, error: toErrorCode(error, fallback) };
}

export type Guarded =
  | { ok: true; user: CurrentUser; supabase: SupabaseServerClient }
  | { ok: false; error: ErrorCode };

/**
 * Authenticate, confirm Supabase is configured and optionally gate on a role.
 * The database repeats every ownership check inside the RPC; this is the first
 * of the two layers, not the only one.
 */
export async function guardAction(options: { roles?: readonly UserRole[] } = {}): Promise<Guarded> {
  if (!isSupabaseConfigured()) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: ERROR_CODES.UNAUTHENTICATED };

  if (options.roles && !options.roles.includes(user.role)) {
    return { ok: false, error: ERROR_CODES.FORBIDDEN };
  }

  return { ok: true, user, supabase: await createClient() };
}
