import type { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

type AnimeGridProps = {
  anime: Anime[];
  eagerFirstImage?: boolean;
};

export function AnimeGrid({ anime, eagerFirstImage = false }: AnimeGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5">
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
