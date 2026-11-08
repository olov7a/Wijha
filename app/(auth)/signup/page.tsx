import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/auth-form";
import { getI18n } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/env";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.signup };
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const { t } = await getI18n();
  const defaultRole = role === "owner" ? "owner" : "student";

  return (
    <div>
      <p className="text-sm font-bold text-teal">{t.auth.signup.eyebrow}</p>
      <h1 className="mt-3 font-display text-3xl font-bold leading-relaxed">{t.auth.signup.title}</h1>
      <p className="mt-3 text-sm leading-7 text-slate">{t.auth.signup.description}</p>
      <AuthForm mode="signup" defaultRole={defaultRole} configured={isSupabaseConfigured()} />
    </div>
  );
}
