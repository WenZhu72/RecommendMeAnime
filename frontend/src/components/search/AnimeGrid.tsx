import type { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

type AnimeGridProps = {
  anime: Anime[];
  eagerFirstImage?: boolean;
};

export function AnimeGrid({ anime, eagerFirstImage = false }: AnimeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {anime.map((item, index) => (
        <AnimeCard
          key={item.id}
          anime={item}
          imageLoading={eagerFirstImage && index === 0 ? "eager" : "lazy"}
        />
      ))}
    </div>
  );
}
