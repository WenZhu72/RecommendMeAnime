import type { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

type AnimeGridProps = { anime: Anime[] };

export function AnimeGrid({ anime }: AnimeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {anime.map((item) => <AnimeCard key={item.id} anime={item} />)}
    </div>
  );
}
