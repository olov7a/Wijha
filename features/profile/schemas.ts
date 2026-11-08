import { z } from "zod";

const PHONE_PATTERN = /^\+?[1-9][0-9]{7,14}$/;

export const updateMyBasicProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().regex(PHONE_PATTERN),
  })
  .strict();

export const ownerDocumentSchema = z
  .object({
    kind: z.enum(["id_document", "ownership_proof"]),
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
