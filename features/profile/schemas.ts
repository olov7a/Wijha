import { z } from "zod";
import { parsePhone } from "@/lib/validation/phone";

export const updateMyBasicProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().trim().refine((value) => parsePhone(value).ok, { message: "phone" }),
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
