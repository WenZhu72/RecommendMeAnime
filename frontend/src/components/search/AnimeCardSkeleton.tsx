import type { CSSProperties } from "react";

import styles from "@/components/search/AnimeGridMotion.module.css";
import {
  animeCardBodyClasses,
  animeCardGenresClasses,
  animeCardMetadataClasses,
  animeCardShellClasses,
} from "@/components/search/anime-card-layout";
import { cn } from "@/lib/utils";

type AnimeGridMotionStyle = CSSProperties & { "--anime-grid-stagger-delay": string };

export function AnimeCardSkeleton({ index }: { index: number }) {
  return (
    <div
      className={cn(styles.skeletonCard, animeCardShellClasses)}
      style={{ "--anime-grid-stagger-delay": `${index * 28}ms` } as AnimeGridMotionStyle}
      aria-hidden="true"
    >
      <div className={cn(styles.skeletonSurface, "aspect-[2/3] bg-surface-raised")} />
      <div className={animeCardBodyClasses}>
        <div className="min-h-10 space-y-2">
          <div className={cn(styles.skeletonSurface, "h-4 w-4/5 rounded bg-surface-raised")} />
          <div className={cn(styles.skeletonSurface, "h-4 w-3/5 rounded bg-surface-raised")} />
        </div>
        <div className={cn(styles.skeletonSurface, animeCardMetadataClasses, "h-4 w-2/5 rounded bg-surface-raised")} />
        <div className={animeCardGenresClasses}>
          <div className={cn(styles.skeletonSurface, "h-[1.375rem] w-16 rounded-full bg-brand/10")} />
          <div className={cn(styles.skeletonSurface, "h-[1.375rem] w-14 rounded-full bg-brand/10")} />
        </div>
      </div>
    </div>
  );
}
