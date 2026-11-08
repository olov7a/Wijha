"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  BedIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  HomeIcon,
  StarIcon,
} from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";
import type { ErrorCode } from "@/lib/errors";
import type { Result } from "@/lib/result";
import type { SoftDeleteEntity } from "@/features/soft-delete/schemas";
import type { DeletedRecord } from "@/features/admin/queries";
import { restoreBed, restoreRoom, restoreReview, restoreUnit, restoreUnitVisit } from "@/app/actions/soft-delete";
import { cn } from "@/lib/cn";

type RestoreAction = (input: unknown) => Promise<Result<null>>;

const RESTORE_ACTIONS: Record<SoftDeleteEntity, RestoreAction> = {
  unit: restoreUnit,
  room: restoreRoom,
  bed: restoreBed,
  unit_visit: restoreUnitVisit,
  review: restoreReview,
};

const ENTITY_ICONS = {
  unit: BuildingIcon,
  room: HomeIcon,
  bed: BedIcon,
  unit_visit: CalendarIcon,
  review: StarIcon,
} as const;

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function RestorePanel({ records }: { records: DeletedRecord[] }) {
  const { locale } = useI18n();
  const [items, setItems] = useState(records);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; code: ErrorCode } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const labels =
    locale === "ar"
      ? {
          title: "استرجاع المحذوفات",
          subtitle: "كل عنصر اتحذف من المنصة بيظهر هنا لمدة محدودة، وتقدر ترجّعه بضغطة واحدة.",
          empty: "مفيش عناصر محذوفة دلوقتي.",
          emptyHint: "أي وحدة أو غرفة أو سرير أو زيارة أو تقييم يتحذف هيظهر هنا.",
          restore: "استرجاع",
          restoring: "جاري الاسترجاع...",
          restored: "تم استرجاع العنصر",
          deletedAt: "اتحذف في",
          unit: "وحدة",
          room: "غرفة",
          bed: "سرير",
          unit_visit: "زيارة معاينة",
          review: "تقييم",
          inUnit: "داخل وحدة",
          inRoom: "داخل غرفة",
          visitOn: "معاينة مجدولة",
          rating: "تقييم",
          back: "رجوع للوحة الأدمن",
          note: "الاسترجاع بيرجّع العنصر هو وأبنائه اللي اتحذفوا معاه في نفس العملية.",
        }
      : {
          title: "Restore deleted items",
          subtitle: "Anything removed from the platform appears here for a limited time and can be restored in one click.",
          empty: "Nothing is deleted right now.",
          emptyHint: "Deleted units, rooms, beds, visits and reviews will appear here.",
          restore: "Restore",
          restoring: "Restoring...",
          restored: "Item restored",
          deletedAt: "Deleted",
          unit: "Unit",
          room: "Room",
          bed: "Bed",
          unit_visit: "Inspection visit",
          review: "Review",
          inUnit: "in unit",
          inRoom: "in room",
          visitOn: "Scheduled for",
          rating: "Rating",
          back: "Back to admin",
          note: "Restoring brings the item back together with the children deleted in the same operation.",
        };

  function restore(record: DeletedRecord) {
    const key = `${record.entity}-${record.id}`;
    setPendingId(key);
    setError(null);

    startTransition(async () => {
      const result = await RESTORE_ACTIONS[record.entity]({ id: record.id });
      setPendingId(null);

      if (!result.ok) {
        setError({ key, code: result.error });
        return;
      }

      setItems((current) => current.filter((item) => `${item.entity}-${item.id}` !== key));
      setToast(labels.restored);
      window.setTimeout(() => setToast(null), 2600);
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold sm:text-2xl">{labels.title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-7 text-slate">{labels.subtitle}</p>
        </div>
        <ButtonLink href="/admin" variant="secondary" className="w-full sm:w-auto">
          {labels.back}
        </ButtonLink>
      </div>

      <p className="mt-4 rounded-2xl border border-teal/20 bg-mint/20 px-4 py-3 text-[11px] font-bold leading-6 text-teal-dark">
        {labels.note}
      </p>

      {items.length === 0 ? (
        <section className="mt-5 rounded-panel border border-line bg-surface p-8 text-center shadow-card">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-canvas text-slate">
            <CheckIcon className="size-7" />
          </span>
          <h2 className="mt-4 font-display text-lg font-bold">{labels.empty}</h2>
          <p className="mt-2 text-sm leading-7 text-slate">{labels.emptyHint}</p>
        </section>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((record) => {
            const key = `${record.entity}-${record.id}`;
            const Icon = ENTITY_ICONS[record.entity];
            const isPending = pendingId === key;
            const rowError = error?.key === key ? error : null;

            const parent =
              record.parentTitle &&
              (record.entity === "room"
                ? `${labels.inUnit} ${record.parentTitle}`
                : record.entity === "bed"
                  ? `${labels.inRoom} ${record.parentTitle}`
                  : record.parentTitle);

            const title =
              record.entity === "unit"
                ? record.title
                : record.entity === "room"
                  ? record.title
                  : record.entity === "bed"
                    ? record.title
                    : record.entity === "unit_visit"
                      ? `${labels.visitOn} ${record.detail ? dateFormatter.format(new Date(record.detail)) : "—"}`
                      : `${labels.rating} ${record.detail ?? "—"} / 5`;

            return (
              <li key={key} className="rounded-panel border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rejected-soft text-rejected-ink">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-slate">
                        {labels[record.entity]}
                      </span>
                      <p className="truncate text-sm font-bold">{title || "—"}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate">
                      {parent ? `${parent} · ` : ""}
                      {labels.deletedAt}: <span dir="ltr">{dateFormatter.format(new Date(record.deletedAt))}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className={cn("min-h-9 px-3 text-[11px]", isPending && "opacity-60")}
                    onClick={() => restore(record)}
                    disabled={isPending}
                  >
                    <CheckIcon className="size-3.5" />
                    {isPending ? labels.restoring : labels.restore}
                  </Button>
                </div>

                {rowError && (
                  <p role="alert" className="mt-3 rounded-xl bg-rejected-soft px-3 py-2 text-xs font-bold text-rejected-ink">
                    {actionErrorMessage(locale, rowError.code)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-strong px-4 py-3 text-xs font-bold text-surface shadow-card lg:bottom-6"
        >
          <CheckIcon className="size-4" />
          {toast}
        </div>
      )}
    </div>
  );
}
