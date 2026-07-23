"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FilterDropdown } from "@/components/browse/FilterDropdown";
import { GenreDropdown } from "@/components/browse/GenreDropdown";
import { YearDropdown } from "@/components/browse/YearDropdown";
import { useBrowseNavigation } from "@/components/browse/BrowseNavigation";
import { SearchIcon, SlidersIcon } from "@/components/ui/Icons";
import { Input } from "@/components/ui/Input";
import {
  ANIME_FORMATS,
  ANIME_SEASONS,
  BROWSE_SORTS,
  normalizeBrowseSort,
} from "@/config/catalogue";
import { buildBrowseLocation, updateBrowseGenres, updateBrowseParameter } from "@/lib/browse-path";
import { cn } from "@/lib/utils";

type BrowseFiltersProps = {
  initialSearch?: string;
};

const MINIMUM_SCORE_MAX = 100;
const MINIMUM_SCORE_STEP = 5;
const SCORE_COMMIT_DELAY_MS = 320;

export function BrowseFilters({ initialSearch = "" }: BrowseFiltersProps) {
  const searchParams = useSearchParams();
  const {
    getNavigationParameters,
    isPending,
    navigate,
    navigationParameters,
  } = useBrowseNavigation();
  const [query, setQuery] = useState(initialSearch);
  const [moreOpen, setMoreOpen] = useState(Boolean(searchParams.get("minimumScore")));
  const selectedGenres = navigationParameters.getAll("genre");
  const selectedYear = navigationParameters.get("year") ?? "";
  const selectedSort = normalizeBrowseSort(navigationParameters.get("sort"));

  function commitNavigation(parameters: URLSearchParams) {
    navigate(buildBrowseLocation(parameters));
  }

  function updateParameter(name: string, value: string) {
    commitNavigation(updateBrowseParameter(getNavigationParameters(), name, value));
  }

  function updateGenres(genres: string[]) {
    commitNavigation(updateBrowseGenres(getNavigationParameters(), genres));
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parameters = getNavigationParameters();
    const cleaned = query.trim();
    if (cleaned) parameters.set("search", cleaned);
    else parameters.delete("search");
    commitNavigation(parameters);
  }

  function resetFilters() {
    setQuery("");
    setMoreOpen(false);
    navigate("/browse");
  }

  const hasFilters = [...navigationParameters.keys()].some((key) => key !== "sort" && key !== "page")
    || (navigationParameters.get("sort") ?? "popular") !== "popular";

  return (
    <section
      className="rounded-card border border-line bg-surface/78 p-2.5 shadow-card"
      aria-label="Browse filters"
      aria-busy={isPending}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(13rem,1.5fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(7rem,0.8fr)_minmax(9rem,1fr)_auto]">
        <form onSubmit={submitSearch} role="search" className="relative min-w-0">
          <label className="sr-only" htmlFor="browse-search">Search the anime catalogue</label>
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <Input
            id="browse-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anime"
            className="min-h-control pr-10 pl-9"
          />
          <button
            type="submit"
            aria-label="Apply search"
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:opacity-50"
          >
            <SearchIcon className="size-4" />
          </button>
        </form>

        <GenreDropdown selected={selectedGenres} onChange={updateGenres} />

        <FilterDropdown
          label="Format"
          value={navigationParameters.get("format") ?? ""}
          placeholder="Format"
          options={ANIME_FORMATS}
          includePlaceholderOption={false}
          clearOnReselect
          onChange={(value) => updateParameter("format", value)}
        />

        <FilterDropdown
          label="Season"
          value={navigationParameters.get("season") ?? ""}
          placeholder="Season"
          options={ANIME_SEASONS}
          includePlaceholderOption={false}
          clearOnReselect
          onChange={(value) => updateParameter("season", value)}
        />

        <YearDropdown
          value={selectedYear}
          onChange={(year) => updateParameter("year", year)}
        />

        <FilterDropdown
          label="Sort order"
          value={selectedSort}
          placeholder="Sort"
          options={BROWSE_SORTS}
          includePlaceholderOption={false}
          onChange={(value) => updateParameter("sort", value)}
        />

        <button
          type="button"
          aria-expanded={moreOpen}
          aria-controls="more-browse-filters"
          onClick={() => setMoreOpen((open) => !open)}
          className={cn(
            "inline-flex min-h-control items-center justify-center gap-2 rounded-control border px-3.5 text-sm font-medium transition-[color,background-color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20",
            moreOpen || navigationParameters.has("minimumScore")
              ? "border-brand/45 bg-brand/8 text-ink"
              : "border-line bg-canvas-soft/90 text-ink-muted hover:border-line-strong hover:text-ink",
          )}
        >
          <SlidersIcon className="size-4" />
          More
        </button>
      </div>

      <div
        id="more-browse-filters"
        aria-hidden={!moreOpen}
        inert={!moreOpen}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-product",
          moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-2 flex flex-col gap-3 border-t border-line px-1 pt-3 sm:flex-row sm:items-end sm:justify-between">
            <MinimumScoreSlider
              key={navigationParameters.get("minimumScore") ?? "any-score"}
              initialValue={navigationParameters.get("minimumScore") ?? ""}
              onCommit={(value) => updateParameter("minimumScore", value)}
            />
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-10 self-start rounded-control px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:opacity-50 sm:self-end"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type MinimumScoreSliderProps = {
  initialValue: string;
  onCommit: (value: string) => void;
};

function MinimumScoreSlider({ initialValue, onCommit }: MinimumScoreSliderProps) {
  const initialScore = normalizedScore(initialValue);
  const [draftScore, setDraftScore] = useState(initialScore);
  const draftScoreRef = useRef(initialScore);
  const pointerActiveRef = useRef(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreLabel = draftScore ? `${draftScore}% or higher` : "Any score";

  useEffect(() => () => clearCommitTimer(), []);

  function clearCommitTimer() {
    if (commitTimerRef.current === null) return;
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = null;
  }

  function commitScore(score = draftScoreRef.current) {
    clearCommitTimer();
    onCommit(score ? String(score) : "");
  }

  function scheduleCommit(score: number) {
    clearCommitTimer();
    commitTimerRef.current = setTimeout(() => commitScore(score), SCORE_COMMIT_DELAY_MS);
  }

  function updateDraft(score: number) {
    draftScoreRef.current = score;
    setDraftScore(score);
    if (!pointerActiveRef.current) scheduleCommit(score);
  }

  function finishPointerInteraction() {
    if (!pointerActiveRef.current) return;
    pointerActiveRef.current = false;
    commitScore();
  }

  function clearScore() {
    draftScoreRef.current = 0;
    setDraftScore(0);
    commitScore(0);
  }

  return (
    <div className="w-full max-w-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="browse-minimum-score" className="text-xs font-semibold text-ink-muted">
          Minimum score
        </label>
        <div className="flex items-center gap-2">
          <output
            htmlFor="browse-minimum-score"
            className="rounded-full bg-score/10 px-2.5 py-1 text-xs font-semibold text-score-ink"
            aria-live="polite"
          >
            {scoreLabel}
          </output>
          <button
            type="button"
            onClick={clearScore}
            disabled={draftScore === 0}
            className="rounded-md px-2 py-1 text-xs font-semibold text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>
      </div>
      <input
        id="browse-minimum-score"
        type="range"
        min="0"
        max={MINIMUM_SCORE_MAX}
        step={MINIMUM_SCORE_STEP}
        value={draftScore}
        aria-label="Minimum AniList score"
        aria-valuetext={scoreLabel}
        onPointerDown={() => {
          pointerActiveRef.current = true;
          clearCommitTimer();
        }}
        onPointerUp={finishPointerInteraction}
        onPointerCancel={finishPointerInteraction}
        onChange={(event) => updateDraft(Number(event.target.value))}
        onKeyDown={(event) => {
          const nextScore = keyboardScore(event.key, draftScore);
          if (nextScore === null) return;
          event.preventDefault();
          updateDraft(nextScore);
        }}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(event.key)) {
            commitScore();
          }
        }}
        className="mt-3 block h-2 w-full cursor-grab appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-surface [&::-moz-range-thumb]:bg-brand [&::-moz-range-thumb]:shadow-card [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-surface [&::-webkit-slider-thumb]:bg-brand [&::-webkit-slider-thumb]:shadow-card"
        style={{
          background: `linear-gradient(to right, var(--color-brand) 0%, var(--color-brand) ${draftScore}%, var(--color-line) ${draftScore}%, var(--color-line) 100%)`,
        }}
      />
      <div className="mt-2 flex justify-between text-[0.6875rem] text-ink-faint" aria-hidden="true">
        <span>Any</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function normalizedScore(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.round(parsed), MINIMUM_SCORE_MAX);
}

function keyboardScore(key: string, currentScore: number): number | null {
  if (key === "Home") return 0;
  if (key === "End") return MINIMUM_SCORE_MAX;

  const increment = key === "PageUp" || key === "PageDown"
    ? MINIMUM_SCORE_STEP * 4
    : MINIMUM_SCORE_STEP;
  if (["ArrowRight", "ArrowUp", "PageUp"].includes(key)) {
    return Math.min(currentScore + increment, MINIMUM_SCORE_MAX);
  }
  if (["ArrowLeft", "ArrowDown", "PageDown"].includes(key)) {
    return Math.max(currentScore - increment, 0);
  }
  return null;
}
