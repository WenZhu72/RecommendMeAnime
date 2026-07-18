"use client";

import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingCards } from "@/components/ui/LoadingCards";
import { PageHeader } from "@/components/ui/PageHeader";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { Anime, WatchlistItem } from "@/types/anime";

function toAnime(item: WatchlistItem): Anime {
  return {
    ...item,
    titles: { english: item.title, romaji: null, native: null },
    description: null,
    bannerImage: null,
    color: null,
    meanScore: null,
    popularity: null,
    status: null,
    episodes: null,
    duration: null,
    season: null,
    startDate: null,
    endDate: null,
    studios: [],
    source: null,
    countryOfOrigin: null,
    synonyms: [],
    siteUrl: null,
    relations: [],
    recommendations: [],
  };
}

export default function WatchlistPage() {
  const { items, isHydrated } = useWatchlist();

  return (
    <Container className="py-11 sm:py-16">
      <PageHeader
        eyebrow="Your watchlist"
        title="A quiet place for titles you want to remember."
        description="Saved locally in this browser—no account, sign-in, or external profile required."
      />
      <section className="mt-10 sm:mt-12" aria-live="polite">
        {!isHydrated ? (
          <LoadingCards count={10} />
        ) : items.length ? (
          <>
            <p className="mb-6 text-sm text-ink-faint">
              {items.length} saved title{items.length === 1 ? "" : "s"}
            </p>
            <AnimeGrid anime={items.map(toAnime)} eagerFirstImage />
          </>
        ) : (
          <EmptyState
            title="Your watchlist is empty"
            description="Save titles from any anime card or detail page to keep them close."
            actionHref="/browse"
            actionLabel="Browse anime"
          />
        )}
      </section>
    </Container>
  );
}
