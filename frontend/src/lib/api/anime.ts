import { ApiError, apiRequest, queryString } from "@/lib/api/client";
import { buildBrowseAnimePath } from "@/lib/browse-path";
import type { Anime, AnimeListResponse } from "@/types/anime";

type PageOptions = { page?: number; perPage?: number };
type HeroFallbackCandidateOptions = Required<PageOptions> & {
  minimumScore: number;
  revalidateSeconds: number;
};
type BrowseOptions = PageOptions & {
  search?: string;
  genre?: string;
  genres?: string[];
  format?: "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
  season?: "WINTER" | "SPRING" | "SUMMER" | "FALL";
  seasonYear?: number;
  minimumScore?: number;
  sort?: "trending" | "popular" | "top-rated";
};

const DEFAULT_PAGE: Required<PageOptions> = { page: 1, perPage: 12 };

async function getList(path: string, options: PageOptions = DEFAULT_PAGE): Promise<AnimeListResponse> {
  return apiRequest<AnimeListResponse>(
    `${path}${queryString({ page: options.page ?? 1, per_page: options.perPage ?? DEFAULT_PAGE.perPage })}`,
    { revalidate: 3600 },
  );
}

export async function getTrendingAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getList("/api/anime/trending", options)).items;
}

export async function getPopularAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getList("/api/anime/popular", options)).items;
}

export async function getTopRatedAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getList("/api/anime/top-rated", options)).items;
}

export async function getHeroFallbackCandidatePage(
  options: HeroFallbackCandidateOptions,
): Promise<AnimeListResponse> {
  return apiRequest<AnimeListResponse>(
    buildBrowseAnimePath({
      page: options.page,
      perPage: options.perPage,
      minimumScore: options.minimumScore,
      sort: "top-rated",
    }),
    { revalidate: options.revalidateSeconds },
  );
}

export async function getAnimeByGenre(genre: string, options?: PageOptions): Promise<Anime[]> {
  return (await getList(`/api/anime/genre/${encodeURIComponent(genre)}`, options)).items;
}

export async function browseAnime(options: BrowseOptions = {}): Promise<AnimeListResponse> {
  return apiRequest<AnimeListResponse>(
    buildBrowseAnimePath(options),
    { cache: "no-store" },
  );
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  try {
    return await apiRequest<Anime>(`/api/anime/${id}`, { revalidate: 3600 });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
