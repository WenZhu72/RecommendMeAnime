import { ApiError, apiRequest, queryString } from "@/lib/api/client";
import { sanitizePublicAnime, sanitizePublicAnimeList } from "@/lib/anime-safety";
import { buildBrowseAnimePath, buildBrowsePageInfoPath } from "@/lib/browse-path";
import { buildHomeCataloguePath } from "@/lib/home-catalogue";
import type { Anime, AnimeListResponse, AnimePageInfo } from "@/types/anime";

type PageOptions = { page?: number; perPage?: number };
type HeroFallbackCandidateOptions = Required<PageOptions> & {
  revalidateSeconds: number;
};
export type BrowseOptions = PageOptions & {
  search?: string;
  genre?: string;
  genres?: string[];
  format?: "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";
  season?: "WINTER" | "SPRING" | "SUMMER" | "FALL";
  seasonYear?: number;
  minimumScore?: number;
  sort?: "trending" | "popular" | "top-rated";
};

type BrowseRequestOptions = {
  retry?: boolean;
  signal?: AbortSignal;
};

const DEFAULT_PAGE: Required<PageOptions> = { page: 1, perPage: 12 };

async function getHomeList(
  collection: "trending" | "popular" | "top-rated",
  options: PageOptions = DEFAULT_PAGE,
  revalidate = 3600,
): Promise<AnimeListResponse> {
  const response = await apiRequest<AnimeListResponse>(
    buildHomeCataloguePath(collection, options),
    { revalidate },
  );
  return sanitizePublicAnimeList(response);
}

export async function getTrendingAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getHomeList("trending", options)).items;
}

export async function getPopularAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getHomeList("popular", options)).items;
}

export async function getTopRatedAnime(options?: PageOptions): Promise<Anime[]> {
  return (await getHomeList("top-rated", options)).items;
}

export async function getHeroFallbackCandidatePage(
  options: HeroFallbackCandidateOptions,
): Promise<AnimeListResponse> {
  return getHomeList(
    "top-rated",
    { page: options.page, perPage: options.perPage },
    options.revalidateSeconds,
  );
}

export async function getAnimeByGenre(genre: string, options?: PageOptions): Promise<Anime[]> {
  const response = await apiRequest<AnimeListResponse>(
    `/api/anime/genre/${encodeURIComponent(genre)}${queryString({
      page: options?.page ?? 1,
      per_page: options?.perPage ?? DEFAULT_PAGE.perPage,
    })}`,
    { revalidate: 3600 },
  );
  return sanitizePublicAnimeList(response).items;
}

export async function browseAnime(
  options: BrowseOptions = {},
  requestOptions: BrowseRequestOptions = {},
): Promise<AnimeListResponse> {
  const response = await apiRequest<AnimeListResponse>(
    buildBrowseAnimePath(options),
    { cache: "no-store", ...requestOptions },
  );
  return sanitizePublicAnimeList(response);
}

export async function getBrowsePageInfo(
  options: BrowseOptions = {},
  requestOptions: BrowseRequestOptions = {},
): Promise<AnimePageInfo> {
  return apiRequest<AnimePageInfo>(
    buildBrowsePageInfoPath(options),
    { cache: "no-store", ...requestOptions },
  );
}

export async function getAnimeById(id: number): Promise<Anime | null> {
  try {
    const anime = await apiRequest<Anime>(`/api/anime/${id}`, { revalidate: 3600 });
    return sanitizePublicAnime(anime);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
