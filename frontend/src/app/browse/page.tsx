import { BrowseFilters } from "@/components/browse/BrowseFilters";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { browseAnime, getPopularAnime, getTopRatedAnime, getTrendingAnime } from "@/lib/api/anime";

export const dynamic = "force-dynamic";
type BrowsePageProps = { searchParams: Promise<{ genre?: string }> };

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const { genre } = await searchParams;
  const requests = await Promise.allSettled([getTrendingAnime(), getPopularAnime(), getTopRatedAnime(), genre ? browseAnime({ genre }).then((response) => response.items) : Promise.resolve(null)]);
  const [trending, popular, topRated, genreAnime] = requests.map((request) => request.status === "fulfilled" ? request.value : null);
  return <Container className="space-y-12 py-10 sm:py-14"><header><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Explore</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Browse anime</h1><p className="mt-3 max-w-2xl text-slate-400">Browse AniList’s current favourites, or narrow the catalogue to a genre.</p></header><section><h2 className="mb-4 text-lg font-semibold text-white">Filter by genre</h2><BrowseFilters /></section>{genreAnime && <section><SectionHeader title={`${genre} anime`} /><AnimeGrid anime={genreAnime} /></section>}<section><SectionHeader title="Trending" />{trending ? <AnimeGrid anime={trending} /> : <ErrorMessage />}</section><section><SectionHeader title="Popular" />{popular ? <AnimeGrid anime={popular} /> : <ErrorMessage />}</section><section><SectionHeader title="Highly rated" />{topRated ? <AnimeGrid anime={topRated} /> : <ErrorMessage />}</section></Container>;
}
