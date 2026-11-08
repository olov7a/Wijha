import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SparkIcon } from "@/components/ui/icons";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-panel border border-dashed border-line bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-mint/30 text-teal-dark">
        {icon ?? <SparkIcon className="size-6" />}
      </span>
      <h2 className="mt-5 font-display text-lg font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm leading-7 text-slate">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
