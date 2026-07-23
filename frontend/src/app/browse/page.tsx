import type { Metadata } from "next";

import { BrowseFilters } from "@/components/browse/BrowseFilters";
import { BrowseNavigationProvider, BrowseResultsBoundary } from "@/components/browse/BrowseNavigation";
import {
  BrowsePaginationMetadataProvider,
  BrowseTitleCount,
} from "@/components/browse/BrowsePaginationMetadata";
import { Pagination } from "@/components/browse/Pagination";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { AnimeGridSkeleton } from "@/components/search/AnimeGridSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { getBrowseSortConfig } from "@/config/catalogue";
import { browseAnime } from "@/lib/api/anime";
import { buildBrowseAnimePath } from "@/lib/browse-path";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse anime",
  description: "Explore the AniList catalogue with search, filters, sorting, and pagination.",
};

type SearchParameters = Record<string, string | string[] | undefined>;
type BrowsePageProps = { searchParams: Promise<SearchParameters> };

const FORMATS = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"] as const;
const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function all(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter(Boolean);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function allowedValue<T extends readonly string[]>(value: string | undefined, values: T): T[number] | undefined {
  return value && values.includes(value as T[number]) ? (value as T[number]) : undefined;
}

function readableSeason(season: typeof SEASONS[number], year?: number): string {
  const label = `${season.slice(0, 1)}${season.slice(1).toLowerCase()}`;
  return year ? `${label} ${year}` : label;
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const parameters = await searchParams;
  const search = first(parameters.search)?.trim() || undefined;
  const genres = all(parameters.genre);
  const format = allowedValue(first(parameters.format), FORMATS);
  const season = allowedValue(first(parameters.season), SEASONS);
  const yearValue = positiveInteger(first(parameters.year), 0);
  const seasonYear = yearValue >= 1940 && yearValue <= 2100 ? yearValue : undefined;
  const sortConfig = getBrowseSortConfig(first(parameters.sort));
  const sort = sortConfig.value;
  const page = positiveInteger(first(parameters.page), 1);
  const scoreValue = positiveInteger(first(parameters.minimumScore), 0);
  const minimumScore = scoreValue >= 1 && scoreValue <= 100 ? scoreValue : undefined;
  const browseOptions = {
    search,
    genres,
    format,
    season,
    seasonYear,
    sort,
    minimumScore,
    page,
    perPage: 20,
  };
  const queryKey = buildBrowseAnimePath(browseOptions);

  let response = null;
  let error = false;
  try {
    response = await browseAnime(browseOptions);
  } catch {
    error = true;
  }

  const filterSummary = [
    search ? `Results for "${search}"` : null,
    genres.length ? genres.join(", ") : null,
    format,
    season ? readableSeason(season, seasonYear) : seasonYear,
  ].filter(Boolean).join(" / ");
  return (
    <Container className="py-7 sm:py-10">
      <h1 className="sr-only">Browse anime</h1>
      <BrowseNavigationProvider>
        <BrowseFilters
          key={`${search ?? ""}:${minimumScore ?? ""}`}
          initialSearch={search}
        />

        <BrowseResultsBoundary responseKey={queryKey} fallback={<BrowseResultsLoading />}>
          <BrowsePaginationMetadataProvider
            key={queryKey}
            browseOptions={browseOptions}
            initialPageInfo={response?.pageInfo ?? null}
            responseKey={queryKey}
          >
            <section
              id="browse-results"
              data-browse-query={queryKey}
              className="mt-9 scroll-mt-28 sm:mt-11"
              aria-labelledby="browse-results-title"
            >
              <div className="mb-6 flex items-end justify-between gap-4">
                <h2 id="browse-results-title" className="text-xl font-semibold tracking-[-0.03em] text-ink sm:text-2xl">
                  {filterSummary || sortConfig.heading}
                </h2>
                <BrowseTitleCount />
              </div>

              {error ? (
                <ErrorMessage message="The catalogue is unavailable right now. Your filters are still saved in the URL; please try again shortly." />
              ) : response?.items.length ? (
                <>
                  <AnimeGrid anime={response.items} animateEntrance eagerFirstImage />
                  <Pagination />
                </>
              ) : (
                <EmptyState
                  title="No titles matched these filters"
                  description="Try a broader search, different genres, or a lower minimum score."
                  actionHref="/browse"
                  actionLabel="Clear all filters"
                />
              )}
            </section>
          </BrowsePaginationMetadataProvider>
        </BrowseResultsBoundary>
      </BrowseNavigationProvider>
    </Container>
  );
}

function BrowseResultsLoading() {
  return (
    <section className="mt-9 scroll-mt-28 sm:mt-11" aria-busy="true">
      <div className="mb-6 h-8 w-52 animate-pulse rounded-lg bg-line/70" aria-hidden="true" />
      <AnimeGridSkeleton count={20} label="Loading anime results and pagination" />
    </section>
  );
}
