import type { Metadata } from "next";
import { RestorePanel } from "@/features/admin/components/restore-panel";
import { getDeletedRecords } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).admin.restore };
}

export default async function AdminRestorePage() {
  await requireRole("admin");
  const records = await getDeletedRecords();

  return <RestorePanel records={records} />;
}
