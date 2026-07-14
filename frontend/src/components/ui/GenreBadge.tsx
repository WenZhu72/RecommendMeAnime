import type { ReactNode } from "react";

export function GenreBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-200">{children}</span>;
}
