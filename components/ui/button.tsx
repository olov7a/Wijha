import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary-hover",
  secondary: "border border-brown bg-surface text-brown-ink hover:bg-brown hover:text-white",
  ghost: "text-teal hover:bg-teal/10",
  danger: "bg-rejected text-white hover:bg-rejected-ink",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-6 text-sm",
  lg: "min-h-13 px-7 text-base",
};

type StyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function buttonClassName({ variant = "primary", size = "md", className }: StyleOptions = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

export function Button({ variant, size, className, type = "button", ...props }: ComponentProps<"button"> & StyleOptions) {
  return <button type={type} className={buttonClassName({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleOptions) {
  return <Link className={buttonClassName({ variant, size, className })} {...props} />;
}
