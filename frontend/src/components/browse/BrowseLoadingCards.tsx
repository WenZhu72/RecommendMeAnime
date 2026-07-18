import type { CSSProperties } from "react";

import styles from "@/components/browse/BrowseResultsMotion.module.css";
import { animeGridClasses } from "@/components/search/AnimeGrid";
import { cn } from "@/lib/utils";

type BrowseMotionStyle = CSSProperties & { "--browse-stagger-delay": string };

export function BrowseLoadingCards({ count = 20 }: { count?: number }) {
  return (
    <div
      className={animeGridClasses}
      aria-label="Loading anime titles"
      aria-busy="true"
      role="status"
    >
      <span className="sr-only">Loading anime titles</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn(
            styles.skeletonCard,
            "flex h-full flex-col overflow-hidden rounded-card border border-line/80 bg-surface/78 shadow-card",
          )}
          style={{ "--browse-stagger-delay": `${index * 28}ms` } as BrowseMotionStyle}
          aria-hidden="true"
        >
          <div className={cn(styles.skeletonSurface, "aspect-[2/3] bg-surface-raised")} />
          <div className="flex flex-1 flex-col p-3.5 sm:p-4">
            <div className="min-h-10 space-y-2">
              <div className={cn(styles.skeletonSurface, "h-4 w-4/5 rounded bg-surface-raised")} />
              <div className={cn(styles.skeletonSurface, "h-4 w-3/5 rounded bg-surface-raised")} />
            </div>
            <div className={cn(styles.skeletonSurface, "mt-1.5 h-3 w-2/5 rounded bg-surface-raised")} />
            <div className="mt-auto flex min-h-8 items-end gap-1.5 pt-3">
              <div className={cn(styles.skeletonSurface, "h-5 w-14 rounded-full bg-brand/10")} />
              <div className={cn(styles.skeletonSurface, "h-5 w-11 rounded-full bg-brand/10")} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
