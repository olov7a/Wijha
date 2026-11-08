"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { CheckIcon, StarIcon } from "@/components/ui/icons";
import { actionErrorMessage } from "@/lib/action-errors";
import { submitReview } from "@/app/actions/reviews";
import { cn } from "@/lib/cn";

export function ReviewForm({ unitId }: { unitId: string }) {
  const { locale } = useI18n();
  const [pending, startTransition] = useTransition();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const labels =
    locale === "ar"
      ? {
          title: "قيّم تجربتك في الوحدة",
          hint: "التقييم بيظهر بعد مراجعة فريق وجهة، وبيتاح للطلاب اللي عندهم حجز مؤكد فقط.",
          placeholder: "اكتب تجربتك مع الوحدة والموقع والمرافق...",
          submit: "إرسال التقييم",
          sending: "جاري الإرسال...",
          sent: "تم إرسال تقييمك وهو بانتظار المراجعة.",
          sentHint: "هنراجعه قبل النشر عشان نضمن إنه مفيد وموثوق.",
        }
      : {
          title: "Rate your stay",
          hint: "Reviews are published after a WIJHA check and are only open to students with a confirmed booking.",
          placeholder: "Tell us about the unit, the area and the amenities...",
          submit: "Submit review",
          sending: "Submitting...",
          sent: "Your review was sent and is awaiting moderation.",
          sentHint: "We review it before publishing to keep feedback useful and trustworthy.",
        };

  function send() {
    setError("");
    startTransition(async () => {
      const result = await submitReview({
        unitId,
        rating,
        ...(body.trim() ? { body: body.trim() } : {}),
      });

      if (!result.ok) {
        setError(actionErrorMessage(locale, result.error));
        return;
      }

      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="rounded-panel border border-approved/30 bg-approved-soft p-5">
        <p className="flex items-center gap-2 text-sm font-bold text-approved-ink">
          <CheckIcon className="size-4" />
          {labels.sent}
        </p>
        <p className="mt-1.5 text-xs leading-6 text-approved-ink/80">{labels.sentHint}</p>
      </div>
    );
  }

  return (
    <div className="rounded-panel border border-line bg-surface p-5 shadow-card">
      <h3 className="font-display text-base font-bold">{labels.title}</h3>
      <p className="mt-1 text-[11px] leading-5 text-slate">{labels.hint}</p>

      <div className="mt-4 flex items-center gap-1" role="radiogroup" aria-label={labels.title}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={rating === value}
            aria-label={String(value)}
            onClick={() => setRating(value)}
            className="grid size-10 place-items-center rounded-lg transition hover:bg-pending-soft"
          >
            <StarIcon
              className={cn(
                "size-6 transition",
                value <= rating ? "fill-pending text-pending" : "text-line",
              )}
            />
          </button>
        ))}
        <span className="ms-2 text-sm font-bold text-slate" dir="ltr">
          {rating} / 5
        </span>
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={labels.placeholder}
        className="mt-4 min-h-24 w-full resize-none rounded-xl border border-line bg-canvas px-3 py-3 text-sm text-ink outline-none transition placeholder:text-slate/70 focus:border-teal focus:bg-surface"
      />

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rejected-soft px-3 py-2 text-xs font-bold text-rejected-ink">
          {error}
        </p>
      )}

      <Button type="button" size="sm" className="mt-4" onClick={send} disabled={pending}>
        {pending ? labels.sending : labels.submit}
      </Button>
    </div>
  );
}
