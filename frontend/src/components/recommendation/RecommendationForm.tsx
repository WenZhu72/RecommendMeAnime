"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { fieldStyles } from "@/components/ui/Input";
import { saveRecommendationPreferences } from "@/lib/recommendation-storage";
import { cn } from "@/lib/utils";
import type { AnimeFormat, ContentTone, RecommendationPreferences } from "@/types/recommendation";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery",
  "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Thriller",
];
const FORMATS: AnimeFormat[] = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
const TONES: ContentTone[] = ["light-hearted", "dark", "emotional", "action-focused"];
const STEPS = ["Your taste", "How you watch", "Refine results"];
const INITIAL_PREFERENCES: RecommendationPreferences = {
  favoriteGenres: [],
  avoidedGenres: [],
  formats: [],
  preferredLength: "any",
  releasePeriod: "any",
  minimumScore: 60,
  popularity: "any",
  tones: [],
};

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function optionClass(selected: boolean): string {
  return cn(
    "cursor-pointer rounded-control border px-3 py-2 text-sm font-medium transition-all duration-200",
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-soft focus-within:ring-offset-2 focus-within:ring-offset-surface",
    selected
      ? "border-brand/40 bg-brand/15 text-brand-soft shadow-[inset_0_0_0_1px_rgb(139_92_246_/_0.08)]"
      : "border-line bg-canvas-soft text-ink-muted hover:border-line-strong hover:bg-surface-raised hover:text-ink",
  );
}

