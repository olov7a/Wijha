import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getI18n } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.login };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string; reset?: string }>;
}) {
  const { error, registered, reset } = await searchParams;
  const { t } = await getI18n();

  return (
    <div>
      <p className="text-sm font-bold text-teal">{t.auth.login.eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.login.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate">{t.auth.login.description}</p>
      {registered === "1" && (
        <p role="status" className="mt-6 rounded-2xl bg-approved-soft px-4 py-3 text-sm leading-6 text-approved-ink">
          {t.auth.errors.signupSuccess}
        </p>
      )}
      {reset === "1" && (
        <p role="status" className="mt-6 rounded-2xl bg-approved-soft px-4 py-3 text-sm leading-6 text-approved-ink">
          {t.auth.reset.success}
        </p>
      )}
      {error === "confirmation" && (
        <p role="alert" className="mt-6 rounded-2xl bg-rejected-soft px-4 py-3 text-sm leading-6 text-rejected-ink">
          {t.auth.login.confirmationError}
        </p>
      )}
      {error === "already_confirmed" && (
        <p role="alert" className="mt-6 rounded-2xl bg-pending-soft px-4 py-3 text-sm leading-6 text-pending-ink">
          {t.auth.login.alreadyConfirmed}
        </p>
      )}
      <AuthForm mode="login" configured={isSupabaseConfigured()} />
    </div>
  );
}
