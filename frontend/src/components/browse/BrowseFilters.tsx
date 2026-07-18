"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { FilterDropdown } from "@/components/browse/FilterDropdown";
import { GenreDropdown } from "@/components/browse/GenreDropdown";
import { useBrowseNavigation } from "@/components/browse/BrowseNavigation";
import { SearchIcon, SlidersIcon } from "@/components/ui/Icons";
import { fieldStyles, Input } from "@/components/ui/Input";
import { ANIME_FORMATS, ANIME_SEASONS, BROWSE_SORTS, BROWSE_YEARS } from "@/config/catalogue";
import { buildBrowseLocation } from "@/lib/browse-path";
import { cn } from "@/lib/utils";

type BrowseFiltersProps = {
  initialSearch?: string;
};

const YEAR_OPTIONS = BROWSE_YEARS.map((year) => ({ label: String(year), value: String(year) }));

export function BrowseFilters({ initialSearch = "" }: BrowseFiltersProps) {
  const searchParams = useSearchParams();
  const { isPending, navigate } = useBrowseNavigation();
  const [query, setQuery] = useState(initialSearch);
  const [moreOpen, setMoreOpen] = useState(Boolean(searchParams.get("minimumScore")));
  const selectedGenres = searchParams.getAll("genre");

  function commitNavigation(parameters: URLSearchParams) {
    const href = buildBrowseLocation(parameters);
    const currentHref = `/browse${searchParams.size ? `?${searchParams.toString()}` : ""}`;
    if (href !== currentHref) navigate(href);
  }

  function updateParameter(name: string, value: string) {
    const parameters = new URLSearchParams(searchParams.toString());
    if (value) parameters.set(name, value);
    else parameters.delete(name);
    commitNavigation(parameters);
  }

  function updateGenres(genres: string[]) {
    const parameters = new URLSearchParams(searchParams.toString());
    parameters.delete("genre");
    genres.forEach((genre) => parameters.append("genre", genre));
    commitNavigation(parameters);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parameters = new URLSearchParams(searchParams.toString());
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

  const hasFilters = [...searchParams.keys()].some((key) => key !== "sort" && key !== "page")
    || (searchParams.get("sort") ?? "popular") !== "popular";

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
            disabled={isPending}
            aria-label="Apply search"
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft disabled:opacity-50"
          >
            <SearchIcon className="size-4" />
          </button>
        </form>

        <GenreDropdown selected={selectedGenres} onApply={updateGenres} disabled={isPending} />
        <FilterDropdown
          label="Format"
          value={searchParams.get("format") ?? ""}
          placeholder="Format"
          options={ANIME_FORMATS}
          disabled={isPending}
          onChange={(value) => updateParameter("format", value)}
        />
        <FilterDropdown
          label="Season"
          value={searchParams.get("season") ?? ""}
          placeholder="Season"
          options={ANIME_SEASONS}
          disabled={isPending}
          onChange={(value) => updateParameter("season", value)}
        />

        <FilterDropdown
          label="Release year"
          value={searchParams.get("year") ?? ""}
          placeholder="Year"
          options={YEAR_OPTIONS}
          disabled={isPending}
          onChange={(value) => updateParameter("year", value)}
        />

        <FilterDropdown
          label="Sort order"
          value={searchParams.get("sort") ?? "popular"}
          placeholder="Sort"
          options={BROWSE_SORTS}
          disabled={isPending}
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
            moreOpen || searchParams.has("minimumScore")
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
            <label className="block w-full max-w-xs text-xs font-semibold text-ink-muted">
              Minimum score
              <select
                value={searchParams.get("minimumScore") ?? ""}
                onChange={(event) => updateParameter("minimumScore", event.target.value)}
                disabled={isPending}
                className={cn(fieldStyles, "mt-1.5 min-h-10")}
              >
                <option value="">Any score</option>
                <option value="60">60% or higher</option>
                <option value="70">70% or higher</option>
                <option value="80">80% or higher</option>
                <option value="90">90% or higher</option>
              </select>
            </label>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                disabled={isPending}
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
