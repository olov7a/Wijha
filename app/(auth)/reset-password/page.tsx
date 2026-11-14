import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.resetPassword };
}

export default async function ResetPasswordPage() {
  const { t } = await getI18n();
  const configured = isSupabaseConfigured();
  const user = configured ? await getCurrentUser() : null;

  // The recovery link creates the session in /auth/callback. Without one there
  // is nothing to update, so show a clear "request a new link" state instead of
  // a form that would fail on submit.
  if (!user) {
    return (
      <div>
        <p className="text-sm font-bold text-teal">{t.auth.reset.eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.reset.invalidTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-slate">{t.auth.reset.invalidBody}</p>
        <p className="mt-6 text-sm text-slate">
          <Link href="/forgot-password" className="font-bold text-teal hover:underline">
            {t.auth.reset.requestNewLink}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-bold text-teal">{t.auth.reset.eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.reset.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate">{t.auth.reset.description}</p>
      <ResetPasswordForm configured={configured} />
    </div>
  );
}
