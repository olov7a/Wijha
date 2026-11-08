import type { Metadata } from "next";
import { OwnerDashboard } from "@/features/owner/components/owner-dashboard";
import { getOwnerDashboard } from "@/features/owner/queries";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).nav.dashboard };
}

export default async function OwnerPage() {
  await requireRole("owner");
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);
  const current = await getCurrentUser();
  const name = current?.fullName?.split(" ")[0] ?? copy.booking.studentName;
  const data = await getOwnerDashboard();

  if (!data) {
    return (
      <EmptyState
        title={copy.owner.unitsTitle}
        description={locale === "ar" ? "تعذر تحميل لوحة المالك." : "Owner dashboard could not be loaded."}
      />
    );
  }

  return <OwnerDashboard name={name} data={data} />;
}
