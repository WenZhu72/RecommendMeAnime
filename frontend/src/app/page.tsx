import Link from "next/link";

import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { SearchBar } from "@/components/search/SearchBar";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getPopularAnime, getTrendingAnime } from "@/lib/api/anime";

// Keep build-time deployment independent from availability of the Render API.
export const dynamic = "force-dynamic";

async function loadHomeAnime() {
  const [trending, popular] = await Promise.allSettled([getTrendingAnime(), getPopularAnime()]);
  return { trending: trending.status === "fulfilled" ? trending.value : null, popular: popular.status === "fulfilled" ? popular.value : null };
}

export default async function Home() {
  const { trending, popular } = await loadHomeAnime();
  return <>
    <section className="border-b border-slate-800 bg-slate-900/30"><Container className="py-16 sm:py-24"><div className="mx-auto max-w-3xl text-center"><p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-indigo-300">Anime discovery, made personal</p><h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">Find your next favourite anime.</h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">Browse what is popular, search AniList’s catalogue, or answer a few simple questions for a starting set of recommendations.</p><SearchBar className="mx-auto mt-8 max-w-2xl text-left" /><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/recommend" className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Get recommendations</Link><Link href="/browse" className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Browse anime</Link></div></div></Container></section>
    <Container className="space-y-16 py-12 sm:py-16"><section><SectionHeader title="Trending now" description="Anime currently capturing attention in the AniList community." href="/browse" />{trending ? <AnimeGrid anime={trending} /> : <ErrorMessage />}</section><section><SectionHeader title="Popular favourites" description="Well-loved shows to begin your next binge." href="/browse" />{popular ? <AnimeGrid anime={popular} /> : <ErrorMessage />}</section><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8"><p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">How it works</p><h2 className="mt-2 text-2xl font-bold text-white">A simple starting point for better picks.</h2><div className="mt-6 grid gap-5 md:grid-cols-3">{[["1", "Tell us your taste", "Select genres, formats, length, and the kind of mood you want."], ["2", "We find candidates", "The current service uses straightforward AniList filters you can replace later."], ["3", "Save what interests you", "Keep promising titles in a private watchlist stored in your browser."]].map(([number, title, copy]) => <div key={number} className="rounded-xl bg-slate-950/70 p-5"><span className="text-sm font-bold text-indigo-300">{number}</span><h3 className="mt-2 font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p></div>)}</div></section></Container>
  </>;
}
