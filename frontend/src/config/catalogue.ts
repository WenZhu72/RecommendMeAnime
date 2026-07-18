/*
 * Catalogue option labels are kept outside UI components so browse,
 * recommendations, onboarding, and future account preferences can share them.
 */
export const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const;

export const ANIME_FORMATS = [
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "Movie" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "SPECIAL", label: "Special" },
] as const;

export const ANIME_SEASONS = [
  { value: "WINTER", label: "Winter" },
  { value: "SPRING", label: "Spring" },
  { value: "SUMMER", label: "Summer" },
  { value: "FALL", label: "Fall" },
] as const;

export const BROWSE_SORTS = [
  { value: "popular", label: "Most popular" },
  { value: "trending", label: "Trending" },
  { value: "top-rated", label: "Highest rated" },
] as const;

export const BROWSE_YEARS = Array.from(
  { length: new Date().getFullYear() - 1939 },
  (_, index) => new Date().getFullYear() - index,
);
