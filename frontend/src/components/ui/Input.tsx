import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export const fieldStyles = cn(
  "w-full min-h-11 rounded-control border border-line bg-canvas-soft/90 px-3.5 text-sm text-ink shadow-[inset_0_1px_0_rgb(255_255_255_/_0.025)]",
  "placeholder:text-ink-faint transition-[border-color,box-shadow,background-color] duration-200",
  "hover:border-line-strong focus-visible:border-brand/70 focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20",
  "disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-55",
);

type InputProps = ComponentPropsWithoutRef<"input"> & {
  error?: boolean;
};

export function Input({ className, error = false, ...props }: InputProps) {
  return (
    <input
      className={cn(
        fieldStyles,
        error && "border-danger focus-visible:border-danger focus-visible:ring-danger/20",
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}
