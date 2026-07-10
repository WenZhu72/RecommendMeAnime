export type Anime = {
  id: number;
  title: string;
  romajiTitle?: string;
  description?: string;
  coverImage?: string;
  averageScore?: number;
  genres: string[];
  episodes?: number;
  chapters?: number;
};