"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mapAuthError } from "@/lib/auth/auth-errors";
import { getEmailRedirectTo, getPasswordResetRedirectTo } from "@/lib/auth/site-url";
import { toE164 } from "@/lib/validation/phone";
import { createClient } from "@/lib/supabase/server";
import {
  createForgotPasswordSchema,
  createLoginSchema,
  createResetPasswordSchema,
  createSignupSchema,
} from "@/features/auth/schemas";
import type { AuthState } from "@/features/auth/types";

function fieldErrorsFromIssues(issues: { path: readonly (string | number | symbol)[]; message: string }[]) {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !map[key]) map[key] = issue.message;
  }
  return map;
}

function readCaptchaToken(formData: FormData) {
  const value = formData.get("captchaToken");
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export async function signIn(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const t = getDictionary(await getLocale());

  if (!isSupabaseConfigured()) return { error: t.auth.errors.notConfigured };

  const parsed = createLoginSchema(t).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? t.auth.errors.reviewData,
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { captchaToken: readCaptchaToken(formData) },
  });

  if (error) {
    const locale = await getLocale();
    const mapped = mapAuthError(error, locale);
    return {
      error: mapped.message,
      errorCode: mapped.code,
      email: parsed.data.email,
      needsResend: mapped.needsResend,
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUp(_previousState: AuthState, formData: FormData): Promise<AuthState> {
  const t = getDictionary(await getLocale());

  if (!isSupabaseConfigured()) return { error: t.auth.errors.notConfigured };

  const parsed = createSignupSchema(t).safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
    phone: formData.get("phone"),
    gender: formData.get("gender") ?? undefined,
    university: formData.get("university") ?? undefined,
    studyYear: formData.get("studyYear") ?? undefined,
    isSmoker: formData.get("isSmoker") === "on",
    hobbies: formData.get("hobbies") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFromIssues(parsed.error.issues);
    // Empty password fields get cleared so the user can retype them.
    if (fieldErrors.password) fieldErrors.confirmPassword = fieldErrors.password;
    if (fieldErrors.confirmPassword) {
      fieldErrors.password = fieldErrors.confirmPassword;
    }
    return {
      error: parsed.error.issues[0]?.message ?? t.auth.errors.reviewData,
      fieldErrors,
    };
  }

  const phoneE164 = toE164(parsed.data.phone);

  const hobbies = (parsed.data.hobbies ?? "")
    .split(/[,،]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((value) => value.slice(0, 40));

  const metadata: Record<string, unknown> = {
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    phone: phoneE164 ?? parsed.data.phone,
  };

  if (parsed.data.role === "student") {
    metadata.gender = parsed.data.gender;
    metadata.university = parsed.data.university || null;
    metadata.study_year = parsed.data.studyYear ? Number(parsed.data.studyYear) : null;
    metadata.is_smoker = parsed.data.isSmoker;
    metadata.hobbies = hobbies;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: getEmailRedirectTo(),
      data: metadata,
      captchaToken: readCaptchaToken(formData),
    },
  });

  if (error) {
    const locale = await getLocale();
    const mapped = mapAuthError(error, locale);
    return {
      error: mapped.message,
      errorCode: mapped.code,
      email: parsed.data.email,
    };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  // Account created but email not confirmed yet: send the user to the
  // check-email screen where they can confirm (and resend) from the inbox.
  revalidatePath("/", "layout");
  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

/**
 * Send a recovery link. The response is intentionally identical whether or not
 * the email belongs to an account, so this action cannot be used to enumerate
 * users. Only infrastructure failures (mail rate limit, CAPTCHA) are surfaced.
 */
export async function requestPasswordReset(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = getDictionary(await getLocale());

  if (!isSupabaseConfigured()) return { error: t.auth.errors.notConfigured };

  const parsed = createForgotPasswordSchema(t).safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? t.auth.errors.reviewData,
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: getPasswordResetRedirectTo(),
    captchaToken: readCaptchaToken(formData),
  });

  if (error) {
    const locale = await getLocale();
    const mapped = mapAuthError(error, locale);
    const mustSurface =
      mapped.code === "over_email_send_rate_limit" ||
      mapped.code === "captcha_failed" ||
      mapped.code === "email_address_invalid";

    if (mustSurface) {
      return { error: mapped.message, errorCode: mapped.code, email: parsed.data.email };
    }
    // Any other failure is hidden to avoid user enumeration.
  }

  return { success: t.auth.forgot.sentBody, email: parsed.data.email };
}

/** Save a new password after the recovery link created a session. */
export async function updatePassword(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = getDictionary(await getLocale());

  if (!isSupabaseConfigured()) return { error: t.auth.errors.notConfigured };

  const parsed = createResetPasswordSchema(t).safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFromIssues(parsed.error.issues);
    if (fieldErrors.password) fieldErrors.confirmPassword = fieldErrors.password;
    if (fieldErrors.confirmPassword) fieldErrors.password = fieldErrors.confirmPassword;
    return {
      error: parsed.error.issues[0]?.message ?? t.auth.errors.reviewData,
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: t.auth.reset.invalidBody };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    const locale = await getLocale();
    const mapped = mapAuthError(error, locale);
    return { error: mapped.message, errorCode: mapped.code };
  }

  // Do not keep a recovery session alive after the password changed: the user
  // signs in again with the new password.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login?reset=1");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
