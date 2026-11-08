"use server";

import { revalidatePath } from "next/cache";
import { failureResult, guardAction } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { ownerDocumentSchema, updateMyBasicProfileSchema } from "@/features/profile/schemas";

const AFFECTED_PATHS = ["/profile", "/student/profile", "/owner", "/admin", "/team", "/leader"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Every signed-in user edits only their own name/phone. Role and email are
 * never writable from the client (column grants + RLS "own row" only).
 */
export async function updateMyBasicProfile(input: unknown): Promise<Result<null>> {
  const parsed = updateMyBasicProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction();
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", guard.user.id);

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}

/** Attach an owner document already uploaded to `ownership-documents/{user_id}/...`. */
export async function saveOwnerDocument(input: unknown): Promise<Result<null>> {
  const parsed = ownerDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["owner"] });
  if (!guard.ok) return guard;

  if (!parsed.data.path.startsWith(`${guard.user.id}/`)) {
    return { ok: false, error: ERROR_CODES.INVALID_INPUT };
  }

  const update =
    parsed.data.kind === "id_document"
      ? { id_document_path: parsed.data.path }
      : { ownership_proof_path: parsed.data.path };

  const { data: updated, error } = await guard.supabase
    .from("owner_profiles")
    .update(update)
    .eq("user_id", guard.user.id)
    .select("user_id");

  if (error) return failureResult(error);
  if (!updated || updated.length === 0) return { ok: false, error: ERROR_CODES.PROFILE_INCOMPLETE };

  revalidateAffected();
  return { ok: true, data: null };
}
