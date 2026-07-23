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

export const BROWSE_SORT_CONFIG = {
  popular: {
    value: "popular",
    triggerLabel: "Most popular",
    heading: "Popular anime",
  },
  trending: {
    value: "trending",
    triggerLabel: "Trending",
    heading: "Trending anime",
  },
  "top-rated": {
    value: "top-rated",
    triggerLabel: "Highest rated",
    heading: "Highest-rated anime",
  },
} as const;

export type BrowseSort = keyof typeof BROWSE_SORT_CONFIG;
export type BrowseSortConfig = typeof BROWSE_SORT_CONFIG[BrowseSort];

export const BROWSE_SORTS = Object.values(BROWSE_SORT_CONFIG).map((sort) => ({
  value: sort.value,
  label: sort.triggerLabel,
}));

export function normalizeBrowseSort(value: string | null | undefined): BrowseSort {
  return value && Object.prototype.hasOwnProperty.call(BROWSE_SORT_CONFIG, value)
    ? value as BrowseSort
    : "popular";
}

export function getBrowseSortConfig(value: string | null | undefined): BrowseSortConfig {
  return BROWSE_SORT_CONFIG[normalizeBrowseSort(value)];
}

export const BROWSE_YEARS = Array.from(
  { length: new Date().getFullYear() - 1939 },
  (_, index) => new Date().getFullYear() - index,
);
