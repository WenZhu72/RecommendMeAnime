import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type HeroRecommendationCardProps = {
  anime: Anime;
  relativeIndex: number;
  visuallyActive: boolean;
  reason: string;
  priority?: boolean;
  onSelect: () => void;
};

const CARD_POSITION_PERCENT = 62;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatMetadata(anime: Anime): string {
  return [
    anime.format?.replaceAll("_", " "),
    anime.seasonYear,
    anime.averageScore !== null ? `${anime.averageScore}%` : null,
  ].filter(Boolean).join(" · ");
}

function artworkAccent(color: string | null): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#8b5cf6";
}

export function HeroRecommendationCard({
  anime,
  relativeIndex,
  visuallyActive,
  reason,
  priority = false,
  onSelect,
}: HeroRecommendationCardProps) {
  const distanceFromCentre = Math.abs(relativeIndex);
  const sideProgress = Math.min(distanceFromCentre, 1);
  const overflowProgress = Math.max(distanceFromCentre - 1, 0);
  const accentStyle = {
    "--hero-card-accent": artworkAccent(anime.color),
    "--hero-card-x": `${relativeIndex * CARD_POSITION_PERCENT}%`,
    "--hero-card-y": `${(17.6 * sideProgress) + (7 * overflowProgress)}px`,
    "--hero-card-z": `${(-80 * sideProgress) - (36 * overflowProgress)}px`,
    "--hero-card-rotation": `${clamp(-relativeIndex * 8, -12, 12)}deg`,
    "--hero-card-scale": String(clamp(1 - (0.16 * sideProgress) - (0.06 * overflowProgress), 0.72, 1)),
    "--hero-card-opacity": String(clamp(1 - (0.48 * sideProgress) - (0.3 * overflowProgress), 0.08, 1)),
    "--hero-card-saturation": String(clamp(1 - (0.3 * sideProgress) - (0.1 * overflowProgress), 0.55, 1)),
    "--hero-card-brightness": String(clamp(1 - (0.28 * sideProgress) - (0.08 * overflowProgress), 0.52, 1)),
    "--hero-card-z-index": String(Math.max(1, 30 - Math.round(distanceFromCentre * 10))),
  } as CSSProperties;

  const poster = anime.coverImage ? (
    <Image
      src={anime.coverImage}
      alt={visuallyActive ? `Cover art for ${anime.title}` : ""}
      fill
      priority={priority}
      unoptimized
      draggable={false}
      sizes="(max-width: 639px) 70vw, (max-width: 1023px) 19rem, 20rem"
      className="object-cover"
    />
  ) : (
    <div className="flex h-full items-center justify-center bg-surface-raised px-5 text-center text-xs text-ink-faint">
      Cover unavailable
    </div>
  );

  return (
    <article
      data-relative-index={relativeIndex}
      data-visually-active={visuallyActive}
      style={accentStyle}
      className="hero-recommendation-slide"
    >
      <div
        className={cn(
          "hero-recommendation-card relative aspect-[2/3] overflow-hidden rounded-[1.6rem] border bg-surface-raised",
          "transition-[transform,box-shadow,border-color] duration-500 ease-product",
          visuallyActive && "hover:-translate-y-1",
        )}
      >
        {poster}
        {visuallyActive ? (
          <Link
            href={`/anime/${anime.id}`}
            draggable={false}
            className="group absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-soft"
            aria-label={`View details for ${anime.title}`}
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,5,10,0.97)_0%,rgba(4,5,10,0.72)_24%,rgba(4,5,10,0.08)_58%,transparent_76%)]" />
            <div className="hero-recommendation-content absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
              <h2 className="line-clamp-2 text-xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-2xl">
                {anime.title}
              </h2>
              <p className="mt-2 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-white/60">
                {formatMetadata(anime)}
              </p>
              <p className="mt-2.5 text-sm leading-5 text-white/78">{reason}</p>
            </div>
          </Link>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-soft"
            aria-label={`Show ${anime.title}`}
          >
            <span className="absolute inset-0 bg-canvas/28 transition-colors duration-300 hover:bg-canvas/10" />
          </button>
        )}
      </div>
    </article>
  );
}
