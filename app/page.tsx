import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { Brand } from "@/components/layout/brand";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";

export default async function Home() {
  const { t, locale } = await getI18n();
  const user = await getCurrentUser();
  const dashboardHref = user ? `/${user.role}` : null;
  const dashboardLabel = getPageCopy(locale).nav.dashboard;
  const profileLabel = getPageCopy(locale).nav.profile;

  return (
    <div className="overflow-hidden">
      <SiteHeader />
      <main>
        <section className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:pb-28 lg:pt-20">
          <div className="relative z-10">
            <p className="mb-6 flex items-center gap-3 text-sm font-bold text-teal">
              <span className="h-px w-9 bg-teal" />
              {t.home.eyebrow}
            </p>
            <h1 className="max-w-2xl font-display text-4xl font-bold leading-[1.45] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              {t.home.titleLine1}
              <span className="relative mt-1 block w-fit text-teal">
                {t.home.titleLine2}
                <svg
                  className="absolute -bottom-3 start-0 h-4 w-full text-brown-ink"
                  viewBox="0 0 400 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M4 13C100 2 276 4 396 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </span>
            </h1>
            <p className="mt-9 max-w-xl text-base leading-8 text-slate sm:text-lg">{t.home.description}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {dashboardHref ? (
                <>
                  <Link
                    href={dashboardHref}
                    className="rounded-full bg-primary px-7 py-3.5 text-center font-bold text-primary-foreground shadow-lg shadow-teal/15 transition hover:-translate-y-0.5 hover:bg-primary-hover"
                  >
                    {dashboardLabel}
                  </Link>
                  <Link
                    href="/profile"
                    className="rounded-full border border-brown bg-surface px-7 py-3.5 text-center font-bold text-brown-ink transition hover:-translate-y-0.5 hover:bg-brown hover:text-white"
                  >
                    {profileLabel}
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/signup?role=student"
                    className="rounded-full bg-primary px-7 py-3.5 text-center font-bold text-primary-foreground shadow-lg shadow-teal/15 transition hover:-translate-y-0.5 hover:bg-primary-hover"
                  >
                    {t.home.searchCta}
                  </Link>
                  <Link
                    href="/signup?role=owner"
                    className="rounded-full border border-brown bg-surface px-7 py-3.5 text-center font-bold text-brown-ink transition hover:-translate-y-0.5 hover:bg-brown hover:text-white"
                  >
                    {t.home.ownerCta}
                  </Link>
                </>
              )}
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate">
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brown" />
                {t.home.bullet1}
              </span>
              <span className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-brown" />
                {t.home.bullet2}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[520px] lg:mx-0" role="img" aria-label={t.home.illustrationLabel}>
            <div className="absolute -start-12 -top-12 size-44 rounded-full bg-mint/30 blur-3xl" />
            <div className="blueprint relative rounded-[2rem] border border-line bg-surface/75 p-5 shadow-2xl shadow-black/10 backdrop-blur sm:p-8 dark:shadow-black/50">
              <div className="mb-6 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate">{t.home.sampleUnit}</p>
                  <p className="mt-1 font-display text-lg font-bold">{t.home.routeTitle}</p>
                </div>
                <span className="shrink-0 rounded-full bg-teal/10 px-3 py-1.5 text-xs font-bold text-teal">
                  {t.home.stepsBadge}
                </span>
              </div>

              <div className="relative h-[330px] overflow-hidden rounded-3xl border-2 border-ink/70 bg-canvas/80 sm:h-[350px]">
                <div className="absolute start-0 top-0 h-[42%] w-[58%] border-b-2 border-e-2 border-ink/70 p-4">
                  <span className="text-xs font-bold text-slate">{t.home.room1}</span>
                  <div className="absolute bottom-5 start-5 h-16 w-24 rounded-lg border-2 border-teal/50 bg-surface" />
                </div>
                <div className="absolute end-0 top-0 h-[58%] w-[42%] border-b-2 border-s-2 border-ink/70 p-4">
                  <span className="text-xs font-bold text-slate">{t.home.living}</span>
                  <div className="absolute bottom-6 end-5 h-12 w-20 rounded-full border-2 border-brown/60 bg-surface" />
                </div>
                <div className="absolute bottom-0 start-0 h-[58%] w-[42%] border-e-2 border-ink/70 p-4">
                  <span className="text-xs font-bold text-slate">{t.home.room2}</span>
                  <div className="absolute bottom-5 start-5 h-16 w-24 rounded-lg border-2 border-teal/50 bg-surface" />
                </div>
                <div className="absolute bottom-0 end-0 h-[42%] w-[58%] border-t-2 border-ink/70 p-4">
                  <span className="text-xs font-bold text-slate">{t.home.entrance}</span>
                </div>
                <svg
                  className="pointer-events-none absolute inset-0 size-full ltr:-scale-x-100"
                  viewBox="0 0 440 350"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    className="route-path"
                    d="M80 310C80 260 198 280 198 217C198 153 103 183 103 116C103 62 215 82 312 58"
                    stroke="var(--color-teal)"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <circle cx="80" cy="310" r="9" fill="var(--color-brown)" stroke="var(--color-surface)" strokeWidth="4" />
                  <circle cx="312" cy="58" r="12" fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth="5" />
                </svg>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-bold sm:text-xs">
                <span className="rounded-xl border border-line bg-canvas py-2.5 text-slate shadow-sm">{t.home.submit}</span>
                <span className="rounded-xl border border-line bg-canvas py-2.5 text-slate shadow-sm">{t.home.review}</span>
                <span className="rounded-xl bg-primary py-2.5 text-primary-foreground shadow-sm">{t.home.book}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
            <div className="mb-10 max-w-xl">
              <p className="text-sm font-bold text-teal">{t.home.stepsEyebrow}</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-relaxed sm:text-3xl">{t.home.stepsTitle}</h2>
            </div>
            <ol className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {t.home.steps.map((step, index) => (
                <li key={step.title} className="bg-surface p-6 lg:min-h-52">
                  <span className="font-display text-sm font-bold text-brown-ink">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-6 font-display text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="rounded-[2rem] bg-strong px-6 py-10 text-white sm:px-10 lg:flex lg:items-center lg:justify-between lg:px-14">
            <div>
              <p className="text-sm font-bold text-mint">{t.home.ctaEyebrow}</p>
              <h2 className="mt-3 font-display text-2xl font-bold leading-relaxed sm:text-3xl">
                {dashboardHref ? (
                  locale === "ar" ? "أهلًا بيك، وحداتك وحجوزاتك جاهزة" : "Welcome back, your units and bookings are ready"
                ) : (
                  t.home.ctaTitle
                )}
              </h2>
            </div>
            {dashboardHref ? (
              <Link
                href={dashboardHref}
                className="mt-7 inline-block rounded-full bg-surface px-7 py-3.5 font-bold text-ink transition hover:bg-brown hover:text-white lg:mt-0 dark:bg-mint dark:text-strong"
              >
                {dashboardLabel}
              </Link>
            ) : (
              <Link
                href="/signup"
                className="mt-7 inline-block rounded-full bg-surface px-7 py-3.5 font-bold text-ink transition hover:bg-brown hover:text-white lg:mt-0 dark:bg-mint dark:text-strong"
              >
                {t.home.ctaButton}
              </Link>
            )}
          </div>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 pb-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand href={dashboardHref ?? "/"} />
        <p className="text-sm text-slate">{t.home.footer}</p>
      </footer>
    </div>
  );
}
