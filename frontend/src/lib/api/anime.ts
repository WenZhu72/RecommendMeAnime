import { ApiError, apiRequest, queryString } from "@/lib/api/client";
import type { Anime, AnimeListResponse } from "@/types/anime";

type PageOptions = { page?: number; perPage?: number };
type BrowseOptions = PageOptions & {
  genre?: string;
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

export async function searchAnime(query: string, options: PageOptions = { perPage: 20 }): Promise<Anime[]> {
  const response = await apiRequest<AnimeListResponse>(
    `/api/anime/search${queryString({ q: query.trim(), page: options.page ?? 1, per_page: options.perPage ?? 20 })}`,
    { revalidate: 300 },
  );
  return response.items;
}

export async function getAnimeByGenre(genre: string, options?: PageOptions): Promise<Anime[]> {
  return (await getList(`/api/anime/genre/${encodeURIComponent(genre)}`, options)).items;
}

export async function browseAnime(options: BrowseOptions = {}): Promise<AnimeListResponse> {
  return apiRequest<AnimeListResponse>(
    `/api/anime/browse${queryString({
      genre: options.genre, format: options.format, season: options.season,
      season_year: options.seasonYear, minimum_score: options.minimumScore,
      sort: options.sort, page: options.page ?? 1, per_page: options.perPage ?? DEFAULT_PAGE.perPage,
    })}`,
    { revalidate: 3600 },
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
