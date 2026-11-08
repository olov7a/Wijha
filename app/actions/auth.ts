"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getLocale } from "@/lib/i18n/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { toE164 } from "@/lib/validation/phone";
import { createClient } from "@/lib/supabase/server";
import { createLoginSchema, createSignupSchema } from "@/features/auth/schemas";
import type { AuthState } from "@/features/auth/types";

function fieldErrorsFromIssues(issues: { path: readonly (string | number | symbol)[]; message: string }[]) {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !map[key]) map[key] = issue.message;
  }
  return map;
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
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: t.auth.errors.emailNotConfirmed };
    }
    return { error: t.auth.errors.invalidCredentials };
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
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      data: metadata,
    },
  });

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: t.auth.errors.emailRateLimit };
    }
    if (error.code === "email_address_invalid") {
      return { error: t.auth.errors.invalidEmail };
    }
    return { error: t.auth.errors.signupFailed };
  }
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }

  return { success: t.auth.errors.signupSuccess };
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/");
}
