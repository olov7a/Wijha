"use server";

import { revalidatePath } from "next/cache";
import { guardAction, failureResult, isRateLimited } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { confirmPaymentSchema, declineRefundSchema, failPaymentSchema, refundPaymentSchema } from "@/features/payments/schemas";

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

  // 20 payment confirmations per hour per admin (stops reconciliation spam).
  const limited = await isRateLimited(guard.supabase, "payment.confirmed", 20, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

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

  // 20 payment failures per hour per admin.
  const limited = await isRateLimited(guard.supabase, "payment.failed", 20, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  const { error } = await guard.supabase.rpc("fail_booking_payment", {
    p_booking_id: parsed.data.bookingId,
    p_failure_reason: parsed.data.reason,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}

/** Refund a captured payment. Admin-only; writes payment.refunded to audit. */
export async function refundPayment(input: unknown): Promise<Result<null>> {
  const parsed = refundPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const limited = await isRateLimited(guard.supabase, "payment.refunded", 20, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  const { error } = await guard.supabase.rpc("refund_booking_payment", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}

/**
 * Execute the transfer for a refund the policy already approved
 * (`refund_pending` -> `refunded`). Admin-only.
 */
export async function confirmRefund(input: unknown): Promise<Result<null>> {
  const parsed = refundPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const limited = await isRateLimited(guard.supabase, "payment.refund_confirmed", 20, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  const { error } = await guard.supabase.rpc("confirm_booking_refund", {
    p_booking_id: parsed.data.bookingId,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}

/** Reject a pending refund and return the payment to `paid`. Admin-only. */
export async function declineRefund(input: unknown): Promise<Result<null>> {
  const parsed = declineRefundSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["admin"] });
  if (!guard.ok) return guard;

  const limited = await isRateLimited(guard.supabase, "payment.refund_declined", 20, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  const { error } = await guard.supabase.rpc("decline_booking_refund", {
    p_booking_id: parsed.data.bookingId,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
