"use server";

import { revalidatePath } from "next/cache";
import { guardAction, failureResult } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { requestContractSchema, signContractSchema } from "@/features/contracts/schemas";

const AFFECTED_PATHS = ["/student", "/owner", "/admin"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/** Ask for the rental contract of a confirmed booking. */
export async function requestContract(input: unknown): Promise<Result<{ contractId: string }>> {
  const parsed = requestContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student", "owner", "admin"] });
  if (!guard.ok) return guard;

  const { data, error } = await guard.supabase.rpc("request_contract", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  revalidateAffected();
  return { ok: true, data: { contractId: data } };
}

/**
 * Mark a requested contract as signed and attach the PDF. Only the admin role
 * (or the service-role client) may call this, because the signed file is the
 * legal record of the booking.
 */
export async function signContract(input: unknown): Promise<Result<null>> {
  const parsed = signContractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("sign_contract", {
    p_contract_id: parsed.data.contractId,
    p_file_path: parsed.data.filePath,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
