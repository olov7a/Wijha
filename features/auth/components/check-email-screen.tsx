"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/locale-provider";
import { ResendConfirmationButton } from "@/features/auth/components/resend-confirmation-button";

/**
 * "Check your email" screen shown after signup: echoes the address that was
 * entered, offers a resend (60-second cooldown), and links back to login.
 */
export function CheckEmailScreen({ email }: { email: string }) {
  const { t } = useI18n();

  return (
    <div>
      <p className="text-sm font-bold text-teal">{t.auth.checkEmail.eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.checkEmail.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate">{t.auth.checkEmail.description}</p>

      <div className="mt-6 rounded-2xl border border-line bg-canvas/60 px-4 py-3">
        <p className="text-sm leading-6 text-slate">{t.auth.checkEmail.sentTo}</p>
        <p dir="ltr" className="mt-1 text-left text-sm font-bold leading-6 text-ink">
          {email}
        </p>
      </div>

      <ResendConfirmationButton email={email} className="mt-6" />

      <p className="mt-6 text-center text-sm text-slate">
        <Link href="/login" className="font-bold text-teal hover:underline">
          {t.auth.checkEmail.backToLogin}
        </Link>
      </p>
    </div>
  );
}
