import { z } from "zod";

/**
 * MVP only supports reviewing a unit after a confirmed booking. Reviewing a
 * student is still an open product decision, so the schema keeps it out.
 */
export const submitReviewSchema = z
  .object({
    unitId: z.uuid(),
    rating: z.number().int().min(1).max(5),
    body: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

export const moderateReviewSchema = z
  .object({
    reviewId: z.uuid(),
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
