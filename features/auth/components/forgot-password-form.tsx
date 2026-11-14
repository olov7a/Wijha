"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset } from "@/app/actions/auth";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-field";
import { TurnstileWidget } from "@/features/auth/components/turnstile-widget";
import type { AuthState } from "@/features/auth/types";

function SubmitButton({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <Button type="submit" size="lg" disabled={pending || !configured} className="w-full">
      {pending ? t.auth.forgot.pending : t.auth.forgot.submit}
    </Button>
  );
}

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  const { t } = useI18n();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  if (state.success) {
    return (
      <div className="mt-8 space-y-5">
        <div role="status" className="rounded-2xl bg-approved-soft px-4 py-4 text-sm leading-7 text-approved-ink">
          <p className="font-bold">{t.auth.forgot.sentTitle}</p>
          <p className="mt-1">{state.success}</p>
        </div>
        <p className="text-center text-sm text-slate">
          <Link href="/login" className="font-bold text-teal hover:underline">
            {t.auth.forgot.backToLogin}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <fieldset disabled={!configured} className="space-y-5">
        <Input
          name="email"
          type="email"
          label={t.auth.forgot.emailLabel}
          inputMode="email"
          autoComplete="email"
          required
          maxLength={320}
          dir="ltr"
          className="text-left"
          placeholder="name@example.com"
          error={state.fieldErrors?.email}
        />
        <TurnstileWidget onToken={setCaptchaToken} />
        <input type="hidden" name="captchaToken" value={captchaToken ?? ""} />
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

      <SubmitButton configured={configured} />
      <p className="text-center text-sm text-slate">
        {t.auth.forgot.noAccount}{" "}
        <Link href="/signup" className="font-bold text-teal hover:underline">
          {t.auth.forgot.signupLink}
        </Link>
      </p>
    </form>
  );
}
