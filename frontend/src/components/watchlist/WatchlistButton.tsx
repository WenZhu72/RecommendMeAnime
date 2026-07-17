"use client";

import { BookmarkIcon } from "@/components/ui/Icons";
import { useWatchlist } from "@/hooks/useWatchlist";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type WatchlistButtonProps = { anime: Anime; compact?: boolean };

export function WatchlistButton({ anime, compact = false }: WatchlistButtonProps) {
  const { add, remove, has, isHydrated } = useWatchlist();
  const saved = has(anime.id);
  const label = saved ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`;

  return (
    <button
      type="button"
      disabled={!isHydrated}
      onClick={() => (saved ? remove(anime.id) : add(anime))}
      aria-pressed={saved}
      aria-label={label}
      title={compact ? label : undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:opacity-50",
        compact
          ? "size-9 rounded-full border border-white/10 bg-black/60 text-white shadow-lg backdrop-blur-md hover:scale-105 hover:bg-black/75"
          : saved
            ? "min-h-11 rounded-control border border-brand/35 bg-brand/10 px-4 text-sm text-brand-soft hover:bg-brand/15"
            : "min-h-11 rounded-control border border-line-strong bg-surface-raised px-4 text-sm text-ink hover:border-brand/45 hover:bg-surface",
      )}
    >
      <BookmarkIcon className={compact ? "size-4" : "size-4.5"} filled={saved} />
      {!compact && (saved ? "Saved to watchlist" : "Add to watchlist")}
    </button>
  );
}
