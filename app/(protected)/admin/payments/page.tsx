import type { Metadata } from "next";
import { PaymentsPanel } from "@/features/admin/components/payments-panel";
import { getAdminBookings } from "@/features/admin/admin-data";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).admin.payments };
}

export default async function AdminPaymentsPage() {
  await requireRole("admin");
  const bookings = await getAdminBookings();
  return <PaymentsPanel bookings={bookings} />;
}
