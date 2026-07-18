import Image from "next/image";
import Link from "next/link";

import { GenreBadge } from "@/components/ui/GenreBadge";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import type { Anime } from "@/types/anime";

type AnimeCardProps = {
  anime: Anime;
  imageLoading?: "eager" | "lazy";
};

function formatMetadata(anime: Anime): string {
  return [anime.format?.replaceAll("_", " "), anime.seasonYear].filter(Boolean).join(" / ") || "Details available";
}

export function AnimeCard({ anime, imageLoading = "lazy" }: AnimeCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-line/80 bg-surface/78 shadow-card transition-[transform,border-color,box-shadow] duration-300 ease-product hover:-translate-y-1 hover:border-line-strong hover:shadow-card-hover focus-within:border-brand/55 focus-within:ring-2 focus-within:ring-brand/30">
      <div className="relative">
        <Link
          href={`/anime/${anime.id}`}
          className="block focus-visible:outline-none"
          aria-label={`View details for ${anime.title}`}
        >
          <div className="relative aspect-[2/3] overflow-hidden bg-surface-raised">
            {anime.coverImage ? (
              <Image
                src={anime.coverImage}
                alt={`Cover art for ${anime.title}`}
                fill
                loading={imageLoading}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                className="object-cover transition-transform duration-500 ease-product group-hover:scale-[1.035]"
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

      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 tracking-[-0.015em] text-ink sm:text-[0.9375rem]">
          <Link
            href={`/anime/${anime.id}`}
            className="rounded-sm transition-colors hover:text-brand-soft focus-visible:outline-none"
          >
            {anime.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-xs text-ink-faint">{formatMetadata(anime)}</p>
        <div className="mt-auto flex min-h-8 flex-wrap content-end gap-1.5 pt-3">
          {anime.genres.slice(0, 2).map((genre) => (
            <GenreBadge key={genre}>{genre}</GenreBadge>
          ))}
        </div>
      </div>
    </article>
  );
}
