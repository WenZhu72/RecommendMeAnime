import { Suspense } from "react";

import { Hero } from "@/components/home/Hero";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { HeroCarouselSkeleton } from "@/components/home/HeroCarouselSkeleton";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { AnimeGridSkeleton } from "@/components/search/AnimeGridSkeleton";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getHeroFallbackCandidatePage,
  getPopularAnime,
  getTrendingAnime,
} from "@/lib/api/anime";
import { loadHeroCandidates } from "@/lib/hero-loader";
import {
  HERO_FALLBACK_CACHE_SECONDS,
  HERO_FALLBACK_CANDIDATES_PER_PAGE,
  HERO_FALLBACK_RANDOM_PAGE_COUNT,
  HERO_RECOMMENDATION_LIMIT,
  selectFallbackHeroAnime,
} from "@/lib/hero-recommendations";

export const dynamic = "force-dynamic";

async function loadHeroFallbackAnime() {
  try {
    const getCandidatePage = (page: number) => getHeroFallbackCandidatePage({
      page,
      perPage: HERO_FALLBACK_CANDIDATES_PER_PAGE,
      revalidateSeconds: HERO_FALLBACK_CACHE_SECONDS,
    });
    return await loadHeroCandidates({
      getCandidatePage,
      limit: HERO_RECOMMENDATION_LIMIT,
      randomPageCount: HERO_FALLBACK_RANDOM_PAGE_COUNT,
      selectCandidates: selectFallbackHeroAnime,
    });
  } catch {
    return [];
  }
}

async function HomeHeroRecommendations() {
  return <HeroCarousel fallbackItems={await loadHeroFallbackAnime()} />;
}

async function TrendingAnimeSection() {
  let resolvedAnime;
  try {
    resolvedAnime = await getTrendingAnime({ perPage: 10 });
  } catch {
    resolvedAnime = undefined;
  }
  return <HomeAnimeSection kind="trending" anime={resolvedAnime} />;
}

async function PopularAnimeSection() {
  let resolvedAnime;
  try {
    resolvedAnime = await getPopularAnime({ perPage: 10 });
  } catch {
    resolvedAnime = undefined;
  }
  return <HomeAnimeSection kind="popular" anime={resolvedAnime} />;
}

type HomeAnimeSectionProps = {
  anime?: Awaited<ReturnType<typeof getTrendingAnime>>;
  kind: "trending" | "popular";
  loading?: boolean;
};

function HomeAnimeSection({ anime, kind, loading = false }: HomeAnimeSectionProps) {
  const trending = kind === "trending";
  const title = trending ? "Trending now" : "Popular on AniList";
  const description = trending
    ? "The titles currently drawing attention across AniList."
    : "Established favourites and widely watched series worth exploring.";

  return (
    <section aria-busy={loading || undefined}>
      <SectionHeader
        title={title}
        description={description}
        href={`/browse?sort=${kind}`}
      />
      {loading ? (
        <AnimeGridSkeleton count={10} label={`Loading ${trending ? "trending" : "popular"} anime`} />
      ) : anime ? (
        <AnimeGrid anime={anime} animateEntrance />
      ) : (
        <ErrorMessage message={`${trending ? "Trending" : "Popular"} titles are unavailable right now. Please try again.`} />
      )}
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero
        recommendations={(
          <Suspense fallback={<HeroCarouselSkeleton />}>
            <HomeHeroRecommendations />
          </Suspense>
        )}
      />
      <Container className="space-y-16 py-14 sm:space-y-20 sm:py-20">
        <Suspense fallback={<HomeAnimeSection kind="trending" loading />}>
          <TrendingAnimeSection />
        </Suspense>
        <Suspense fallback={<HomeAnimeSection kind="popular" loading />}>
          <PopularAnimeSection />
        </Suspense>
      </Container>
    </>
  );
}
