import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { getCarouselCardVisualState } from "@/lib/hero-carousel-logic";
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

type HeroCardStyle = CSSProperties & {
  "--hero-card-accent": string;
  "--hero-card-x": string;
  "--hero-card-y": string;
  "--hero-card-z": string;
  "--hero-card-rotation": string;
  "--hero-card-scale": string;
  "--hero-card-opacity": string;
  "--hero-card-saturation": string;
  "--hero-card-brightness": string;
  "--hero-card-z-index": string;
  "--hero-card-pointer-events": string;
  "--hero-card-visibility": string;
};

const CARD_POSITION_PERCENT = 64;

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
  const visualState = getCarouselCardVisualState(relativeIndex);
  const accentStyle: HeroCardStyle = {
    "--hero-card-accent": artworkAccent(anime.color),
    "--hero-card-x": `${relativeIndex * CARD_POSITION_PERCENT}%`,
    "--hero-card-y": `${visualState.translateY}px`,
    "--hero-card-z": `${visualState.translateZ}px`,
    "--hero-card-rotation": `${visualState.rotation}deg`,
    "--hero-card-scale": String(visualState.scale),
    "--hero-card-opacity": String(visualState.opacity),
    "--hero-card-saturation": String(visualState.saturation),
    "--hero-card-brightness": String(visualState.brightness),
    "--hero-card-z-index": String(visualState.zIndex),
    "--hero-card-pointer-events": visualState.interactive ? "auto" : "none",
    "--hero-card-visibility": visualState.visibilityHidden ? "hidden" : "visible",
  };

  const poster = anime.coverImage ? (
    <Image
      src={anime.coverImage}
      alt={visuallyActive ? `Cover art for ${anime.title}` : ""}
      fill
      loading={priority ? "eager" : "lazy"}
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
            tabIndex={visualState.interactive ? 0 : -1}
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
