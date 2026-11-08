import type { Metadata } from "next";
import { ExploreView } from "@/features/explore/components/explore-view";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ChevronLeftIcon, MapPinIcon, ShieldIcon } from "@/components/ui/icons";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { getUnitListings } from "@/features/units/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);
  return { title: copy.nav.explore };
}

export default async function ExplorePage() {
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);
  const units = await getUnitListings();

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <section className="border-b border-line bg-surface">
          <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
              <span>{copy.explore.breadcrumb}</span>
              <ChevronLeftIcon className="size-4 ltr:hidden" />
              <ChevronLeftIcon className="hidden size-4 rotate-180 rtl:hidden" />
              <span className="font-bold text-ink">{copy.explore.area}</span>
            </div>

            <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-approved-soft px-3 py-1.5 text-xs font-bold text-approved-ink">
                  <ShieldIcon className="size-4" />
                  {copy.explore.trust}
                </p>
                <h1 className="mt-3 max-w-2xl font-display text-2xl font-bold leading-relaxed sm:text-3xl">
                  {copy.explore.title}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
                <span className="inline-flex items-center gap-1.5">
                  <MapPinIcon className="size-4 text-teal" />
                  {copy.explore.area}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-ink">{units.length}</strong> {copy.explore.unit}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <ExploreView units={units} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
