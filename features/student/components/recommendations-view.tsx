"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { amenities as amenityIcons } from "@/features/units/components/unit-amenity";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { GenderBadge, Rating, VerifiedBadge } from "@/components/ui/status";
import {
  BedIcon,
  CheckIcon,
  FilterIcon,
  MapPinIcon,
  MessageIcon,
  SearchIcon,
  ShieldIcon,
  SparkIcon,
  StarIcon,
  XIcon,
} from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { amenityLabels, localize, type AmenityKey, type SampleUnit, type UnitGender } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

type GenderFilter = "all" | UnitGender;
type RoomFilter = "all" | "shared" | "private";
type SleepPattern = "night" | "early";

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

const criticalAmenities: AmenityKey[] = ["wifi", "ac", "desk", "security"];

function distanceMinutes(unit: SampleUnit) {
  const text = localize(unit.distance, "en").trim();
  if (!text) return null;
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function clampScore(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function MatchGauge({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));

  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="3.2" className="text-line" />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray={`${safe} 100`}
          className="text-teal"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold text-teal" dir="ltr">
        {safe}%
      </span>
    </div>
  );
}

function RecommendationCard({
  unit,
  score,
  reasons,
}: {
  unit: SampleUnit;
  score: number;
  reasons: string[];
}) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const name = localize(unit.name, locale);

  return (
    <article className="group overflow-hidden rounded-panel border border-line bg-surface shadow-card transition duration-300 hover:shadow-panel">
      <Link href={`/units/${unit.id}`} className="relative block h-52 overflow-hidden sm:h-60">
        <div className={cn("absolute inset-0 bg-gradient-to-br", toneStyles[unit.imageTone])} />
        <div className="absolute inset-0 opacity-[0.08] blueprint" />
        <div className="absolute inset-0 grid place-items-center text-teal/35">
          <BedIcon className="size-20" strokeWidth={1.1} />
        </div>
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm">
            <SparkIcon className="size-3.5" />
            {score}% {copy.recommendations.match}
          </span>
          <VerifiedBadge tone="surface" />
        </div>
      </Link>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold leading-snug">
              <Link href={`/units/${unit.id}`} className="transition-colors hover:text-teal">
                {name}
              </Link>
            </h3>
            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-6 text-slate">
              <MapPinIcon className="mt-0.5 size-4 shrink-0" />
              {localize(unit.area, locale)}
            </p>
          </div>
          <Rating value={unit.rating} className="shrink-0" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GenderBadge gender={unit.gender} />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-slate">
            <BedIcon className="size-4" />
            {localize(unit.roomTypeLabel, locale)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-slate">
            <MapPinIcon className="size-4" />
            {localize(unit.distance, locale)}
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-canvas p-3.5">
          <p className="text-xs font-bold text-teal">{copy.recommendations.reasons}</p>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {reasons.map((reason) => (
              <li key={reason} className="flex items-start gap-1.5 text-xs leading-6 text-slate">
                <CheckIcon className="mt-1 size-3.5 shrink-0 text-approved" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate">{copy.recommendations.current}</span>
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {["م", "ع"].map((initial, index) => (
              <span
                key={initial}
                className={cn(
                  "grid size-7 place-items-center rounded-full border-2 border-surface font-display text-[11px] font-bold",
                  index === 0 ? "bg-mint text-teal-dark" : "bg-brown/15 text-brown-ink",
                )}
              >
                {initial}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-slate">{copy.recommendations.roommate}</span>
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-5 text-approved-ink">
          <ShieldIcon className="mt-px size-4 shrink-0" />
          {copy.recommendations.deposit}
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-xl font-bold text-teal">{numberFormatter.format(unit.price)}</span>
            <span className="text-xs text-slate">{copy.recommendations.perBed}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/units/${unit.id}#reviews`} variant="secondary" size="sm">
              <MessageIcon className="size-4" />
              {copy.recommendations.chat}
            </ButtonLink>
            <ButtonLink href={`/book/${unit.id}`} size="sm">
              {copy.recommendations.request}
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}

export function RecommendationsView({ units }: { units: SampleUnit[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);

  // The database already matched these units to the student's profile, so the
  // tuner starts wide open and only narrows on purpose. The price ceiling grows
  // with the real inventory instead of hiding valid matches above 4,000 EGP.
  const budgetCeiling = Math.max(
    6000,
    Math.ceil(units.reduce((max, unit) => Math.max(max, unit.price), 0) / 1000) * 1000,
  );

  const [gender, setGender] = useState<GenderFilter>("all");
  const [budget, setBudget] = useState(() => budgetCeiling);
  const [maxDistance, setMaxDistance] = useState(15);
  const [room, setRoom] = useState<RoomFilter>("all");
  const [required, setRequired] = useState<AmenityKey[]>([]);
  const [sleep, setSleep] = useState<SleepPattern>("night");
  const [sameMajor, setSameMajor] = useState(true);
  const [showTuner, setShowTuner] = useState(false);

  const results = useMemo(() => {
    const list = units
      .filter((unit) => {
        if (gender !== "all" && unit.gender !== gender) return false;
        if (unit.price > budget) return false;
        const distance = distanceMinutes(unit);
        if (distance !== null && distance > maxDistance) return false;
        if (room !== "all" && unit.roomType !== room) return false;
        if (required.some((amenity) => !unit.amenities.includes(amenity))) return false;
        return true;
      })
      .map((unit) => {
        // Scores come only from match_units. Until the RPC returns a score we
        // show a neutral baseline instead of fabricated boosts.
        const score = unit.matchScore ?? 80;
        return { unit, score: clampScore(score) };
      })
      .sort((a, b) => b.score - a.score);

    return list;
  }, [budget, gender, maxDistance, required, room, units]);

  const averageScore = results.length
    ? Math.round(results.reduce((total, item) => total + item.score, 0) / results.length)
    : 0;

  function toggleRequired(amenity: AmenityKey) {
    setRequired((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity],
    );
  }

  function reset() {
    setGender("all");
    setBudget(budgetCeiling);
    setMaxDistance(15);
    setRoom("all");
    setRequired([]);
    setSleep("night");
    setSameMajor(true);
  }

  function reasonsFor(unit: SampleUnit, score: number) {
    const reasons: string[] = [];
    if (score >= 92) reasons.push(copy.recommendations.quiet);
    if (unit.availableBeds === 1) reasons.push(copy.recommendations.beds);
    reasons.push(...unit.tags.slice(0, 2).map((tag) => localize(tag, locale)));
    if (unit.amenities.includes("ac")) reasons.push(copy.recommendations.ac);
    return Array.from(new Set(reasons)).slice(0, 4);
  }

  const tuner = (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <FilterIcon className="size-5 text-teal" />
          {copy.recommendations.editTitle}
        </h2>
        <button type="button" onClick={reset} className="text-xs font-bold text-brown-ink hover:underline">
          {copy.recommendations.reset}
        </button>
      </div>

      <fieldset>
        <legend className="text-sm font-bold">{copy.explore.gender}</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["all", copy.explore.all],
              ["female", copy.explore.female],
              ["male", copy.explore.male],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setGender(value)}
              aria-pressed={gender === value}
              className={cn(
                "min-h-10 rounded-xl border px-2 text-xs font-bold transition",
                gender === value ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="match-budget" className="flex items-center gap-1.5 text-sm font-bold">
            <StarIcon className="size-4 text-pending" />
            {copy.recommendations.budget}
          </label>
          <span className="text-xs font-bold text-teal">
            {numberFormatter.format(budget)} {copy.unit.perBed}
          </span>
        </div>
        <input
          id="match-budget"
          type="range"
          min={1500}
          max={budgetCeiling}
          step={100}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-teal"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate" dir="ltr">
          <span>1,500</span>
          <span>{numberFormatter.format(budgetCeiling)}</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="match-distance" className="flex items-center gap-1.5 text-sm font-bold">
            <MapPinIcon className="size-4 text-teal" />
            {copy.recommendations.maxDistance}
          </label>
          <span className="text-xs font-bold text-teal">
            {maxDistance} {copy.explore.minutes}
          </span>
        </div>
        <input
          id="match-distance"
          type="range"
          min={3}
          max={30}
          step={1}
          value={maxDistance}
          onChange={(event) => setMaxDistance(Number(event.target.value))}
          className="mt-3 h-2 w-full cursor-pointer accent-teal"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate" dir="ltr">
          <span>3</span>
          <span>30</span>
        </div>
      </div>

      <fieldset>
        <legend className="flex items-center gap-1.5 text-sm font-bold">
          <BedIcon className="size-4 text-teal" />
          {copy.explore.roomType}
        </legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["all", copy.explore.all],
              ["shared", copy.explore.shared],
              ["private", copy.explore.private],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRoom(value)}
              aria-pressed={room === value}
              className={cn(
                "min-h-10 rounded-xl border px-2 text-[11px] font-bold leading-4 transition",
                room === value ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal/50",
              )}
            >
              {value === "all" ? label : value === "shared" ? copy.explore.shared.split("(")[0].trim() : copy.explore.private}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">{copy.recommendations.sleep}</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ["night", copy.recommendations.night],
              ["early", copy.recommendations.early],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSleep(value)}
              aria-pressed={sleep === value}
              className={cn(
                "min-h-10 rounded-xl border px-2 text-[11px] font-bold leading-4 transition",
                sleep === value ? "border-teal bg-teal/10 text-teal" : "border-line bg-surface text-slate hover:border-teal/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-3">
        <span>
          <span className="block text-xs font-bold">{copy.recommendations.major}</span>
          <span className="mt-0.5 block text-[11px] leading-5 text-slate">{copy.recommendations.majorHint}</span>
        </span>
        <input
          type="checkbox"
          checked={sameMajor}
          onChange={(event) => setSameMajor(event.target.checked)}
          className="mt-1 size-4 accent-teal"
        />
      </label>

      <fieldset>
        <legend className="text-sm font-bold">{copy.recommendations.living}</legend>
        <div className="mt-3 grid gap-2">
          {criticalAmenities.map((amenity) => {
            const Icon = amenityIcons[amenity];
            return (
              <label key={amenity} className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate hover:text-ink">
                <input
                  type="checkbox"
                  checked={required.includes(amenity)}
                  onChange={() => toggleRequired(amenity)}
                  className="size-4 accent-teal"
                />
                <Icon className="size-4 text-teal" />
                {localize(amenityLabels[amenity], locale)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-xl bg-mint/25 p-3.5">
        <p className="flex items-center gap-2 text-xs font-bold text-teal-dark">
          <ShieldIcon className="size-4" />
          {copy.recommendations.guarantee}
        </p>
        <p className="mt-1.5 text-[11px] leading-5 text-slate">{copy.recommendations.guaranteeBody}</p>
      </div>

      <Button type="button" className="w-full lg:hidden" onClick={() => setShowTuner(false)}>
        {copy.recommendations.resultCount} ({results.length})
      </Button>
    </div>
  );

  return (
    <div>
      <section className="relative overflow-hidden rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -top-20 -start-16 size-64 rounded-full bg-mint/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -end-20 size-64 rounded-full bg-brown/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <span className="grid size-16 place-items-center rounded-full bg-gradient-to-tr from-teal to-mint font-display text-xl font-bold text-primary-foreground shadow-card">
                أ
              </span>
              <span className="absolute -bottom-1 -end-1 grid size-6 place-items-center rounded-full border-2 border-surface bg-approved text-white">
                <CheckIcon className="size-3.5" />
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-lg font-bold sm:text-xl">{copy.recommendations.title}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-2.5 py-1 text-[11px] font-bold text-teal">
                  <SparkIcon className="size-3.5" />
                  {copy.recommendations.engine}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{copy.recommendations.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  copy.profile.university,
                  `${numberFormatter.format(budget)} EGP`,
                  copy.recommendations.smokeFree,
                  copy.recommendations.night,
                ].map((chip) => (
                  <span key={chip} className="rounded-lg bg-canvas px-2.5 py-1 text-[11px] text-slate">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-canvas px-4 py-3">
            <div>
              <p className="text-[11px] text-slate">{copy.recommendations.analyze}</p>
              <p className="font-display text-lg font-bold text-teal" dir="ltr">
                {averageScore}%
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-approved-ink">
                <CheckIcon className="size-3.5" />
                {results.length} {copy.recommendations.resultCount}
              </p>
            </div>
            <MatchGauge value={averageScore} />
          </div>
        </div>
      </section>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="sticky top-24 hidden rounded-panel border border-line bg-surface p-5 shadow-card lg:block">{tuner}</aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display font-bold">{copy.recommendations.results}</h2>
              <span className="text-xs text-slate">({results.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTuner(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-xs font-bold text-ink lg:hidden"
              >
                <FilterIcon className="size-4" />
                {copy.recommendations.edit}
              </button>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-canvas px-3 py-1.5 text-[11px] font-bold text-teal">
                <SparkIcon className="size-3.5" />
                {copy.recommendations.sort}
              </span>
            </div>
          </div>

          {results.length === 0 ? (
            <EmptyState
              className="mt-6"
              title={copy.recommendations.empty}
              description={copy.explore.emptyBody}
              icon={<SearchIcon className="size-6" />}
              action={
                <Button type="button" variant="secondary" onClick={reset}>
                  {copy.explore.reset}
                </Button>
              }
            />
          ) : (
            <div className="mt-5 grid gap-5">
              {results.map(({ unit, score }) => (
                <RecommendationCard key={unit.id} unit={unit} score={score} reasons={reasonsFor(unit, score)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showTuner && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={copy.recommendations.editTitle}>
          <button
            type="button"
            aria-label={copy.explore.reset}
            onClick={() => setShowTuner(false)}
            className="absolute inset-0 bg-strong/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-panel">
            <button
              type="button"
              onClick={() => setShowTuner(false)}
              aria-label={copy.recommendations.editTitle}
              className="absolute end-4 top-4 grid size-10 place-items-center rounded-full border border-line text-slate"
            >
              <XIcon className="size-5" />
            </button>
            <div className="pt-8">{tuner}</div>
          </div>
        </div>
      )}
    </div>
  );
}
