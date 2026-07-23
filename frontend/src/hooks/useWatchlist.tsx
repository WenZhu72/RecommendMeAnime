"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import {
  getBrowserHydrationSnapshot,
  getServerHydrationSnapshot,
  selectHydrationSafeWatchlistState,
  subscribeToBrowserHydration,
} from "@/lib/watchlist-hydration";
import type { Anime, WatchlistItem } from "@/types/anime";

const STORAGE_KEY = "recommend-me-anime-watchlist-strict-non-adult-v1";

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
    parsed
      .filter(isWatchlistItem)
      .filter((item) => item.isAdult !== true)
      .forEach((item) => unique.set(item.id, item));
    return [...unique.values()];
  } catch {
    return [];
  }
}

function toWatchlistItem(anime: Anime): WatchlistItem {
  const { id, title, coverImage, averageScore, genres, format, seasonYear, isAdult } = anime;
  return { id, title, coverImage, averageScore, genres, format, seasonYear, isAdult };
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
    add: (anime) => setItems((current) => (
      anime.isAdult === true || current.some((item) => item.id === anime.id)
        ? current
        : [...current, toWatchlistItem(anime)]
    )),
    remove: (animeId) => setItems((current) => current.filter((item) => item.id !== animeId)),
    has: (animeId) => items.some((item) => item.id === animeId),
  }), [isHydrated, items]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  // A root provider can finish reading storage before a later streamed
  // Suspense boundary hydrates. Gate its browser state per consumer so that
  // the server and that boundary's first client render remain identical.
  const consumerHydrated = useSyncExternalStore(
    subscribeToBrowserHydration,
    getBrowserHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  if (!context) throw new Error("useWatchlist must be used inside WatchlistProvider");
  const safeState = selectHydrationSafeWatchlistState(
    context.items,
    context.isHydrated,
    consumerHydrated,
  );
  const has = useCallback(
    (animeId: number) => safeState.isHydrated && context.has(animeId),
    [context, safeState.isHydrated],
  );

  return useMemo(() => ({
    items: safeState.items,
    isHydrated: safeState.isHydrated,
    add: context.add,
    remove: context.remove,
    has,
  }), [context.add, context.remove, has, safeState.isHydrated, safeState.items]);
}
