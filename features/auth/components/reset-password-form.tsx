"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updatePassword } from "@/app/actions/auth";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-field";
import type { AuthState } from "@/features/auth/types";

function SubmitButton({ configured }: { configured: boolean }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <Button type="submit" size="lg" disabled={pending || !configured} className="w-full">
      {pending ? t.auth.reset.pending : t.auth.reset.submit}
    </Button>
  );
}

export function ResetPasswordForm({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState<AuthState, FormData>(updatePassword, {});
  const { t } = useI18n();

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <fieldset disabled={!configured} className="space-y-5">
        <Input
          name="password"
          type="password"
          label={t.auth.reset.newPassword}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          dir="ltr"
          className="text-left"
          placeholder={t.auth.form.passwordPlaceholder}
          hint={t.auth.form.passwordHint}
          error={state.fieldErrors?.password}
        />
        <Input
          name="confirmPassword"
          type="password"
          label={t.auth.reset.confirmPassword}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          dir="ltr"
          className="text-left"
          placeholder={t.auth.form.passwordPlaceholder}
          error={state.fieldErrors?.confirmPassword}
        />
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
    </form>
  );
}
