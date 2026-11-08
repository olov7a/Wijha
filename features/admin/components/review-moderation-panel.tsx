"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckIcon, StarIcon, XIcon } from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";
import type { ErrorCode } from "@/lib/errors";
import { moderateReview } from "@/app/actions/reviews";
import type { PendingReview } from "@/features/admin/queries";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function ReviewModerationPanel({ reviews }: { reviews: PendingReview[] }) {
  const { locale } = useI18n();
  const [items, setItems] = useState(reviews);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; code: ErrorCode } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const labels =
    locale === "ar"
      ? {
          title: "مراجعة التقييمات",
          subtitle: "راجع تقييمات الطلاب قبل نشرها. التقييم المعتمد بس هو اللي بيظهر في صفحة الوحدة.",
          empty: "مفيش تقييمات بانتظار المراجعة.",
          emptyHint: "أي تقييم جديد من طالب بحجز مؤكد هيظهر هنا.",
          approve: "اعتماد",
          reject: "رفض",
          working: "جاري التنفيذ...",
          approved: "تم اعتماد التقييم ونشره",
          rejected: "تم رفض التقييم",
          by: "بواسطة",
          onUnit: "على وحدة",
          noBody: "التقييم من غير نص.",
          back: "رجوع للوحة الأدمن",
        }
      : {
          title: "Review moderation",
          subtitle: "Check student reviews before they go live. Only approved reviews appear on the unit page.",
          empty: "No reviews are waiting for moderation.",
          emptyHint: "New reviews from students with a confirmed booking will show up here.",
          approve: "Approve",
          reject: "Reject",
          working: "Working...",
          approved: "Review approved and published",
          rejected: "Review rejected",
          by: "by",
          onUnit: "on",
          noBody: "Rating only, no written review.",
          back: "Back to admin",
        };

  function decide(review: PendingReview, status: "approved" | "rejected") {
    setPendingId(review.id);
    setError(null);

    startTransition(async () => {
      const result = await moderateReview({ reviewId: review.id, status });
      setPendingId(null);

      if (!result.ok) {
        setError({ id: review.id, code: result.error });
        return;
      }

      setItems((current) => current.filter((item) => item.id !== review.id));
      setToast(status === "approved" ? labels.approved : labels.rejected);
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
          {items.map((review) => {
            const isPending = pendingId === review.id;
            const rowError = error?.id === review.id ? error : null;

            return (
              <li key={review.id} className="rounded-panel border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-pending-soft px-2.5 py-1 text-[11px] font-bold text-pending-ink">
                        <StarIcon className="size-3.5 fill-current" />
                        <span dir="ltr">{review.rating}</span> / 5
                      </span>
                      <p className="text-sm font-bold">
                        {review.unitTitle ?? labels.onUnit}
                        {review.unitTitle && (
                          <span className="ms-2 text-[11px] font-normal text-slate">
                            #{review.unitId.slice(0, 8)}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-slate">
                      {review.body ? `“${review.body}”` : <span className="italic">{labels.noBody}</span>}
                    </p>
                    <p className="mt-2 text-[11px] text-slate">
                      {labels.by} {review.authorName ?? "—"} · <span dir="ltr">{dateFormatter.format(new Date(review.createdAt))}</span>
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-9 px-3 text-[11px]"
                      onClick={() => decide(review, "approved")}
                      disabled={isPending}
                    >
                      <CheckIcon className="size-3.5" />
                      {isPending ? labels.working : labels.approve}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      className="min-h-9 px-3 text-[11px]"
                      onClick={() => decide(review, "rejected")}
                      disabled={isPending}
                    >
                      <XIcon className="size-3.5" />
                      {isPending ? labels.working : labels.reject}
                    </Button>
                  </div>
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
