"use server";

import { revalidatePath } from "next/cache";
import { guardAction, failureResult } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { moderateReviewSchema, submitReviewSchema } from "@/features/reviews/schemas";

const AFFECTED_PATHS = ["/student", "/admin", "/explore", "/units"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Submit a unit review. It is inserted as `pending`; the database trigger only
 * allows students with a confirmed booking for that unit. Nothing is public
 * until an admin approves it.
 */
export async function submitReview(input: unknown): Promise<Result<{ reviewId: string }>> {
  const parsed = submitReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student"] });
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase
    .from("reviews")
    .insert({
      reviewer_id: guard.user.id,
      target_type: "unit",
      target_id: parsed.data.unitId,
      rating: parsed.data.rating,
      body: parsed.data.body ?? null,
    })
    .select("id")
    .single();

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  revalidateAffected();
  return { ok: true, data: { reviewId: data.id } };
}

/** Approve or reject a pending review. Admins only. */
export async function moderateReview(input: unknown): Promise<Result<null>> {
  const parsed = moderateReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("moderate_review", {
    p_review_id: parsed.data.reviewId,
    p_status: parsed.data.status,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
