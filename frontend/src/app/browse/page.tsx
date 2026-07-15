import { BrowseFilters } from "@/components/browse/BrowseFilters";
import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { browseAnime, getPopularAnime, getTopRatedAnime, getTrendingAnime } from "@/lib/api/anime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse anime", description: "Explore trending, popular, and highly rated anime from AniList." };

type BrowsePageProps = { searchParams: Promise<{ genre?: string }> };

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { genre } = await searchParams;
  const requests = await Promise.allSettled([
    getTrendingAnime(),
    getPopularAnime(),
    getTopRatedAnime(),
    genre ? browseAnime({ genre }).then((response) => response.items) : Promise.resolve(null),
  ]);
  const [trending, popular, topRated, genreAnime] = requests.map((request) => request.status === "fulfilled" ? request.value : null);

  return (
    <Container className="space-y-12 py-10 sm:py-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Browse</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Explore anime</h1>
        <p className="mt-3 max-w-2xl text-slate-400">See what is trending, popular, and highly rated on AniList. Filter by genre to narrow the selection.</p>
      </header>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Genre</h2>
        <BrowseFilters />
      </section>
      {genreAnime && <section><SectionHeader title={`${genre} anime`} /><AnimeGrid anime={genreAnime} eagerFirstImage /></section>}
      <section><SectionHeader title="Trending" />{trending ? <AnimeGrid anime={trending} eagerFirstImage={!genreAnime} /> : <ErrorMessage message="Trending titles are unavailable right now. Please try again." />}</section>
      <section><SectionHeader title="Popular" />{popular ? <AnimeGrid anime={popular} /> : <ErrorMessage message="Popular titles are unavailable right now. Please try again." />}</section>
      <section><SectionHeader title="Highly rated" />{topRated ? <AnimeGrid anime={topRated} /> : <ErrorMessage message="Highly rated titles are unavailable right now. Please try again." />}</section>
    </Container>
  );
}
