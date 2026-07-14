"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { AnimeGrid } from "@/components/search/AnimeGrid";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { LoadingCards } from "@/components/ui/LoadingCards";
import { getSavedRecommendationPreferences } from "@/lib/recommendation-storage";
import { getRecommendations } from "@/lib/api/recommendations";
import type { Anime } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

export function RecommendationResults() {
  const [preferences, setPreferences] = useState<RecommendationPreferences | null>(null);
  const [results, setResults] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(async (selected: RecommendationPreferences) => { setIsLoading(true); setError(""); try { setResults(await getRecommendations(selected)); } catch { setError("Recommendations are unavailable right now. Please try again."); } finally { setIsLoading(false); } }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const saved = getSavedRecommendationPreferences();
      setPreferences(saved);
      setIsInitialized(true);
      if (saved) { void run(saved); } else { setIsLoading(false); }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [run]);

  if (!isInitialized) return <LoadingCards count={10} />;
  if (!preferences) return <EmptyState title="No saved preferences" description="Complete the questionnaire first so we know what to look for." actionHref="/recommend" actionLabel="Start questionnaire" />;
  const summary = [preferences.favoriteGenres.join(", "), preferences.formats.length ? preferences.formats.join(", ") : "Any format", preferences.preferredLength === "any" ? "Any length" : `${preferences.preferredLength} series`, `${preferences.minimumScore}% minimum score`];
  return <section><div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="font-semibold text-white">Your preferences</h2><p className="mt-2 text-sm leading-6 text-slate-400">{summary.join(" · ")}</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/recommend" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">Edit preferences</Link><Button loading={isLoading} onClick={() => void run(preferences)}>Generate another set</Button></div></div><div className="mt-10">{isLoading ? <LoadingCards count={10} /> : error ? <ErrorMessage message={error} /> : results.length ? <AnimeGrid anime={results} /> : <EmptyState title="No close matches" description="Try lowering the minimum score, choosing a broader format, or avoiding fewer genres." actionHref="/recommend" actionLabel="Edit preferences" />}</div></section>;
}
