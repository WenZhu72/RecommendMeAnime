"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import motionStyles from "@/components/search/AnimeGridMotion.module.css";
import { GenreBadge } from "@/components/ui/GenreBadge";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import {
  animeCardBodyClasses,
  animeCardGenresClasses,
  animeCardMetadataClasses,
  animeCardShellClasses,
  animeCardTitleClasses,
} from "@/components/search/anime-card-layout";
import { isAnimeImageLoaded } from "@/lib/anime-image-loading";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type AnimeCardProps = {
  anime: Anime;
  imageLoading?: "eager" | "lazy";
  imagePriority?: boolean;
};

function formatMetadata(anime: Anime): string {
  return [anime.format?.replaceAll("_", " "), anime.seasonYear].filter(Boolean).join(" / ") || "Details available";
}

type AnimeCardImageProps = {
  alt: string;
  imageLoading: "eager" | "lazy";
  imagePriority: boolean;
  src: string;
};

function AnimeCardImage({ alt, imageLoading, imagePriority, src }: AnimeCardImageProps) {
  const [loadedImageSource, setLoadedImageSource] = useState<string | null>(null);
  const imageLoaded = isAnimeImageLoaded(src, loadedImageSource);
  const markImageLoaded = useCallback(() => {
    setLoadedImageSource(src);
  }, [src]);
  const captureImage = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) {
      setLoadedImageSource(src);
    }
  }, [src]);

  return (
    <>
      <span
        className={cn(
          motionStyles.skeletonSurface,
          motionStyles.imagePlaceholder,
          imageLoaded && motionStyles.imagePlaceholderLoaded,
        )}
        aria-hidden="true"
      />
      <Image
        ref={captureImage}
        src={src}
        alt={alt}
        fill
        loading={imagePriority ? undefined : imageLoading}
        priority={imagePriority}
        sizes="(max-width: 639px) calc(50vw - 1.625rem), (max-width: 1023px) calc(33.333vw - 2rem), (max-width: 1279px) calc(25vw - 2.1875rem), 14rem"
        onLoad={markImageLoaded}
        className={cn(
          motionStyles.cardImage,
          imageLoaded && motionStyles.cardImageLoaded,
          "object-cover group-hover:scale-[1.035]",
        )}
      />
    </>
  );
}

export function AnimeCard({ anime, imageLoading = "lazy", imagePriority = false }: AnimeCardProps) {
  return (
    <article className={cn(
      "group transition-[transform,border-color,box-shadow] duration-300 ease-product hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover focus-within:border-brand/55 focus-within:ring-2 focus-within:ring-brand/30",
      animeCardShellClasses,
    )}>
      <div className="relative">
        <Link
          href={`/anime/${anime.id}`}
          className="block focus-visible:outline-none"
          aria-label={`View details for ${anime.title}`}
        >
          <div className="relative aspect-[2/3] overflow-hidden bg-surface-raised">
            {anime.coverImage ? (
              <AnimeCardImage
                key={anime.coverImage}
                src={anime.coverImage}
                alt={`Cover art for ${anime.title}`}
                imageLoading={imageLoading}
                imagePriority={imagePriority}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-ink-faint">
                Cover unavailable
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
            {anime.averageScore !== null && (
              <span className="absolute bottom-3 left-3 inline-flex items-center rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[0.6875rem] font-semibold text-white backdrop-blur-md">
                <span>{anime.averageScore}%</span>
                <span className="sr-only"> AniList score</span>
              </span>
            )}
          </div>
        </Link>
        <div className="absolute right-2.5 top-2.5 z-10">
          <WatchlistButton anime={anime} compact />
        </div>
      </div>

      <div className={animeCardBodyClasses}>
        <h3 className={animeCardTitleClasses}>
          <Link
            href={`/anime/${anime.id}`}
            className="rounded-sm transition-colors hover:text-brand-soft focus-visible:outline-none"
          >
            {anime.title}
          </Link>
        </h3>
        <p className={animeCardMetadataClasses}>{formatMetadata(anime)}</p>
        <div className={animeCardGenresClasses}>
          {anime.genres.slice(0, 2).map((genre) => (
            <GenreBadge key={genre}>{genre}</GenreBadge>
          ))}
        </div>
      </div>
    </article>
  );
}
