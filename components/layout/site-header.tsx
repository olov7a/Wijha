import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import { PublicBottomNav } from "@/components/layout/public-bottom-nav";
import { SiteControls } from "@/components/layout/site-controls";
import { UserIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

const navItems = [
  { key: "home", href: "/" },
  { key: "explore", href: "/explore" },
  { key: "recommendations", href: "/student/recommendations" },
  { key: "howItWorks", href: "/#how-it-works" },
  { key: "guarantee", href: "/#guarantee" },
] as const;

export async function SiteHeader() {
  const { t, locale } = await getI18n();
  const copy = getPageCopy(locale);
  const user = await getCurrentUser();
  const dashboardHref = user ? `/${user.role}` : "/";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-6">
            <Brand href={dashboardHref} />
            <nav className="hidden items-center gap-1 lg:flex" aria-label={t.common.mainNav}>
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-sm font-bold text-slate transition-colors hover:bg-canvas hover:text-teal"
                >
                  {copy.nav[item.key]}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <Link
                  href="/profile"
                  aria-label={copy.nav.profile}
                  className="grid size-11 place-items-center rounded-full border border-line bg-surface text-ink hover:border-teal hover:text-teal"
                >
                  <UserIcon className="size-5" />
                </Link>
                <Link
                  href={dashboardHref}
                  className="hidden items-center gap-2 rounded-full border border-line px-3 py-2 text-sm font-bold text-ink transition hover:border-teal hover:text-teal sm:inline-flex"
                >
                  <UserIcon className="size-4" />
                  {copy.nav.dashboard}
                </Link>
                <Link
                  href={dashboardHref}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-strong px-4 text-sm font-bold text-white transition hover:bg-primary hover:text-primary-foreground sm:hidden"
                >
                  {copy.nav.dashboard}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden rounded-full px-4 py-2 text-sm font-semibold text-ink transition hover:bg-surface sm:inline-flex"
                >
                  {t.nav.login}
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-strong px-4 text-sm font-semibold text-white transition hover:bg-primary hover:text-primary-foreground sm:px-5"
                >
                  {t.nav.signup}
                </Link>
              </>
            )}
            <SiteControls />
          </div>
        </div>
      </header>
      <PublicBottomNav userRole={user?.role} />
    </>
  );
}
