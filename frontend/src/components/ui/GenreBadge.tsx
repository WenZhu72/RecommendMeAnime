import type { ReactNode } from "react";

export function GenreBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-brand/15 bg-brand/10 px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-brand-soft">
      {children}
    </span>
  );
}
