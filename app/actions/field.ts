"use server";

import { revalidatePath } from "next/cache";
import { failureResult, guardAction } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { scheduleVisitSchema, submitEvaluationSchema, updateVisitStatusSchema } from "@/features/field/schemas";

const AFFECTED_PATHS = ["/team", "/leader", "/owner", "/admin", "/explore"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Record the single evaluation of an assigned visit. RLS + the DB trigger
 * guarantee the caller is the assigned team member and the visit matches the
 * unit; the action additionally closes the visit as completed so leaders see
 * the report immediately.
 */
export async function submitUnitEvaluation(input: unknown): Promise<Result<{ evaluationId: string }>> {
  const parsed = submitEvaluationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["team", "leader", "admin"] });
  if (!guard.ok) return guard;

  // Team members evaluate only their own visits; leaders/admins may use any
  // request that passes the DB checks. Fetch the visit first for unit id.
  const { data: visit, error: visitError } = await guard.supabase
    .from("unit_visits")
    .select("id, unit_id, team_member_id, status")
    .eq("id", parsed.data.visitId)
    .maybeSingle();

  if (visitError) return failureResult(visitError);
  if (!visit) return { ok: false, error: ERROR_CODES.NOT_FOUND };
  if (guard.user.role === "team" && visit.team_member_id !== guard.user.id) {
    return { ok: false, error: ERROR_CODES.FORBIDDEN };
  }
  if (visit.status === "cancelled") return { ok: false, error: ERROR_CODES.INVALID_STATE };

  const photoPaths = parsed.data.photoPaths.filter((p: string) => p.startsWith(`${visit.unit_id}/`));

  const { data, error } = await guard.supabase
    .from("unit_evaluations")
    .insert({
      unit_id: visit.unit_id,
      team_member_id: visit.team_member_id,
      visit_id: visit.id,
      checklist: parsed.data.checklist,
      score: parsed.data.score,
      photo_paths: photoPaths,
    })
    .select("id")
    .single();

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  if (visit.status === "scheduled") {
    await guard.supabase.from("unit_visits").update({ status: "completed" }).eq("id", visit.id);
  }

  revalidateAffected();
  return { ok: true, data: { evaluationId: data.id } };
}

/** Schedule an inspection visit. Leaders/admins only. */
export async function scheduleVisit(input: unknown): Promise<Result<{ visitId: string }>> {
  const parsed = scheduleVisitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["leader", "admin"] });
  if (!guard.ok) return guard;

  const parsedDate = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(parsedDate.getTime())) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const { data, error } = await guard.supabase
    .from("unit_visits")
    .insert({
      unit_id: parsed.data.unitId,
      team_member_id: parsed.data.teamMemberId,
      scheduled_at: parsedDate.toISOString(),
      status: "scheduled",
      notes: parsed.data.notes || null,
    })
    .select("id")
    .single();

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  revalidateAffected();
  return { ok: true, data: { visitId: data.id } };
}

/** Move a visit between scheduled/completed/cancelled (DB guards transitions). */
export async function updateVisitStatus(input: unknown): Promise<Result<null>> {
  const parsed = updateVisitStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["team", "leader", "admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("unit_visits")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.visitId);

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
