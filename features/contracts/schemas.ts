import { z } from "zod";

export const requestContractSchema = z
  .object({ bookingId: z.uuid() })
  .strict();

export type RequestContractInput = z.infer<typeof requestContractSchema>;

export const signContractSchema = z
  .object({
    contractId: z.uuid(),
    // Must start with the booking id; the RPC and the table constraint both
    // enforce it, this only rejects obviously bad input early.
    filePath: z.string().trim().min(3).max(1024).refine(
      (value) => !value.includes("..") && !value.startsWith("/"),
      { message: "Invalid storage path" },
    ),
  })
  .strict();

export type SignContractInput = z.infer<typeof signContractSchema>;
