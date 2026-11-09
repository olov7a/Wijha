import type { Metadata } from "next";
import Link from "next/link";
import { CheckEmailScreen } from "@/features/auth/components/check-email-screen";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.checkEmail.title };
}

function isEmailLike(value: string | undefined) {
  return Boolean(value && value.includes("@") && value.length <= 320);
}

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  const { t } = await getI18n();

  if (!isEmailLike(email)) {
    return (
      <div>
        <p className="text-sm font-bold text-teal">{t.auth.checkEmail.eyebrow}</p>
        <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.checkEmail.missingEmailTitle}</h1>
        <p className="mt-3 text-sm leading-7 text-slate">{t.auth.checkEmail.missingEmailBody}</p>
        <p className="mt-6 text-sm text-slate">
          <Link href="/signup" className="font-bold text-teal hover:underline">
            {t.auth.checkEmail.signupLink}
          </Link>
        </p>
      </div>
    );
  }

  return <CheckEmailScreen email={email as string} />;
}
