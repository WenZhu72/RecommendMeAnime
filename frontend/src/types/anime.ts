export type AnimeTitle = {
  english: string | null;
  romaji: string | null;
  native: string | null;
};

export type AnimeDate = {
  year: number | null;
  month: number | null;
  day: number | null;
};

export type Anime = {
  id: number;
  title: string;
  titles: AnimeTitle;
  description: string | null;
  coverImage: string | null;
  color: string | null;
  bannerImage: string | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  genres: string[];
  format: string | null;
  status: string | null;
  episodes: number | null;
  duration: number | null;
  season: string | null;
  seasonYear: number | null;
  startDate: AnimeDate | null;
  endDate: AnimeDate | null;
  studios: string[];
  source: string | null;
  countryOfOrigin: string | null;
  synonyms: string[];
  siteUrl: string | null;
  relations: Anime[];
  recommendations: Anime[];
};

export type AnimePageInfo = {
  currentPage: number;
  hasNextPage: boolean;
  lastPage: number;
  perPage: number;
  total: number;
};

export type AnimeListResponse = {
  items: Anime[];
  pageInfo: AnimePageInfo;
};

export type WatchlistItem = Pick<
  Anime,
  "id" | "title" | "coverImage" | "averageScore" | "genres" | "format" | "seasonYear"
>;
