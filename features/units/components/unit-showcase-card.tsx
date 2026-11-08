"use client";

import Link from "next/link";
import { useI18n } from "@/components/providers/locale-provider";
import { GenderBadge, Rating, VerifiedBadge } from "@/components/ui/status";
import { amenities as amenityIcons } from "@/features/units/components/unit-amenity";
import { BedIcon, MapPinIcon } from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { localize, type SampleUnit } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

const numberFormatter = new Intl.NumberFormat("en-US");

const toneStyles: Record<SampleUnit["imageTone"], string> = {
  mint: "from-mint/70 via-mint/30 to-surface",
  sand: "from-amber-200/60 via-amber-100/40 to-surface dark:from-amber-500/30 dark:via-amber-500/10",
  rose: "from-rose-200/60 via-rose-100/30 to-surface dark:from-rose-500/30 dark:via-rose-500/10",
  sky: "from-sky-200/60 via-sky-100/30 to-surface dark:from-sky-500/30 dark:via-sky-500/10",
  olive: "from-lime-200/60 via-lime-100/30 to-surface dark:from-lime-500/30 dark:via-lime-500/10",
  clay: "from-orange-200/60 via-orange-100/30 to-surface dark:from-orange-500/30 dark:via-orange-500/10",
  teal: "from-teal/30 via-mint/20 to-surface dark:from-teal/40 dark:via-teal/10",
  amber: "from-yellow-200/70 via-yellow-100/30 to-surface dark:from-yellow-500/30 dark:via-yellow-500/10",
};

export function UnitShowcaseCard({ unit, className }: { unit: SampleUnit; className?: string }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const name = localize(unit.name, locale);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-panel",
        className,
      )}
    >
      <Link href={`/units/${unit.id}`} className="relative block aspect-[16/10] overflow-hidden">
        <div className={cn("absolute inset-0 bg-gradient-to-br", toneStyles[unit.imageTone])} />
        <div className="absolute inset-0 opacity-[0.08] blueprint" />
        <div className="absolute inset-0 grid place-items-center text-teal/35">
          <BedIcon className="size-16" strokeWidth={1.2} />
        </div>
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <GenderBadge gender={unit.gender} tone="surface" />
          {unit.inspection && <VerifiedBadge tone="surface" />}
        </div>
        {typeof unit.matchScore === "number" && (
          <span className="absolute bottom-3 start-3 rounded-full bg-surface/95 px-3 py-1 text-xs font-bold text-teal shadow-sm backdrop-blur">
            {unit.matchScore}% {copy.recommendations.match}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-bold leading-snug">
            <Link href={`/units/${unit.id}`} className="transition-colors hover:text-teal">
              {name}
            </Link>
          </h3>
          <Rating value={unit.rating} className="shrink-0" />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-sm leading-6 text-slate">
          <MapPinIcon className="mt-0.5 size-4 shrink-0" />
          {localize(unit.area, locale)}
        </p>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate">
          <BedIcon className="size-4 shrink-0" />
          {localize(unit.roomTypeLabel, locale)}
          <span aria-hidden="true">·</span>
          <span dir="ltr">{unit.reviews}</span>
          {copy.unit.reviews}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {unit.tags.map((tag) => (
            <span key={tag.en} className="rounded-full bg-canvas px-2.5 py-1 text-[11px] font-bold text-slate">
              {localize(tag, locale)}
            </span>
          ))}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold text-teal">{numberFormatter.format(unit.price)}</span>
            <span className="text-xs text-slate">{copy.unit.perBed}</span>
          </p>
          <Link
            href={`/units/${unit.id}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground transition hover:bg-primary-hover"
          >
            {copy.unit.details}
          </Link>
        </div>
      </div>
    </article>
  );
}

export function AmenityIcon({ amenity, className }: { amenity: SampleUnit["amenities"][number]; className?: string }) {
  const Icon = amenityIcons[amenity];
  return <Icon className={className} />;
}
