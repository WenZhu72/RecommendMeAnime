import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { SearchBar } from "@/components/search/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { searchAnime } from "@/lib/api/anime";

export const dynamic = "force-dynamic";
type SearchPageProps = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  let results = null;
  let error = false;
  if (query) { try { results = await searchAnime(query); } catch { error = true; } }
  return <Container className="py-10 sm:py-14"><header className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">AniList catalogue</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Search anime</h1><SearchBar initialQuery={query} className="mt-6" /></header><section className="mt-10">{!query ? <EmptyState title="Start with a title" description="Search by anime title to see results from AniList." /> : error ? <ErrorMessage message="Search is unavailable at the moment. Please try again." /> : results?.length ? <><h2 className="mb-5 text-lg font-semibold text-white">Results for “{query}”</h2><AnimeGrid anime={results} /></> : <EmptyState title="No anime found" description={`We could not find anime matching “${query}”. Try another title or spelling.`} actionHref="/browse" actionLabel="Browse popular anime" />}</section></Container>;
}
