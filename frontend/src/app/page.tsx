import { Hero } from "@/components/home/Hero";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  getHeroFallbackCandidatePage,
  getPopularAnime,
  getTrendingAnime,
} from "@/lib/api/anime";
import { selectRandomHeroPages } from "@/lib/hero-fallback";
import {
  HERO_FALLBACK_CACHE_SECONDS,
  HERO_FALLBACK_CANDIDATES_PER_PAGE,
  HERO_FALLBACK_MINIMUM_SCORE,
  HERO_FALLBACK_RANDOM_PAGE_COUNT,
  HERO_RECOMMENDATION_LIMIT,
  selectFallbackHeroAnime,
} from "@/lib/hero-recommendations";

export const dynamic = "force-dynamic";

async function loadHomeAnime() {
  const [trending, popular] = await Promise.allSettled([
    getTrendingAnime({ perPage: 10 }),
    getPopularAnime({ perPage: 10 }),
  ]);
  return {
    trending: trending.status === "fulfilled" ? trending.value : null,
    popular: popular.status === "fulfilled" ? popular.value : null,
  };
}

async function loadHeroFallbackAnime() {
  try {
    const getCandidatePage = (page: number) => getHeroFallbackCandidatePage({
      page,
      perPage: HERO_FALLBACK_CANDIDATES_PER_PAGE,
      minimumScore: HERO_FALLBACK_MINIMUM_SCORE,
      revalidateSeconds: HERO_FALLBACK_CACHE_SECONDS,
    });
    const firstPage = await getCandidatePage(1);
    const sampledPages = selectRandomHeroPages(
      firstPage.pageInfo.lastPage,
      HERO_FALLBACK_RANDOM_PAGE_COUNT,
    );
    const pageResults = await Promise.allSettled(
      sampledPages.map((page) => page === 1 ? Promise.resolve(firstPage) : getCandidatePage(page)),
    );
    const candidates = pageResults.flatMap((result) => (
      result.status === "fulfilled" ? result.value.items : []
    ));
    const selected = selectFallbackHeroAnime(candidates);

    if (selected.length >= HERO_RECOMMENDATION_LIMIT || sampledPages.includes(1)) {
      return selected;
    }

    // Page one is a cached resilience fallback only when sampled pages do not
    // yield a complete carousel; it is not automatically part of every pool.
    return selectFallbackHeroAnime([...candidates, ...firstPage.items]);
  } catch {
    return [];
  }
}

export default async function Home() {
  const [{ trending, popular }, heroFallback] = await Promise.all([
    loadHomeAnime(),
    loadHeroFallbackAnime(),
  ]);

  return (
    <>
      <Hero fallbackRecommendations={heroFallback} />
      <Container className="space-y-16 py-14 sm:space-y-20 sm:py-20">
        <section>
          <SectionHeader
            title="Trending now"
            description="The titles currently drawing attention across AniList."
            href="/browse?sort=trending"
          />
          {trending ? (
            <AnimeGrid anime={trending} eagerFirstImage />
          ) : (
            <ErrorMessage message="Trending titles are unavailable right now. Please try again." />
          )}
        </section>
        <section>
          <SectionHeader
            title="Popular on AniList"
            description="Established favourites and widely watched series worth exploring."
            href="/browse?sort=popular"
          />
          {popular ? (
            <AnimeGrid anime={popular} />
          ) : (
            <ErrorMessage message="Popular titles are unavailable right now. Please try again." />
          )}
        </section>
      </Container>
    </>
  );
}
