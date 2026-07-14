"use client";

import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Anime, WatchlistItem } from "@/types/anime";

function toAnime(item: WatchlistItem): Anime {
  return { ...item, titles: { english: item.title, romaji: null, native: null }, description: null, bannerImage: null, meanScore: null, popularity: null, status: null, episodes: null, duration: null, season: null, startDate: null, endDate: null, studios: [], source: null, countryOfOrigin: null, synonyms: [], siteUrl: null, relations: [], recommendations: [] };
}

export default function WatchlistPage() {
  const { items, isHydrated } = useWatchlist();
  return <Container className="py-10 sm:py-14"><header><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Saved locally</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Your watchlist</h1><p className="mt-3 max-w-2xl text-slate-400">Titles saved on this device. This list stays in your browser until you remove it or clear local storage.</p></header><section className="mt-10">{!isHydrated ? <p className="text-sm text-slate-400">Loading saved anime…</p> : items.length ? <AnimeGrid anime={items.map(toAnime)} /> : <EmptyState title="Your watchlist is empty" description="Save titles while browsing to keep them handy for later." actionHref="/browse" actionLabel="Browse anime" />}</section></Container>;
}
