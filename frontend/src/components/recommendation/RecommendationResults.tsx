"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AnimeGrid } from "@/components/search/AnimeGrid";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingCards } from "@/components/ui/LoadingCards";
import { getRecommendations } from "@/lib/api/recommendations";
import { getSavedRecommendationPreferences } from "@/lib/recommendation-storage";
import type { Anime } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

export function RecommendationResults() {
  const [preferences, setPreferences] = useState<RecommendationPreferences | null>(null);
  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState("");

  const run = useCallback(async (selected: RecommendationPreferences) => {
    setIsLoading(true);
    setError("");
    try {
      setResults(await getRecommendations(selected));
    } catch {
      setError("Recommendations are unavailable right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = getSavedRecommendationPreferences();
      setPreferences(saved);
      setIsInitialized(true);
      if (saved) void run(saved);
      else setIsLoading(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [run]);

  if (!isInitialized) return <LoadingCards count={10} />;
  if (!preferences) return <EmptyState title="Choose your preferences first" description="Select a few viewing preferences before asking for recommendations." actionHref="/recommend" actionLabel="Choose preferences" />;

  const summary = [preferences.favoriteGenres.join(", "), preferences.formats.length ? preferences.formats.join(", ") : "Any format", preferences.preferredLength === "any" ? "Any length" : `${preferences.preferredLength} series`, `${preferences.minimumScore}% minimum score`];

  return <section><div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="font-semibold text-white">Your preferences</h2><p className="mt-2 text-sm leading-6 text-slate-400">{summary.join(" / ")}</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/recommend" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Edit preferences</Link><Button loading={isLoading} onClick={() => void run(preferences)}>Refresh results</Button></div></div><div className="mt-10">{isLoading ? <LoadingCards count={10} /> : error ? <ErrorMessage message={error} /> : results.length ? <AnimeGrid anime={results} /> : <EmptyState title="No close matches" description="Try selecting more genres, a different format, or a lower minimum score." actionHref="/recommend" actionLabel="Edit preferences" />}</div></section>;
}
