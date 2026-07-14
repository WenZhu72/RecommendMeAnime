"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Anime, WatchlistItem } from "@/types/anime";

const STORAGE_KEY = "recommend-me-anime-watchlist";

type WatchlistContextValue = {
  items: WatchlistItem[];
  isHydrated: boolean;
  add: (anime: Anime) => void;
  remove: (animeId: number) => void;
  has: (animeId: number) => boolean;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function isWatchlistItem(value: unknown): value is WatchlistItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "number" &&
      "title" in value &&
      typeof value.title === "string",
  );
}

function loadItems(): WatchlistItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const unique = new Map<number, WatchlistItem>();
    parsed.filter(isWatchlistItem).forEach((item) => unique.set(item.id, item));
    return [...unique.values()];
  } catch {
    return [];
  }
}

function toWatchlistItem(anime: Anime): WatchlistItem {
  const { id, title, coverImage, averageScore, genres, format, seasonYear } = anime;
  return { id, title, coverImage, averageScore, genres, format, seasonYear };
}

export function WatchlistProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setItems(loadItems());
      setIsHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (isHydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [isHydrated, items]);

  const value = useMemo<WatchlistContextValue>(() => ({
    items,
    isHydrated,
    add: (anime) => setItems((current) => current.some((item) => item.id === anime.id) ? current : [...current, toWatchlistItem(anime)]),
    remove: (animeId) => setItems((current) => current.filter((item) => item.id !== animeId)),
    has: (animeId) => items.some((item) => item.id === animeId),
  }), [isHydrated, items]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  return context;
}
