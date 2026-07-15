import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { SearchBar } from "@/components/search/SearchBar";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getPopularAnime, getTrendingAnime } from "@/lib/api/anime";

export const dynamic = "force-dynamic";

async function loadHomeAnime() {
  const [trending, popular] = await Promise.allSettled([getTrendingAnime(), getPopularAnime()]);
  return {
    trending: trending.status === "fulfilled" ? trending.value : null,
    popular: popular.status === "fulfilled" ? popular.value : null,
  };
}

export default async function Home() {
  const { trending, popular } = await loadHomeAnime();

  return (
    <>
      <section className="border-b border-slate-800 bg-slate-900/30">
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-indigo-300">Anime discovery</p>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">Find something worth watching.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Search the AniList catalogue, browse popular shows, or choose a few preferences to narrow the list.</p>
            <SearchBar className="mx-auto mt-8 max-w-2xl text-left" />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/recommend" className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Find recommendations</Link>
              <Link href="/browse" className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Browse anime</Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="space-y-16 py-12 sm:py-16">
        <section>
          <SectionHeader title="Trending now" description="Titles getting attention on AniList." href="/browse" />
          {trending ? <AnimeGrid anime={trending} eagerFirstImage /> : <ErrorMessage message="Trending titles are unavailable right now. Please try again." />}
        </section>
        <section>
          <SectionHeader title="Popular on AniList" description="Popular series and films to explore next." href="/browse" />
          {popular ? <AnimeGrid anime={popular} /> : <ErrorMessage message="Popular titles are unavailable right now. Please try again." />}
        </section>
      </Container>
    </>
  );
}
