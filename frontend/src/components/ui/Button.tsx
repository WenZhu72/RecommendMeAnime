import Link, { type LinkProps } from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-[0_10px_30px_-14px_rgb(139_92_246_/_0.95)] hover:bg-brand-strong hover:shadow-[0_14px_36px_-16px_rgb(139_92_246_/_1)] focus-visible:ring-brand-soft",
  secondary:
    "border border-line-strong bg-surface-raised text-ink hover:border-brand/50 hover:bg-surface focus-visible:ring-brand-soft",
  outline:
    "border border-line-strong bg-transparent text-ink-muted hover:border-brand/50 hover:bg-white/[0.04] hover:text-ink focus-visible:ring-brand-soft",
  ghost:
    "bg-transparent text-ink-muted hover:bg-white/[0.05] hover:text-ink focus-visible:ring-brand-soft",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[0.625rem] px-3.5 text-xs",
  md: "min-h-11 rounded-control px-4.5 text-sm",
  lg: "min-h-12 rounded-control px-5 text-sm",
  icon: "size-10 rounded-control p-0",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 font-semibold tracking-[-0.01em]",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-product",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:pointer-events-none disabled:opacity-45",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Loading",
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {loading ? loadingLabel : children}
    </button>
  );
}

type ButtonLinkProps = LinkProps & {
  children: ReactNode;
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  target?: string;
  rel?: string;
};

export function ButtonLink({
  children,
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}
