"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { UnitShowcaseCard } from "@/features/units/components/unit-showcase-card";
import { amenities } from "@/features/units/components/unit-amenity";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterIcon, SearchIcon, ShieldIcon, XIcon } from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { amenityLabels, localize, type AmenityKey, type SampleUnit, type UnitGender } from "@/lib/sample-data";
import { cn } from "@/lib/cn";

type GenderFilter = "all" | UnitGender;
type RoomFilter = "all" | "shared" | "private";
type SortKey = "match" | "price" | "rating" | "distance";

const priceFormatter = new Intl.NumberFormat("en-US");

export function ExploreView({ units }: { units: SampleUnit[] }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const [gender, setGender] = useState<GenderFilter>("all");
  const [maxPrice, setMaxPrice] = useState(6000);
  const [room, setRoom] = useState<RoomFilter>("all");
  const [sort, setSort] = useState<SortKey>("match");
  const [selectedAmenities, setSelectedAmenities] = useState<AmenityKey[]>([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const list = units.filter((unit) => {
      if (gender !== "all" && unit.gender !== gender) return false;
      if (unit.price > maxPrice) return false;
      if (room !== "all" && unit.roomType !== room) return false;
      if (verifiedOnly && !unit.inspection) return false;
      if (selectedAmenities.some((amenity) => !unit.amenities.includes(amenity))) return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sort === "price") return a.price - b.price;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "match") return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      return a.price - b.price;
    });
  }, [gender, maxPrice, room, selectedAmenities, sort, units, verifiedOnly]);

  function toggleAmenity(amenity: AmenityKey) {
    setSelectedAmenities((current) =>
      current.includes(amenity) ? current.filter((item) => item !== amenity) : [...current, amenity],
    );
  }

  function reset() {
    setGender("all");
    setMaxPrice(6000);
    setRoom("all");
    setSelectedAmenities([]);
    setVerifiedOnly(false);
    setSort("match");
  }

  const filterPanel = (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <FilterIcon className="size-5 text-teal" />
          {copy.explore.filters}
        </h2>
        <button type="button" onClick={reset} className="text-xs font-bold text-brown-ink hover:underline">
          {copy.explore.reset}
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
                gender === value
                  ? "border-teal bg-teal/10 text-teal"
                  : "border-line bg-surface text-slate hover:border-teal/50",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="explore-price" className="text-sm font-bold">
            {copy.explore.price}
          </label>
          <span className="text-xs font-bold text-teal">
            {copy.explore.upTo} {priceFormatter.format(maxPrice)} {copy.unit.perBed}
          </span>
        </div>
        <input
          id="explore-price"
          type="range"
          min={1500}
          max={6000}
          step={100}
          value={maxPrice}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          className="mt-4 h-2 w-full cursor-pointer accent-teal"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate" dir="ltr">
          <span>1,500</span>
          <span>6,000</span>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-bold">{copy.explore.roomType}</legend>
        <div className="mt-3 space-y-2">
          {(
            [
              ["all", copy.explore.all],
              ["shared", copy.explore.shared],
              ["private", copy.explore.private],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 text-xs font-medium leading-6 hover:border-teal/40">
              <input
                type="radio"
                name="room"
                checked={room === value}
                onChange={() => setRoom(value)}
                className="mt-1 accent-teal"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">{copy.explore.amenities}</legend>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {(Object.keys(amenities) as AmenityKey[]).map((amenity) => {
            const Icon = amenities[amenity];
            return (
              <label key={amenity} className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-slate hover:text-ink">
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="size-4 accent-teal"
                />
                <Icon className="size-4 text-teal" />
                {localize(amenityLabels[amenity], locale)}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-3 py-3">
        <span className="flex items-center gap-2 text-xs font-bold">
          <ShieldIcon className="size-4 text-teal" />
          {copy.explore.verifiedOnly}
        </span>
        <input
          type="checkbox"
          checked={verifiedOnly}
          onChange={(event) => setVerifiedOnly(event.target.checked)}
          className="size-4 accent-teal"
        />
      </label>

      <Button type="button" className="w-full" onClick={() => setShowFilters(false)}>
        {copy.explore.apply} ({filtered.length} {copy.explore.unit})
      </Button>
    </div>
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[300px_1fr]">
      <aside className="sticky top-24 hidden rounded-panel border border-line bg-surface p-5 shadow-card lg:block">
        {filterPanel}
      </aside>

      <div className="min-w-0">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold">
            {filtered.length} {copy.explore.unit}{" "}
            <span className="font-normal text-slate">{copy.explore.availableSuffix}</span>
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-xs font-bold text-ink lg:hidden"
            >
              <FilterIcon className="size-4" />
              {copy.explore.filters}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate">
              <span className="hidden sm:inline">{copy.explore.sortBy}</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="min-h-11 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-ink outline-none focus:border-teal"
              >
                <option value="match">{copy.explore.sortMatch}</option>
                <option value="price">{copy.explore.sortPrice}</option>
                <option value="rating">{copy.explore.sortRating}</option>
                <option value="distance">{copy.explore.sortDistance}</option>
              </select>
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="mt-6"
            title={copy.explore.emptyTitle}
            description={copy.explore.emptyBody}
            icon={<SearchIcon className="size-6" />}
            action={
              <Button type="button" variant="secondary" onClick={reset}>
                {copy.explore.reset}
              </Button>
            }
          />
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {filtered.map((unit) => (
              <UnitShowcaseCard key={unit.id} unit={unit} />
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-panel border border-teal/25 bg-mint/20 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="flex items-center gap-2 font-display font-bold text-teal-dark">
              <ShieldIcon className="size-5" />
              {copy.explore.guarantee}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate">{copy.explore.guaranteeBody}</p>
          </div>
          <Link href="/#guarantee" className="shrink-0 text-sm font-bold text-brown-ink hover:underline">
            {copy.explore.guaranteeLink}
          </Link>
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={copy.explore.filters}>
          <button
            type="button"
            aria-label={copy.explore.reset}
            onClick={() => setShowFilters(false)}
            className="absolute inset-0 bg-strong/40 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-8 shadow-panel">
            <button
              type="button"
              onClick={() => setShowFilters(false)}
              aria-label={copy.explore.filters}
              className="absolute end-4 top-4 grid size-10 place-items-center rounded-full border border-line text-slate"
            >
              <XIcon className="size-5" />
            </button>
            <div className="pt-8">{filterPanel}</div>
          </div>
        </div>
      )}
    </div>
  );
}
