import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.forgotPassword };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { t } = await getI18n();

  return (
    <div>
      <p className="text-sm font-bold text-teal">{t.auth.forgot.eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.forgot.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate">{t.auth.forgot.description}</p>
      {error === "link_invalid" && (
        <p role="alert" className="mt-6 rounded-2xl bg-rejected-soft px-4 py-3 text-sm leading-6 text-rejected-ink">
          {t.auth.forgot.linkInvalid}
        </p>
      )}
      <ForgotPasswordForm configured={isSupabaseConfigured()} />
    </div>
  );
}
