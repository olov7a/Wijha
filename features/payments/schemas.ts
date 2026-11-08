import { z } from "zod";

export const confirmPaymentSchema = z
  .object({
    bookingId: z.uuid(),
    gatewayReference: z.string().trim().min(3).max(200),
  })
  .strict();

export type ConfirmPaymentInput = z.infer<typeof confirmPaymentSchema>;

export const failPaymentSchema = z
  .object({
    bookingId: z.uuid(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type FailPaymentInput = z.infer<typeof failPaymentSchema>;

export const refundPaymentSchema = z
  .object({ bookingId: z.uuid() })
  .strict();

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
