import type { Metadata } from "next";
import { ProfileView } from "@/features/profile/components/profile-view";
import { getMyProfile } from "@/features/profile/queries";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { EmptyState } from "@/components/ui/empty-state";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getPageCopy(locale).nav.profile };
}

/** Private page: only ever shows the signed-in user's own row. */
export default async function ProfilePage() {
  await requireUser();
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);
  const profile = await getMyProfile();

  if (!profile) {
    return (
      <EmptyState
        title={copy.nav.profile}
        description={locale === "ar" ? "تعذر تحميل بروفايلك. حدث الصفحة أو سجل الدخول مرة أخرى." : "We couldn't load your profile. Refresh or sign in again."}
      />
    );
  }

  return <ProfileView profile={profile} />;
}
