"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp } from "@/app/actions/auth";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-field";
import { ResendConfirmationButton } from "@/features/auth/components/resend-confirmation-button";
import type { AuthState } from "@/features/auth/types";

function SubmitButton({ mode, configured }: { mode: "login" | "signup"; configured: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <Button type="submit" size="lg" disabled={pending || !configured} className="w-full">
      {pending ? t.auth.form.pending : mode === "login" ? t.auth.form.loginSubmit : t.auth.form.signupSubmit}
    </Button>
  );
}

export function AuthForm({
  mode,
  defaultRole = "student",
  configured,
}: {
  mode: "login" | "signup";
  defaultRole?: "student" | "owner";
  configured: boolean;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, {});
  const { t, locale: localeConfirm } = useI18n();
  const [role, setRole] = useState<"student" | "owner">(defaultRole);
  const formRef = useRef<HTMLFormElement>(null);

  // Show every field error under its input and keep valid fields intact.
  useEffect(() => {
    if (!state.fieldErrors) return;
    const form = formRef.current;
    if (!form) return;
    for (const [name, message] of Object.entries(state.fieldErrors)) {
      // Clear ONLY the wrong field so the user can retype it.
      const fields = form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
      fields.forEach((el) => {
        if (el.type !== "radio" && el.type !== "checkbox") el.value = "";
      });
      const target = document.getElementById(`error-${name}`) as HTMLElement | null;
      if (target) target.textContent = message;
    }
    const first = Object.keys(state.fieldErrors)[0];
    if (first) {
      const el = document.getElementById(`field-${first}`) as HTMLElement | null;
      el?.focus({ preventScroll: false });
    }
  }, [state]);

  // Login: when Supabase rejects credentials we must not reveal which
  // one is wrong, and we clear only the password field (keep the email).
  useEffect(() => {
    if (mode !== "login") return;
    if (state.error) {
      const form = formRef.current;
      if (!form) return;
      const pw = form.querySelector<HTMLInputElement>('input[name="password"]');
      if (pw) pw.value = "";
      const first = document.getElementById("field-password") as HTMLElement | null;
      first?.focus({ preventScroll: false });
    }
  }, [state, mode]);

  return (
    <form ref={formRef} action={formAction} className="mt-8 space-y-5" noValidate>
      <fieldset disabled={!configured} className="space-y-5">
        {mode === "signup" && (
          <>
            <div>
              <span className="text-sm font-bold">{t.auth.form.accountType}</span>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="student"
                    checked={role === "student"}
                    onChange={() => setRole("student")}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold transition peer-checked:border-teal peer-checked:bg-teal/5 peer-checked:text-teal peer-focus-visible:outline-3 peer-focus-visible:outline-brown">
                    {t.auth.form.student}
                  </span>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="owner"
                    checked={role === "owner"}
                    onChange={() => setRole("owner")}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold transition peer-checked:border-teal peer-checked:bg-teal/5 peer-checked:text-teal peer-focus-visible:outline-3 peer-focus-visible:outline-brown">
                    {t.auth.form.owner}
                  </span>
                </label>
              </div>
            </div>
            <Input
              name="fullName"
              type="text"
              label={t.auth.form.fullName}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
              placeholder={t.auth.form.fullNamePlaceholder}
              error={state.fieldErrors?.fullName}
            />
            <Input
              name="phone"
              type="tel"
              label={t.auth.form.phone}
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={20}
              dir="ltr"
              className="text-left"
              placeholder={t.auth.form.phonePlaceholder}
              hint={t.auth.errors.phoneHint}
              error={state.fieldErrors?.phone}
            />
            {role === "student" && (
              <div className="space-y-5 rounded-2xl border border-line bg-canvas/60 p-4">
                <div>
                  <p className="text-sm font-bold">{t.auth.form.studentDetails}</p>
                  <p className="mt-1 text-xs leading-6 text-slate">{t.auth.form.studentDetailsHint}</p>
                </div>
                <div>
                  <span className="text-sm font-bold">
                    {t.auth.form.gender}
                    <span aria-hidden="true" className="text-brown-ink"> *</span>
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <label className="cursor-pointer">
                      <input type="radio" name="gender" value="male" required className="peer sr-only" />
                      <span className="flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold transition peer-checked:border-teal peer-checked:bg-teal/5 peer-checked:text-teal peer-focus-visible:outline-3 peer-focus-visible:outline-brown">
                        {t.auth.form.male}
                      </span>
                    </label>
                    <label className="cursor-pointer">
                      <input type="radio" name="gender" value="female" required className="peer sr-only" />
                      <span className="flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-bold transition peer-checked:border-teal peer-checked:bg-teal/5 peer-checked:text-teal peer-focus-visible:outline-3 peer-focus-visible:outline-brown">
                        {t.auth.form.female}
                      </span>
                    </label>
                  </div>
                </div>
                <Input
                  name="university"
                  type="text"
                  label={t.auth.form.university}
                  maxLength={160}
                  placeholder={t.auth.form.universityPlaceholder}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Select name="studyYear" label={t.auth.form.studyYear} defaultValue="">
                    <option value="">—</option>
                    {Array.from({ length: 6 }, (_, index) => index + 1).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </Select>
                  <label className="flex min-h-12 items-center gap-3 self-end rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-bold">
                    <input type="checkbox" name="isSmoker" className="size-4 accent-teal" />
                    <span>
                      {t.auth.form.smoker}
                      <span className="mt-0.5 block text-xs font-normal leading-5 text-slate">
                        {t.auth.form.smokerHint}
                      </span>
                    </span>
                  </label>
                </div>
                <Input
                  name="hobbies"
                  type="text"
                  label={t.auth.form.hobbies}
                  maxLength={300}
                  placeholder={t.auth.form.hobbiesPlaceholder}
                />
              </div>
            )}
          </>
        )}
        <Input
          name="email"
          type="email"
          label={t.auth.form.email}
          inputMode="email"
          autoComplete="email"
          required
          maxLength={320}
          dir="ltr"
          className="text-left"
          placeholder="name@example.com"
          error={state.fieldErrors?.email}
        />
        <Input
          name="password"
          type="password"
          label={t.auth.form.password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
          maxLength={72}
          dir="ltr"
          className="text-left"
          placeholder={t.auth.form.passwordPlaceholder}
          hint={mode === "signup" ? t.auth.form.passwordHint : undefined}
          error={state.fieldErrors?.password}
        />
        {mode === "signup" && (
          <Input
            name="confirmPassword"
            type="password"
            label={localeConfirm === "ar" ? "تأكيد كلمة السر" : "Confirm password"}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            dir="ltr"
            className="text-left"
            placeholder={t.auth.form.passwordPlaceholder}
            error={state.fieldErrors?.confirmPassword}
          />
        )}
      </fieldset>

      {!configured && (
        <p role="alert" className="rounded-2xl bg-pending-soft px-4 py-3 text-sm leading-6 text-pending-ink">
          {t.auth.form.supabaseWarning}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-2xl bg-rejected-soft px-4 py-3 text-sm leading-6 text-rejected-ink">
          {state.error}
        </p>
      )}
      {mode === "login" && state.needsResend && state.email && (
        <ResendConfirmationButton email={state.email} />
      )}
      {state.success && (
        <p role="status" className="rounded-2xl bg-approved-soft px-4 py-3 text-sm leading-6 text-approved-ink">
          {state.success}
        </p>
      )}

      <SubmitButton mode={mode} configured={configured} />
      <p className="text-center text-sm text-slate">
        {mode === "login" ? t.auth.form.loginPrompt : t.auth.form.signupPrompt}{" "}
        <Link href={mode === "login" ? "/signup" : "/login"} className="font-bold text-teal hover:underline">
          {mode === "login" ? t.auth.form.signupLink : t.auth.form.loginLink}
        </Link>
      </p>
    </form>
  );
}
