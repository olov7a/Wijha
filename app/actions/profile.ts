"use server";

import { revalidatePath } from "next/cache";
import { failureResult, guardAction } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import {
  contractIdSchema,
  studentDocumentSchema,
  updateStudentProfileSchema,
} from "@/features/student/schemas";

const AFFECTED_PATHS = ["/student", "/student/profile", "/student/recommendations", "/owner", "/admin"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Save the student's personal data and matching preferences. `profiles` only
 * exposes full_name/phone to its owner; the subtype row carries the rest.
 */
export async function updateStudentProfile(input: unknown): Promise<Result<null>> {
  const parsed = updateStudentProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student"] });
  if (!guard.ok) return guard;

  const { supabase, user } = guard;
  const data = parsed.data;
  const hobbies = Array.from(new Set(data.hobbies.map((value) => value.trim()).filter(Boolean)));

  const profileUpdate = await supabase
    .from("profiles")
    .update({ full_name: data.fullName, phone: data.phone })
    .eq("id", user.id);

  if (profileUpdate.error) return failureResult(profileUpdate.error);

  const subtype = {
    gender: data.gender,
    university: data.university?.trim() ? data.university.trim() : null,
    study_year: data.studyYear ?? null,
    is_smoker: data.isSmoker,
    hobbies,
    budget_min_piastres: data.budgetMin == null ? null : data.budgetMin * 100,
    budget_max_piastres: data.budgetMax == null ? null : data.budgetMax * 100,
    preferred_areas: data.preferredAreas.map((value) => value.trim()).filter(Boolean),
    preferred_amenities: data.preferredAmenities,
  };

  const existing = await supabase
    .from("student_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing.error) return failureResult(existing.error);

  const write = existing.data
    ? await supabase.from("student_profiles").update(subtype).eq("user_id", user.id)
    : await supabase.from("student_profiles").insert({ user_id: user.id, ...subtype });

  if (write.error) return failureResult(write.error);

  revalidateAffected();
  return { ok: true, data: null };
}

/**
 * Attach an identity document already uploaded by the browser to the private
 * `id-documents/{user_id}/...` folder. Only the exact path of the caller is
 * accepted, and the database constraint repeats the prefix check.
 */
export async function saveStudentDocument(input: unknown): Promise<Result<null>> {
  const parsed = studentDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student"] });
  if (!guard.ok) return guard;

  if (!parsed.data.path.startsWith(`${guard.user.id}/`)) {
    return { ok: false, error: ERROR_CODES.INVALID_INPUT };
  }

  const update =
    parsed.data.kind === "id_document"
      ? { id_document_path: parsed.data.path }
      : { university_card_path: parsed.data.path };

  const { data: updated, error } = await guard.supabase
    .from("student_profiles")
    .update(update)
    .eq("user_id", guard.user.id)
    .select("user_id");

  if (error) return failureResult(error);
  if (!updated || updated.length === 0) return { ok: false, error: ERROR_CODES.PROFILE_INCOMPLETE };

  revalidateAffected();
  return { ok: true, data: null };
}

/** Short-lived signed URL for a contract PDF the caller is allowed to read. */
export async function getContractDownloadUrl(input: unknown): Promise<Result<{ url: string }>> {
  const parsed = contractIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student", "owner", "admin"] });
  if (!guard.ok) return guard;

  const { data: contract, error } = await guard.supabase
    .from("contracts")
    .select("file_path")
    .eq("id", parsed.data.contractId)
    .maybeSingle();

  if (error) return failureResult(error);
  if (!contract?.file_path) return { ok: false, error: ERROR_CODES.NOT_FOUND };

  const { data: signed, error: signError } = await guard.supabase.storage
    .from("contracts")
    .createSignedUrl(contract.file_path, 60 * 10);

  if (signError || !signed?.signedUrl) return { ok: false, error: ERROR_CODES.NOT_FOUND };

  return { ok: true, data: { url: signed.signedUrl } };
}
