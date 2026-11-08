"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/components/providers/locale-provider";
import { CheckIcon, StarIcon } from "@/components/ui/icons";

export type UnitStatus = "approved" | "pending" | "rejected";

const statusStyles: Record<UnitStatus, { chip: string; dot: string }> = {
  approved: { chip: "bg-approved-soft text-approved-ink", dot: "bg-approved" },
  pending: { chip: "bg-pending-soft text-pending-ink", dot: "bg-pending" },
  rejected: { chip: "bg-rejected-soft text-rejected-ink", dot: "bg-rejected" },
};

export function StatusChip({ status, label, className }: { status: UnitStatus; label?: string; className?: string }) {
  const style = statusStyles[status];
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        style.chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {label ?? t.common.status[status]}
    </span>
  );
}

export type UnitGender = "male" | "female";
export type BadgeTone = "tint" | "surface";

export function GenderBadge({ gender, tone = "tint", className }: { gender: UnitGender; tone?: BadgeTone; className?: string }) {
  const { t } = useI18n();
  const label = gender === "male" ? t.common.maleHousing : t.common.femaleHousing;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        gender === "male" ? "text-teal-dark" : "text-brown-ink",
        tone === "surface" ? "bg-surface/95 shadow-sm backdrop-blur" : gender === "male" ? "bg-teal/10" : "bg-brown/10",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", gender === "male" ? "bg-teal" : "bg-brown")}
      />
      {label}
    </span>
  );
}

export function VerifiedBadge({ tone = "tint", className, children }: { tone?: BadgeTone; className?: string; children?: ReactNode }) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-teal-dark",
        tone === "surface" ? "bg-surface/95 shadow-sm backdrop-blur" : "bg-mint/40",
        className,
      )}
    >
      <CheckIcon className="size-3.5" />
      {children ?? t.common.verified}
    </span>
  );
}

export function Rating({ value, className }: { value: number; className?: string }) {
  const { t } = useI18n();
  const safeValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), 5) : 0;

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-bold text-ink", className)}>
      <StarIcon className="size-4 text-pending" />
      <span dir="ltr">{safeValue.toFixed(1)}</span>
      <span className="sr-only">{t.common.outOfFive}</span>
    </span>
  );
}
