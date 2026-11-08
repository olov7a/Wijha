import { z } from "zod";
import { parsePhone } from "@/lib/validation/phone";

const AMENITY_KEYS = [
  "wifi",
  "ac",
  "laundry",
  "gas",
  "elevator",
  "desk",
  "security",
] as const;

export const updateStudentProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().refine((value) => parsePhone(value).ok, { message: "phone" }),
    gender: z.enum(["male", "female"]),
    university: z.string().trim().max(160).optional(),
    studyYear: z.number().int().min(1).max(12).nullable().optional(),
    isSmoker: z.boolean(),
    hobbies: z.array(z.string().trim().max(40)).max(12),
    budgetMin: z.number().int().min(0).max(1_000_000).nullable().optional(),
    budgetMax: z.number().int().min(1).max(1_000_000).nullable().optional(),
    preferredAreas: z.array(z.string().trim().max(120)).max(10),
    preferredAmenities: z.array(z.enum(AMENITY_KEYS)).max(30),
  })
  .strict()
  .refine(
    (value) =>
      value.budgetMin == null || value.budgetMax == null || value.budgetMax >= value.budgetMin,
    { message: "budgetMax must be >= budgetMin", path: ["budgetMax"] },
  );

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;

export const studentDocumentSchema = z
  .object({
    kind: z.enum(["id_document", "university_card"]),
    path: z
      .string()
      .trim()
      .min(3)
      .max(1024)
      .refine((value) => !value.includes("..") && !value.startsWith("/"), {
        message: "Invalid storage path",
      }),
  })
  .strict();

export type StudentDocumentInput = z.infer<typeof studentDocumentSchema>;

export const contractIdSchema = z.object({ contractId: z.uuid() }).strict();
