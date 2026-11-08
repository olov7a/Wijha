"use server";

import { revalidatePath } from "next/cache";
import { guardAction, failureResult, isRateLimited } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { cancelBookingSchema, createBookingSchema } from "@/features/booking/schemas";

const AFFECTED_PATHS = ["/student", "/owner", "/explore", "/admin"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Reserve a bed (or a whole room when `bedId` is null). The RPC locks the unit,
 * room and bed, enforces gender separation, snapshots the commission and creates
 * a pending payment; the booking starts in `pending_payment` until a trusted
 * caller confirms the charge.
 */
export async function createBooking(input: unknown): Promise<Result<{ bookingId: string }>> {
  const parsed = createBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student"] });
  if (!guard.ok) return guard;

  // 5 successful bookings per hour per student (stops bed-flooding) — backed
  // by the booking.created audit entries the RPC already writes.
  const limited = await isRateLimited(guard.supabase, guard.user.id, "booking.created", 5, 60);
  if (limited) return { ok: false, error: ERROR_CODES.FORBIDDEN };

  const { data, error } = await guard.supabase.rpc("create_booking", {
    p_unit_id: parsed.data.unitId,
    p_room_id: parsed.data.roomId,
    p_bed_id: parsed.data.bedId,
    p_move_in_date: parsed.data.moveInDate,
    p_move_out_date: parsed.data.moveOutDate,
  });

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  revalidateAffected();
  return { ok: true, data: { bookingId: data } };
}

/** Cancel a pending or confirmed booking. Students, the unit owner and admins. */
export async function cancelBooking(input: unknown): Promise<Result<null>> {
  const parsed = cancelBookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["student", "owner", "admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data.bookingId,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
