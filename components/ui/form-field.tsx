import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const fieldBase =
  "mt-2 w-full rounded-2xl border bg-surface px-4 py-3 text-sm font-normal text-ink outline-none transition placeholder:text-slate/60 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60";
const fieldNormal = "border-line focus:border-teal focus:ring-teal/10";
const fieldInvalid = "border-rejected focus:border-rejected focus:ring-rejected/10";

type FieldWrapperProps = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

function FieldWrapper({ label, hint, error, required, children }: FieldWrapperProps) {
  return (
    <label className="block text-sm font-bold">
      <span>
        {label}
        {required && (
          <span aria-hidden="true" className="text-brown-ink">
            {" "}
            *
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="mt-2 block text-xs font-normal leading-6 text-rejected">{error}</span>
      ) : (
        hint && <span className="mt-2 block text-xs font-normal leading-6 text-slate">{hint}</span>
      )}
    </label>
  );
}

type CommonFieldProps = {
  label: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className, required, ...props }: ComponentProps<"input"> & CommonFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required}>
      <input
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, error ? fieldInvalid : fieldNormal, className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export function Textarea({ label, hint, error, className, required, rows = 4, ...props }: ComponentProps<"textarea"> & CommonFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required}>
      <textarea
        required={required}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, "resize-y leading-7", error ? fieldInvalid : fieldNormal, className)}
        {...props}
      />
    </FieldWrapper>
  );
}

export function Select({ label, hint, error, className, required, children, ...props }: ComponentProps<"select"> & CommonFieldProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error} required={required}>
      <select
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(fieldBase, "appearance-none", error ? fieldInvalid : fieldNormal, className)}
        {...props}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}
