import type { CSSProperties } from "react";

import motionStyles from "@/components/search/AnimeGridMotion.module.css";
import { animeGridClasses } from "@/components/search/anime-card-layout";
import { filterPublicAnime } from "@/lib/anime-safety";
import type { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

type AnimeGridProps = {
  anime: Anime[];
  animateEntrance?: boolean;
  eagerFirstImage?: boolean;
};

type AnimeGridMotionStyle = CSSProperties & { "--anime-grid-stagger-delay": string };

export function AnimeGrid({ anime, animateEntrance = false, eagerFirstImage = false }: AnimeGridProps) {
  const publicAnime = filterPublicAnime(anime);

  return (
    <div className={animeGridClasses}>
      {publicAnime.map((item, index) => {
        const card = (
          <AnimeCard
            key={item.id}
            anime={item}
            imageLoading={eagerFirstImage && index === 0 ? "eager" : "lazy"}
          />
        );

        return animateEntrance ? (
          <div
            key={item.id}
            className={motionStyles.resultCard}
            style={{ "--anime-grid-stagger-delay": `${index * 32}ms` } as AnimeGridMotionStyle}
          >
            {card}
          </div>
        ) : card;
      })}
    </div>
  );
}
