import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  error?: boolean;
};

export function Input({
  className,
  error = false,
  ...props
}: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white",
        "placeholder:text-slate-500",
        "transition-colors",
        "focus-visible:border-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400",
        "disabled:cursor-not-allowed disabled:bg-slate-800 disabled:opacity-60",
        error &&
          "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-200",
        className,
      )}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}
