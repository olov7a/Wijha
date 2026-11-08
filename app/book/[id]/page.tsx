import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/features/booking/components/booking-flow";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ChevronLeftIcon, ShieldIcon } from "@/components/ui/icons";
import { getI18n } from "@/lib/i18n/server";
import { getPageCopy } from "@/lib/i18n/pages";
import { localize } from "@/lib/sample-data";
import { getUnitView } from "@/features/units/queries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const unit = await getUnitView(id);
  const { locale } = await getI18n();
  return { title: unit ? `${copyTitle(locale, localize(unit.name, locale))}` : undefined };
}

function copyTitle(locale: string, name: string) {
  return locale === "ar" ? `حجز ${name}` : `Book ${name}`;
}

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const unit = await getUnitView(id);
  const { locale } = await getI18n();
  const copy = getPageCopy(locale);

  if (!unit) notFound();

  return (
    <div className="min-h-screen bg-canvas">
      <SiteHeader />
      <main className="pb-24 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate">
            <Link href={`/units/${unit.id}`} className="inline-flex items-center gap-1 hover:text-teal">
              <ChevronLeftIcon className="size-4 rotate-180" />
              {copy.nav.explore}
            </Link>
            <span aria-hidden="true">·</span>
            <span className="max-w-[240px] truncate font-bold text-ink sm:max-w-none">{localize(unit.name, locale)}</span>
          </div>

          <div className="mt-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-approved-soft px-3 py-1.5 text-xs font-bold text-approved-ink">
                <ShieldIcon className="size-4" />
                {copy.booking.secure}
              </p>
              <h1 className="mt-3 font-display text-2xl font-bold leading-relaxed sm:text-3xl">{copy.booking.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">{copy.booking.subtitle}</p>
            </div>
            <p className="text-sm text-slate">
              {copy.booking.stepOf.replace("{current}", "1").replace("{total}", "3")}
            </p>
          </div>

          <div className="mt-7">
            <BookingFlow unit={unit} rooms={unit.rooms} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
