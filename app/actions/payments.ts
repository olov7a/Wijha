"use server";

import { revalidatePath } from "next/cache";
import { guardAction, failureResult } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { confirmPaymentSchema, failPaymentSchema } from "@/features/payments/schemas";

const AFFECTED_PATHS = ["/student", "/owner", "/admin"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Record a successful charge. In production this is called by the payment
 * webhook with the service-role client; the admin role is accepted so a manual
 * bank transfer can be reconciled without a gateway.
 */
export async function confirmPayment(input: unknown): Promise<Result<null>> {
  const parsed = confirmPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("confirm_booking_payment", {
    p_booking_id: parsed.data.bookingId,
    p_gateway_reference: parsed.data.gatewayReference,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}

/** Record a failed charge and release the held bed. */
export async function failPayment(input: unknown): Promise<Result<null>> {
  const parsed = failPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("fail_booking_payment", {
    p_booking_id: parsed.data.bookingId,
    p_failure_reason: parsed.data.reason,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
