import type { Metadata } from "next";
import { RecommendationsView } from "@/features/student/components/recommendations-view";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { getRecommendedUnits } from "@/features/student/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).recommendations.title };
}

export default async function StudentRecommendationsPage() {
  await requireRole("student");
  const units = await getRecommendedUnits();

  return <RecommendationsView units={units} />;
}
