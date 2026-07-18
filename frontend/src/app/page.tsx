import { Hero } from "@/components/home/Hero";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getPopularAnime, getTrendingAnime } from "@/lib/api/anime";

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

export default async function Home() {
  const { trending, popular } = await loadHomeAnime();

  return (
    <>
      <Hero featured={trending ?? []} />
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
