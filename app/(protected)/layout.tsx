import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/components/layout/brand";
import { DashboardBottomNav, DashboardSidebar } from "@/components/layout/dashboard-nav";
import { SiteControls } from "@/components/layout/site-controls";
import { requireUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { roleLabels } from "@/lib/roles";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { locale, t } = await getI18n();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <Brand href={`/${user.role}`} />
            <span className="hidden rounded-full bg-teal/10 px-3 py-1.5 text-xs font-bold text-teal md:inline">
              {roleLabels[locale][user.role]}
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/profile"
              className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-bold text-ink hover:border-teal hover:text-teal sm:inline-flex"
            >
              {getPageCopy(locale).nav.profile}
            </Link>
            <SiteControls />
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-full border border-line px-3 text-sm font-bold text-ink transition hover:border-teal hover:text-teal sm:px-4"
              >
                {t.protected.logout}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <DashboardSidebar role={user.role} />
        <main className="min-w-0 flex-1 px-5 pb-28 pt-6 sm:px-8 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <DashboardBottomNav role={user.role} />
    </div>
  );
}
