import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createBookingSchema = z
  .object({
    unitId: z.uuid(),
    roomId: z.uuid(),
    bedId: z.uuid().nullable(),
    moveInDate: isoDate,
    moveOutDate: isoDate.nullable(),
  })
  .strict()
  .refine(
    (value) => !value.moveOutDate || value.moveOutDate > value.moveInDate,
    { message: "moveOutDate must be after moveInDate", path: ["moveOutDate"] },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z
  .object({
    bookingId: z.uuid(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
