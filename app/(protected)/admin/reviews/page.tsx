import type { Metadata } from "next";
import { ReviewModerationPanel } from "@/features/admin/components/review-moderation-panel";
import { getPendingReviews } from "@/features/admin/queries";
import { requireRole } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).admin.reviewModeration };
}

export default async function AdminReviewsPage() {
  await requireRole("admin");
  const reviews = await getPendingReviews();

  return <ReviewModerationPanel reviews={reviews} />;
}
