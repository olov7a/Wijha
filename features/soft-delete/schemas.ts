import { z } from "zod";

/** The five entities whose delete/restore RPCs are exposed to the app. */
export const softDeleteEntitySchema = z.enum(["unit", "room", "bed", "unit_visit", "review"]);
export type SoftDeleteEntity = z.infer<typeof softDeleteEntitySchema>;

/**
 * Payload accepted by every delete/restore action. `.strict()` rejects extra
 * fields instead of silently ignoring them.
 */
export const entityIdSchema = z.object({ id: z.uuid() }).strict();
export type EntityIdInput = z.infer<typeof entityIdSchema>;
