import type { Anime, AnimeListResponse } from "@/types/anime";

export function isPublicAnime(anime: Anime): boolean {
  return anime.isAdult !== true;
}

export function filterPublicAnime(anime: Anime[]): Anime[] {
  return anime.filter(isPublicAnime);
}

export function sanitizePublicAnime(anime: Anime): Anime | null {
  if (!isPublicAnime(anime)) return null;

  return {
    ...anime,
    relations: filterPublicAnime(anime.relations),
    recommendations: filterPublicAnime(anime.recommendations),
  };
}

export function sanitizePublicAnimeList(response: AnimeListResponse): AnimeListResponse {
  return { ...response, items: filterPublicAnime(response.items) };
}
