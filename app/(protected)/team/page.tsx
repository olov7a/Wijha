import type { Metadata } from "next";
import { TeamDashboard } from "@/features/team/components/team-dashboard";
import { getTeamVisits } from "@/features/field/queries";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.team };
}

export default async function TeamPage() {
  await requireRole("team");
  const visits = await getTeamVisits();
  return <TeamDashboard visits={visits} />;
}
