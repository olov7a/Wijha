"use server";

import { revalidatePath } from "next/cache";
import type { UserRole } from "@/types/database.types";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { ERROR_CODES, type ErrorCode } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import { entityIdSchema } from "@/features/soft-delete/schemas";

type Client = Awaited<ReturnType<typeof createClient>>;
type RpcError = { message: string; code?: string } | null;
type RpcCall = (supabase: Client, id: string) => PromiseLike<{ error: RpcError }>;

const KNOWN_CODES = new Set<string>(Object.values(ERROR_CODES));

/**
 * Fallback mapping from the SQLSTATE we raise inside the RPCs. The exception
 * message (e.g. `HAS_UPCOMING_VISITS`, `RESTORE_CONFLICT`) wins when it is one
 * of our codes, so this table is only a safety net.
 */
const SQLSTATE_CODES: Record<string, ErrorCode> = {
  "42501": ERROR_CODES.UNAUTHENTICATED,
  "23503": ERROR_CODES.ACTIVE_BOOKINGS,
  "23505": ERROR_CODES.CONFLICT,
  P0001: ERROR_CODES.HAS_UPCOMING_VISITS,
  P0002: ERROR_CODES.NOT_FOUND,
};

const OWNER_OR_ADMIN = ["owner", "admin"] as const satisfies readonly UserRole[];
const LEADER_OR_ADMIN = ["leader", "admin"] as const satisfies readonly UserRole[];
const ADMIN_ONLY = ["admin"] as const satisfies readonly UserRole[];

function toErrorCode(error: NonNullable<RpcError>, fallback: ErrorCode): ErrorCode {
  const message = error.message.trim();
  if (KNOWN_CODES.has(message)) return message as ErrorCode;
  if (error.code && SQLSTATE_CODES[error.code]) return SQLSTATE_CODES[error.code];
  return fallback;
}

type ActionOptions = {
  /** Roles allowed to call this action. Omitted means any signed-in account. */
  roles?: readonly UserRole[];
  /** Pages whose cached data changes after a successful write. */
  revalidate: readonly string[];
  fallback: ErrorCode;
  call: RpcCall;
};

/**
 * Shared pipeline for every soft delete/restore: authenticate, validate, check
 * the role (defense in depth), then call the SECURITY DEFINER RPC, which repeats
 * the ownership check in the database. Detailed errors stay in the server log;
 * the client only receives a stable code.
 */
async function runEntityAction(input: unknown, options: ActionOptions): Promise<Result<null>> {
  if (!isSupabaseConfigured()) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: ERROR_CODES.UNAUTHENTICATED };

  const parsed = entityIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  if (options.roles && !options.roles.includes(user.role)) {
    return { ok: false, error: ERROR_CODES.FORBIDDEN };
  }

  const supabase = await createClient();
  const { error } = await options.call(supabase, parsed.data.id);

  if (error) {
    console.error("soft delete/restore failed", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: toErrorCode(error, options.fallback) };
  }

  options.revalidate.forEach((path) => revalidatePath(path));
  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
export async function deleteUnit(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: OWNER_OR_ADMIN,
    revalidate: ["/admin", "/owner", "/leader", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("soft_delete_unit", { p_unit_id: id }),
  });
}

export async function restoreUnit(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: ADMIN_ONLY,
    revalidate: ["/admin", "/owner", "/leader", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("restore_unit", { p_unit_id: id }),
  });
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
export async function deleteRoom(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: OWNER_OR_ADMIN,
    revalidate: ["/admin", "/owner", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("soft_delete_room", { p_room_id: id }),
  });
}

export async function restoreRoom(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: ADMIN_ONLY,
    revalidate: ["/admin", "/owner", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("restore_room", { p_room_id: id }),
  });
}

// ---------------------------------------------------------------------------
// Beds
// ---------------------------------------------------------------------------
export async function deleteBed(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: OWNER_OR_ADMIN,
    revalidate: ["/admin", "/owner", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("soft_delete_bed", { p_bed_id: id }),
  });
}

export async function restoreBed(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: ADMIN_ONLY,
    revalidate: ["/admin", "/owner", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("restore_bed", { p_bed_id: id }),
  });
}

// ---------------------------------------------------------------------------
// Unit visits
// ---------------------------------------------------------------------------
export async function deleteUnitVisit(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: LEADER_OR_ADMIN,
    revalidate: ["/admin", "/leader", "/team"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("soft_delete_unit_visit", { p_visit_id: id }),
  });
}

export async function restoreUnitVisit(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: ADMIN_ONLY,
    revalidate: ["/admin", "/leader", "/team"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("restore_unit_visit", { p_visit_id: id }),
  });
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
export async function deleteReview(input: unknown): Promise<Result<null>> {
  // The RPC additionally enforces that only the reviewer or an admin may
  // delete a review; this role list is the defense-in-depth twin.
  return runEntityAction(input, {
    roles: ["student", "admin"],
    revalidate: ["/admin", "/student", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("soft_delete_review", { p_review_id: id }),
  });
}

export async function restoreReview(input: unknown): Promise<Result<null>> {
  return runEntityAction(input, {
    roles: ADMIN_ONLY,
    revalidate: ["/admin", "/student", "/explore"],
    fallback: ERROR_CODES.UNEXPECTED,
    call: (supabase, id) => supabase.rpc("restore_review", { p_review_id: id }),
  });
}
