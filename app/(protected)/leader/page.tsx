import type { Metadata } from "next";
import { LeaderDashboard } from "@/features/leader/components/leader-dashboard";
import { getLeaderData } from "@/features/field/queries";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.leader };
}

export default async function LeaderPage() {
  await requireRole("leader");
  const data = await getLeaderData();
  return <LeaderDashboard units={data.units} teamMembers={data.teamMembers} visits={data.visits} />;
}
