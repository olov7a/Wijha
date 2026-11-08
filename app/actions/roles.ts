"use server";

import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { guardAction, failureResult } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { getBootstrapSecret } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const setRoleSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(["student", "owner", "team", "leader", "admin"]),
  })
  .strict();

/** Change a user's dashboard role. Admins only; the RPC also guards. */
export async function setUserRole(input: unknown): Promise<Result<null>> {
  const parsed = setRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("admin_set_user_role", {
    p_user_id: parsed.data.userId,
    p_role: parsed.data.role,
  });

  if (error) return failureResult(error);

  ["/admin"].forEach((path) => revalidatePath(path));
  return { ok: true, data: null };
}

/** First-admin bootstrap: only succeeds when no admin exists AND the caller knows the server secret. */
export async function claimFirstAdmin(input: unknown): Promise<Result<null>> {
  const parsed = z.object({ code: z.string().trim().min(8).max(200) }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction();
  if (!guard.ok) return guard;
  const actorId = guard.user.id;

  // --- Rate limit: 5 failed attempts per user per 10 minutes (audit-backed). ---
  const admin = createAdminClient();
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const attempts = await admin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("actor_id", actorId)
    .eq("action", "admin.bootstrap_denied")
    .gte("created_at", since);

  if (attempts.error) return failureResult(attempts.error);
  if ((attempts.count ?? 0) >= 5) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  async function deny() {
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action: "admin.bootstrap_denied",
      entity_type: "admin_bootstrap",
      entity_id: actorId,
      metadata: { reason: "secret_mismatch" },
    });
    return { ok: false, error: ERROR_CODES.FORBIDDEN } as const;
  }

  const expected = getBootstrapSecret();
  if (!expected) {
    console.error("claimFirstAdmin: BOOTSTRAP_ADMIN_SECRET is not configured");
    return { ok: false, error: ERROR_CODES.FORBIDDEN };
  }

  const given = Buffer.from(parsed.data.code);
  const want = Buffer.from(expected);
  // Constant-time compare; never echo which half matched.
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    return deny();
  }

  // Atomic check + promotion in one DB function (advisory lock inside).
  const { error } = await admin.rpc("claim_first_admin", {
    p_actor: actorId,
  });

  if (error) {
    if (error.message === "FORBIDDEN") {
      await admin.from("audit_logs").insert({
        actor_id: actorId,
        action: "admin.bootstrap_denied",
        entity_type: "admin_bootstrap",
        entity_id: actorId,
        metadata: { reason: "admin_exists" },
      });
    }
    return failureResult(error);
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true, data: null };
}

export type FoundUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
  createdAt: string;
};

/** Search accounts by email or name (admins only, RPC does the matching). */
export async function findUsers(input: unknown): Promise<Result<{ users: FoundUser[] }>> {
  const query = z.string().trim().max(200).safeParse(input);
  if (!query.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("admin_find_users", {
    p_query: query.data,
  });
  if (error) return failureResult(error);

  return {
    ok: true,
    data: {
      users: (data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        createdAt: row.created_at,
      })),
    },
  };
}
