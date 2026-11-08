import type { Metadata } from "next";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { getAdminStats, getAuditLogs, getRecentUnits, getRecentUsers } from "@/features/admin/admin-data";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.admin };
}

export default async function AdminPage() {
  await requireRole("admin");
  const [stats, recentUsers, recentUnits, audit] = await Promise.all([
    getAdminStats(),
    getRecentUsers(),
    getRecentUnits(),
    getAuditLogs(),
  ]);
  return <AdminDashboard stats={stats} recentUsers={recentUsers} recentUnits={recentUnits} audit={audit} />;
}
