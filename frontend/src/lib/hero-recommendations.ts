import { selectHeroFallbackCandidates } from "@/lib/hero-fallback";
import type { Anime } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

export const HERO_RECOMMENDATION_LIMIT = 24;
export const HERO_FALLBACK_MINIMUM_SCORE = 85;
export const HERO_FALLBACK_MINIMUM_POPULARITY = 10_000;
export const HERO_FALLBACK_RANDOM_PAGE_COUNT = 5;
export const HERO_FALLBACK_CANDIDATES_PER_PAGE = 50;
export const HERO_FALLBACK_CACHE_SECONDS = 3600;

function hasCompletePosterMetadata(anime: Anime): boolean {
  return Boolean(
    anime.coverImage
      && anime.title
      && anime.title !== "Untitled anime"
      && anime.format
      && anime.seasonYear,
  );
}

export function selectFallbackHeroAnime(
  anime: Anime[],
  random: () => number = Math.random,
): Anime[] {
  return selectHeroFallbackCandidates(
    anime,
    (item) => (
      hasCompletePosterMetadata(item)
      && item.averageScore !== null
      && item.averageScore >= HERO_FALLBACK_MINIMUM_SCORE
      && item.popularity !== null
      && item.popularity >= HERO_FALLBACK_MINIMUM_POPULARITY
    ),
    HERO_RECOMMENDATION_LIMIT,
    random,
  );
}

export function selectPersonalizedHeroAnime(anime: Anime[]): Anime[] {
  const seen = new Set<number>();

  return anime
    .filter((item) => {
      if (!hasCompletePosterMetadata(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, HERO_RECOMMENDATION_LIMIT);
}

export function getHeroRecommendationReason(
  anime: Anime,
  preferences: RecommendationPreferences | null,
): string {
  if (preferences) {
    const matchingGenre = preferences.favoriteGenres.find((genre) => anime.genres.includes(genre));
    if (matchingGenre) return `Matches your taste in ${matchingGenre.toLowerCase()}.`;
    return "Selected around your saved preferences.";
  }

  const leadGenre = anime.genres[0]?.toLowerCase();
  return leadGenre ? `A highly rated ${leadGenre} standout.` : "Highly rated by the community.";
}
