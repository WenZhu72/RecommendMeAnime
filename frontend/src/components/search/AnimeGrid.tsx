import type { CSSProperties } from "react";

import browseMotionStyles from "@/components/browse/BrowseResultsMotion.module.css";
import type { Anime } from "@/types/anime";
import { AnimeCard } from "./AnimeCard";

type AnimeGridProps = {
  anime: Anime[];
  animateEntrance?: boolean;
  eagerFirstImage?: boolean;
};

type BrowseMotionStyle = CSSProperties & { "--browse-stagger-delay": string };

export const animeGridClasses =
  "grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5";

export function AnimeGrid({ anime, animateEntrance = false, eagerFirstImage = false }: AnimeGridProps) {
  return (
    <div className={animeGridClasses}>
      {anime.map((item, index) => {
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
            className={browseMotionStyles.resultCard}
            style={{ "--browse-stagger-delay": `${index * 32}ms` } as BrowseMotionStyle}
          >
            {card}
          </div>
        ) : card;
      })}
    </div>
  );
}
