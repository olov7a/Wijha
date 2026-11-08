"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { ButtonLink } from "@/components/ui/button";
import { CheckIcon, MessageIcon, ShieldIcon } from "@/components/ui/icons";
import { getPageCopy } from "@/lib/i18n/pages";
import { type SampleUnit } from "@/lib/sample-data";

const numberFormatter = new Intl.NumberFormat("en-US");

export function UnitBookingCard({ unit }: { unit: SampleUnit }) {
  const { locale } = useI18n();
  const copy = getPageCopy(locale);
  const [months, setMonths] = useState(4);
  const [startDate, setStartDate] = useState("2026-10-01");

  const totalRent = unit.price * months;
  const deposit = 1000;
  const dueNow = unit.price + deposit;

  return (
    <aside className="rounded-panel border border-line bg-surface p-5 shadow-panel lg:sticky lg:top-24">
      <div className="flex items-end justify-between gap-3 border-b border-line pb-5">
        <div>
          <p className="text-xs text-slate">{copy.unit.startingFrom}</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold text-teal">{numberFormatter.format(unit.price)}</span>
            <span className="text-xs font-bold text-slate">{copy.unit.perMonth}</span>
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-approved-soft px-2.5 py-1 text-[11px] font-bold text-approved-ink">
          <CheckIcon className="size-3.5" />
          {copy.unit.included}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block text-xs font-bold">
          {copy.unit.duration}
          <select
            value={months}
            onChange={(event) => setMonths(Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-teal"
          >
            <option value={4}>{copy.unit.durationTerm}</option>
            <option value={9}>{copy.unit.durationYear}</option>
            <option value={1}>{copy.unit.durationTrial}</option>
          </select>
        </label>

        <label className="block text-xs font-bold">
          {copy.unit.startDate}
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-teal"
          />
        </label>
      </div>

      <div className="mt-5 space-y-2.5 rounded-2xl bg-canvas p-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate">
            {copy.unit.rentMultiple.replace("4", String(months))}
          </span>
          <span className="font-bold">{numberFormatter.format(totalRent)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate">{copy.unit.deposit}</span>
          <span className="font-bold">{numberFormatter.format(deposit)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate">{copy.unit.service}</span>
          <span className="font-bold text-approved-ink">{copy.unit.free}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
          <span className="font-bold">{copy.unit.total}</span>
          <span className="font-display text-lg font-bold text-teal">{numberFormatter.format(dueNow)}</span>
        </div>
        <p className="text-[11px] text-slate">{copy.unit.depositNote}</p>
      </div>

      <ButtonLink href={`/book/${unit.id}`} size="lg" className="mt-5 w-full">
        {copy.unit.book}
      </ButtonLink>

      <Link
        href={`/book/${unit.id}`}
        className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full border border-line px-4 text-xs font-bold text-slate transition hover:border-teal hover:text-teal"
      >
        <MessageIcon className="size-4" />
        {copy.unit.ask}
      </Link>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-slate">
        <ShieldIcon className="mt-0.5 size-4 shrink-0 text-teal" />
        {copy.unit.noCharge}
      </p>
    </aside>
  );
}
