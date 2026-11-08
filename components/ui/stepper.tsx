"use client";

import { cn } from "@/lib/cn";
import { useI18n } from "@/components/providers/locale-provider";
import { CheckIcon } from "@/components/ui/icons";

type StepperProps = {
  steps: string[];
  /** 1-based index of the current step. */
  current: number;
  className?: string;
};

export function Stepper({ steps, current, className }: StepperProps) {
  const { t } = useI18n();
  const safeCurrent = Math.min(Math.max(current, 1), steps.length);

  return (
    <div className={className}>
      <ol className="hidden items-center gap-3 sm:flex" aria-label={t.stepper.bookingSteps}>
        {steps.map((step, index) => {
          const number = index + 1;
          const isDone = number < safeCurrent;
          const isCurrent = number === safeCurrent;

          return (
            <li key={step} className="flex flex-1 items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-bold",
                  isDone && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-teal bg-surface text-teal ring-4 ring-teal/10",
                  !isDone && !isCurrent && "border-line bg-surface text-slate",
                )}
              >
                {isDone ? <CheckIcon className="size-4" /> : number}
              </span>
              <span className={cn("text-sm font-bold", isCurrent ? "text-ink" : "text-slate")} aria-current={isCurrent ? "step" : undefined}>
                {step}
              </span>
              {index < steps.length - 1 && <span aria-hidden="true" className={cn("h-px flex-1", isDone ? "bg-teal" : "bg-line")} />}
            </li>
          );
        })}
      </ol>

      <div className="sm:hidden">
        <div className="flex items-center justify-between text-sm font-bold">
          <span className="text-ink">{steps[safeCurrent - 1]}</span>
          <span className="text-slate" dir="ltr">
            {safeCurrent}/{steps.length}
          </span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={safeCurrent}
          aria-label={t.stepper.progress}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(safeCurrent / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
