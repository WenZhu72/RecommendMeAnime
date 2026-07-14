"use client";

import { useWatchlist } from "@/hooks/useWatchlist";
import type { Anime } from "@/types/anime";

type WatchlistButtonProps = { anime: Anime; compact?: boolean };

export function WatchlistButton({ anime, compact = false }: WatchlistButtonProps) {
  const { add, remove, has, isHydrated } = useWatchlist();
  const saved = has(anime.id);

  return (
    <button
      type="button"
      disabled={!isHydrated}
      onClick={() => (saved ? remove(anime.id) : add(anime))}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${anime.title} from watchlist` : `Add ${anime.title} to watchlist`}
      className={compact ? "shrink-0 rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:border-indigo-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50" : "rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-indigo-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"}
    >
      {saved ? (compact ? "Saved" : "Remove from watchlist") : (compact ? "+ Save" : "+ Add to watchlist")}
    </button>
  );
}
