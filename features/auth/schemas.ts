import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { parsePhone } from "@/lib/validation/phone";

/**
 * Validation messages follow the request locale, so the schemas are built per
 * call instead of being created once at module load.
 */
export function createLoginSchema(t: Dictionary) {
  return z.object({
    email: z.email(t.auth.errors.invalidEmail).max(320),
    password: z.string().min(8, t.auth.errors.passwordMin).max(72),
  });
}

/** Forgot-password request: only the email is needed. */
export function createForgotPasswordSchema(t: Dictionary) {
  return z.object({
    email: z.email(t.auth.errors.invalidEmail).max(320),
  });
}

/** Set a new password after following a recovery link. */
export function createResetPasswordSchema(t: Dictionary) {
  return z
    .object({
      password: z.string().min(8, t.auth.errors.passwordMin).max(72),
      confirmPassword: z.string().min(1, t.auth.errors.reviewData),
    })
    .superRefine((value, ctx) => {
      if (value.password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: t.auth.errors.passwordMismatch,
        });
      }
    });
}

export function createSignupSchema(t: Dictionary) {
  return createLoginSchema(t)
    .extend({
      fullName: z.string().trim().min(2, t.auth.errors.fullNameMin).max(100, t.auth.errors.fullNameMax),
      role: z.enum(["student", "owner"], t.auth.errors.roleRequired),
      phone: z
        .string()
        .trim()
        .refine((value) => parsePhone(value).ok, { message: t.auth.errors.phoneInvalid }),
      gender: z.enum(["male", "female"], t.auth.errors.genderRequired).optional(),
      university: z.string().trim().max(160).optional(),
      studyYear: z
        .string()
        .trim()
        .refine((value) => value === "" || (/^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 12), {
          message: t.auth.errors.studyYearInvalid,
        })
        .optional(),
      isSmoker: z.boolean(),
      hobbies: z.string().trim().max(300).optional(),
      confirmPassword: z.string().min(1, t.auth.errors.reviewData),
    })
    .superRefine((value, ctx) => {
      if (value.role === "student" && !value.gender) {
        ctx.addIssue({
          code: "custom",
          path: ["gender"],
          message: t.auth.errors.genderRequired,
        });
      }
      if (value.password !== value.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: t.auth.errors.passwordMismatch,
        });
      }
    });
}
