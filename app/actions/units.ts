"use server";

import { revalidatePath } from "next/cache";
import { failureResult, guardAction } from "@/lib/action-pipeline";
import { ERROR_CODES } from "@/lib/errors";
import type { Result } from "@/lib/result";
import { createUnitSchema, updateUnitStatusSchema } from "@/features/owner/schemas";

const AFFECTED_PATHS = ["/owner", "/owner/units", "/explore", "/admin"] as const;

function revalidateAffected() {
  AFFECTED_PATHS.forEach((path) => revalidatePath(path));
}

/**
 * Create a unit together with its rooms and beds in one RPC. Doing the inserts
 * separately from the client would leave a half-built listing when a bed fails,
 * so the database transaction owns the whole inventory.
 *
 * Photos are uploaded afterwards by the browser straight into the
 * `unit-photos/{unitId}/...` folder, because they can exceed the Server Action
 * body limit.
 */
export async function createUnit(input: unknown): Promise<Result<{ unitId: string }>> {
  const parsed = createUnitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["owner"] });
  if (!guard.ok) return guard;

  const { error, data } = await guard.supabase.rpc("create_unit", {
    p_title: parsed.data.title,
    p_area: parsed.data.area,
    p_gender: parsed.data.gender,
    p_description: parsed.data.description ?? null,
    p_amenities: parsed.data.amenities,
    p_rooms: parsed.data.rooms.map((room) => ({
      name: room.name,
      beds: room.beds.map((bed) => ({
        label: bed.label,
        price_piastres: bed.price * 100,
      })),
    })),
  });

  if (error) return failureResult(error);
  if (!data) return { ok: false, error: ERROR_CODES.UNEXPECTED };

  revalidateAffected();
  return { ok: true, data: { unitId: data } };
}

/** Approve or reject a listing. Leaders and admins only, enforced by RLS too. */
export async function setUnitStatus(input: unknown): Promise<Result<null>> {
  const parsed = updateUnitStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: ERROR_CODES.INVALID_INPUT };

  const guard = await guardAction({ roles: ["leader", "admin"] });
  if (!guard.ok) return guard;

  const { error } = await guard.supabase
    .from("units")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.unitId);

  if (error) return failureResult(error);

  revalidateAffected();
  return { ok: true, data: null };
}
