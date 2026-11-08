import { z } from "zod";

export const submitEvaluationSchema = z
  .object({
    visitId: z.uuid(),
    checklist: z
      .record(z.string(), z.boolean())
      .default({})
      .refine((value) => Object.keys(value).length <= 20, { message: "checklist too large" }),
    score: z.number().int().min(0).max(100),
    photoPaths: z
      .array(z.string().trim().min(3).max(1024))
      .max(10)
      .default([])
      .refine((value) => value.every((p) => !p.includes("..")), { message: "Invalid storage path" }),
  })
  .strict();

export const scheduleVisitSchema = z
  .object({
    unitId: z.uuid(),
    teamMemberId: z.uuid(),
    scheduledAt: z.string().min(4).max(40),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const updateVisitStatusSchema = z
  .object({
    visitId: z.uuid(),
    status: z.enum(["scheduled", "completed", "cancelled"]),
  })
  .strict();