export function RecommendationForm() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<RecommendationPreferences>(INITIAL_PREFERENCES);
  const [error, setError] = useState("");

  function advance() {
    if (step === 0 && preferences.favoriteGenres.length === 0) {
      setError("Choose at least one favourite genre to continue.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function submit() {
    saveRecommendationPreferences(preferences);
    router.push("/recommend/results");
  }

  return (
    <section className="mx-auto max-w-4xl">
      <ol className="mb-7 grid grid-cols-3 gap-2 sm:mb-9 sm:gap-4" aria-label="Questionnaire progress">
        {STEPS.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "border-t-2 pt-2.5 text-[0.6875rem] font-semibold transition-colors sm:text-sm",
              index <= step ? "border-brand text-brand-soft" : "border-line text-ink-faint",
            )}
          >
            <span className="mr-1 text-current/70">0{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="rounded-panel border border-line bg-surface/75 p-5 shadow-panel backdrop-blur-sm sm:p-8 lg:p-10">
        {step === 0 && (
          <fieldset>
            <legend className="text-2xl font-semibold tracking-[-0.03em] text-ink">What do you enjoy?</legend>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Pick at least one favourite genre. Avoided genres are optional.
            </p>

            <div className="mt-7">
              <h2 className="text-sm font-semibold text-ink">
                Favourite genres <span className="text-brand-soft">(required)</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {GENRES.map((genre) => {
                  const selected = preferences.favoriteGenres.includes(genre);
                  return (
                    <label key={genre} className={optionClass(selected)}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selected}
                        onChange={() => setPreferences((current) => ({
                          ...current,
                          favoriteGenres: toggle(current.favoriteGenres, genre),
                        }))}
                      />
                      {genre}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-7">
              <h2 className="text-sm font-semibold text-ink">
                Genres to avoid <span className="font-normal text-ink-faint">(optional)</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {GENRES.map((genre) => {
                  const selected = preferences.avoidedGenres.includes(genre);
                  return (
                    <label key={genre} className={optionClass(selected)}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selected}
                        onChange={() => setPreferences((current) => ({
                          ...current,
                          avoidedGenres: toggle(current.avoidedGenres, genre),
                        }))}
                      />
                      {genre}
                    </label>
                  );
                })}
              </div>
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <fieldset>
            <legend className="text-2xl font-semibold tracking-[-0.03em] text-ink">How do you like to watch?</legend>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Leave a choice open when you are happy to see a broader mix.
            </p>

            <div className="mt-7">
              <h2 className="text-sm font-semibold text-ink">Preferred formats</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {FORMATS.map((format) => {
                  const selected = preferences.formats.includes(format);
                  return (
                    <label key={format} className={optionClass(selected)}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selected}
                        onChange={() => setPreferences((current) => ({
                          ...current,
                          formats: toggle(current.formats, format),
                        }))}
                      />
                      {format === "MOVIE" ? "Movie" : format === "SPECIAL" ? "Special" : format}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 grid gap-6 border-t border-line pt-7 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-ink">
                Preferred length
                <select
                  value={preferences.preferredLength}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    preferredLength: event.target.value as RecommendationPreferences["preferredLength"],
                  }))}
                  className={cn(fieldStyles, "mt-2 block font-normal")}
                >
                  <option value="any">Any length</option>
                  <option value="short">Short (up to 13 episodes)</option>
                  <option value="medium">Medium (14–39 episodes)</option>
                  <option value="long">Long (40+ episodes)</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-ink">
                Release period
                <select
                  value={preferences.releasePeriod}
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    releasePeriod: event.target.value as RecommendationPreferences["releasePeriod"],
                  }))}
                  className={cn(fieldStyles, "mt-2 block font-normal")}
                >
                  <option value="any">Any period</option>
                  <option value="recent">Recent (2021 onward)</option>
                  <option value="modern">Modern (2010–2020)</option>
                  <option value="classic">Classic (before 2010)</option>
                </select>
              </label>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset>
            <legend className="text-2xl font-semibold tracking-[-0.03em] text-ink">Refine your results</legend>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              These final choices help rank close matches without over-constraining the list.
            </p>

            <label className="mt-7 block text-sm font-semibold text-ink" htmlFor="minimum-score">
              <span className="flex items-center justify-between gap-4">
                Minimum AniList score
                <output className="rounded-full bg-score/10 px-2.5 py-1 text-xs text-score-ink">
                  {preferences.minimumScore}%
                </output>
              </span>
              <input
                id="minimum-score"
                type="range"
                min="40"
                max="95"
                step="5"
                value={preferences.minimumScore}
                onChange={(event) => setPreferences((current) => ({
                  ...current,
                  minimumScore: Number(event.target.value),
                }))}
                className="mt-4 block w-full accent-brand"
              />
            </label>

            <div className="mt-8 border-t border-line pt-7">
              <h2 className="text-sm font-semibold text-ink">Popularity</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(["popular", "hidden-gems", "any"] as const).map((option) => {
                  const selected = preferences.popularity === option;
                  return (
                    <label key={option} className={optionClass(selected)}>
                      <input
                        className="sr-only"
                        type="radio"
                        name="popularity"
                        checked={selected}
                        onChange={() => setPreferences((current) => ({ ...current, popularity: option }))}
                      />
                      {option === "hidden-gems" ? "Hidden gems" : option === "any" ? "No preference" : "Popular picks"}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-7">
              <h2 className="text-sm font-semibold text-ink">
                Content tone <span className="font-normal text-ink-faint">(optional)</span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {TONES.map((tone) => {
                  const selected = preferences.tones.includes(tone);
                  return (
                    <label key={tone} className={optionClass(selected)}>
                      <input
                        className="sr-only"
                        type="checkbox"
                        checked={selected}
                        onChange={() => setPreferences((current) => ({
                          ...current,
                          tones: toggle(current.tones, tone),
                        }))}
                      />
                      {tone.replace("-", " ")}
                    </label>
                  );
                })}
              </div>
            </div>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="mt-6 rounded-control border border-danger/25 bg-danger/[0.07] px-4 py-3 text-sm text-danger-ink">
            {error}
          </p>
        )}

        <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-6">
          {step > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError("");
                setStep((current) => current - 1);
              }}
            >
              Back
            </Button>
          ) : <span />}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={advance}>Continue</Button>
          ) : (
            <Button type="button" onClick={submit}>See recommendations</Button>
          )}
        </div>
      </div>
    </section>
  );
}
