import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClaimAdminButton } from "@/features/admin/components/claim-admin-button";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).admin.payments };
}

export default async function AdminBootstrapPage() {
  await requireUser();
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect("/admin");

  // Refuse early in the DB (server-side) when an admin already exists.
  let hasAdmin = false;
  try {
    const admin = createAdminClient();
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    hasAdmin = (count ?? 0) > 0;
  } catch {
    hasAdmin = false;
  }

  if (hasAdmin) {
    const { locale } = await getI18n();
    return (
      <Card className="mx-auto max-w-xl p-6">
        <h1 className="font-display text-xl font-bold">
          {locale === "ar" ? "يوجد أدمن بالفعل" : "An admin already exists"}
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate">
          {locale === "ar"
            ? "المنصة فيها أدمن واحد على الأقل. اطلب من الأدمن الحالي يرقي حسابك من /admin."
            : "The platform already has at least one admin. Ask the current admin to promote you from /admin."}
        </p>
      </Card>
    );
  }

  return <ClaimAdminButton />;
}
