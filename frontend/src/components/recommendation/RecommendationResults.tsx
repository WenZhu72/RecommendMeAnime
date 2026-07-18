"use client";

import { useCallback, useEffect, useState } from "react";

import { AnimeGrid } from "@/components/search/AnimeGrid";
import { Button, ButtonLink } from "@/components/ui/Button";
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
  if (!preferences) {
    return (
      <EmptyState
        title="Choose your preferences first"
        description="Select a few viewing preferences before asking for recommendations."
        actionHref="/recommend"
        actionLabel="Choose preferences"
      />
    );
  }

  const summary = [
    preferences.favoriteGenres.join(", "),
    preferences.formats.length ? preferences.formats.join(", ") : "Any format",
    preferences.preferredLength === "any" ? "Any length" : `${preferences.preferredLength} series`,
    `${preferences.minimumScore}% minimum score`,
  ];

  return (
    <section>
      <div className="rounded-panel border border-line bg-surface/70 p-5 shadow-card sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-soft">Your preferences</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">{summary.join(" · ")}</p>
        </div>
        <div className="mt-5 flex shrink-0 flex-wrap gap-2 sm:mt-0">
          <ButtonLink href="/recommend" variant="outline">Edit</ButtonLink>
          <Button loading={isLoading} loadingLabel="Refreshing" onClick={() => void run(preferences)}>
            Refresh results
          </Button>
        </div>
      </div>

      <div className="mt-10" aria-live="polite">
        {isLoading ? (
          <LoadingCards count={10} />
        ) : error ? (
          <ErrorMessage message={error} />
        ) : results.length ? (
          <AnimeGrid anime={results} eagerFirstImage />
        ) : (
          <EmptyState
            title="No close matches"
            description="Try selecting more genres, a different format, or a lower minimum score."
            actionHref="/recommend"
            actionLabel="Edit preferences"
          />
        )}
      </div>
    </section>
  );
}
