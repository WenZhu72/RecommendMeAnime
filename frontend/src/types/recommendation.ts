export type AnimeFormat = "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL";

export type AnimeLength = "short" | "medium" | "long" | "any";
export type ReleasePeriod = "recent" | "modern" | "classic" | "any";
export type PopularityPreference = "popular" | "hidden-gems" | "any";
export type ContentTone = "light-hearted" | "dark" | "emotional" | "action-focused";

export type RecommendationPreferences = {
  favoriteGenres: string[];
  avoidedGenres: string[];
  formats: AnimeFormat[];
  preferredLength: AnimeLength;
  releasePeriod: ReleasePeriod;
  minimumScore: number;
  popularity: PopularityPreference;
  tones: ContentTone[];
};
