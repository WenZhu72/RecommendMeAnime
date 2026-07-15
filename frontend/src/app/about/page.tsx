import Link from "next/link";
import type { Metadata } from "next";

import { Container } from "@/components/layout/Container";

export const metadata: Metadata = { title: "About", description: "Learn how RecommendMeAnime helps you choose what to watch." };

export default function AboutPage() {
  return (
    <Container className="py-10 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">About</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">About RecommendMeAnime</h1>
        <p className="mt-3 text-xl text-slate-300">Find something worth watching.</p>
        <div className="mt-8 space-y-5 leading-7 text-slate-300">
          <p>RecommendMeAnime helps you explore anime and narrow down your next choice using the things you care about, including genre, format, score, length, and release period.</p>
          <p>Browse popular titles, search the AniList catalogue, view detailed information, and build a watchlist as you discover new series and films.</p>
          <p>Recommendations use the preferences you select. Your watchlist is stored in this browser, so it stays available on this device without requiring an account.</p>
        </div>
        <Link href="/recommend" className="mt-8 inline-flex rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
          Choose your preferences
        </Link>
      </article>
    </Container>
  );
}
