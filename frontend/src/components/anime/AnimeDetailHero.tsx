import type { CSSProperties } from "react";
import Image from "next/image";

import { AnimeDescription } from "@/components/anime/AnimeDescription";
import { GenreBadge } from "@/components/ui/GenreBadge";
import { ExternalLinkIcon } from "@/components/ui/Icons";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type AnimeDetailHeroProps = {
  anime: Anime;
  metadata: [string, string][];
};

type ArtworkStyle = CSSProperties & { "--artwork-accent": string };

function safeArtworkColor(value: string | null): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#8b5cf6";
}

export function AnimeDetailHero({ anime, metadata }: AnimeDetailHeroProps) {
  const hasBanner = Boolean(anime.bannerImage);
  const artworkStyle: ArtworkStyle = { "--artwork-accent": safeArtworkColor(anime.color) };

  return (
    <article
      className="anime-detail-hero relative isolate overflow-hidden rounded-panel border border-line shadow-panel"
      style={artworkStyle}
    >
      {anime.bannerImage && (
        <div className="absolute inset-x-0 top-0 h-64 bg-surface-raised sm:h-96 lg:h-[27rem]">
          <Image
            src={anime.bannerImage}
            alt=""
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1280px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(3,4,9,0.3),transparent_62%)]" />
          <div className="anime-detail-banner-fade absolute inset-0" />
        </div>
      )}

      <div className={cn("relative p-5 sm:p-7 lg:p-9", hasBanner && "pt-40 sm:pt-60 lg:pt-72")}>
        <div
          className={cn(
            "flex flex-col gap-6",
            anime.coverImage && "sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-end sm:gap-7 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-9",
          )}
        >
          {anime.coverImage && (
            <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-card border border-white/15 bg-surface-raised shadow-[0_24px_55px_-28px_rgb(0_0_0_/_0.9)] sm:w-40 lg:w-48">
              <Image
                src={anime.coverImage}
                alt={`Cover art for ${anime.title}`}
                fill
                priority={!hasBanner}
                sizes="(max-width: 639px) 112px, (max-width: 1023px) 160px, 192px"
                className="object-cover"
              />
            </div>
          )}

          <div className="min-w-0 self-end">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-soft">Anime details</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-4xl lg:text-5xl">
              {anime.title}
            </h1>
            {anime.titles.romaji && anime.titles.romaji !== anime.title && (
              <p className="mt-2 text-sm text-ink-faint sm:text-base">{anime.titles.romaji}</p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {anime.averageScore !== null && (
                <span className="inline-flex min-h-9 items-center rounded-full border border-score/25 bg-score/10 px-3 text-sm font-semibold text-score-ink">
                  {anime.averageScore}% AniList score
                </span>
              )}
              <WatchlistButton anime={anime} />
              {anime.siteUrl && (
                <a
                  href={anime.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
                >
                  View on AniList
                  <ExternalLinkIcon className="size-4" />
                </a>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {anime.genres.map((genre) => <GenreBadge key={genre}>{genre}</GenreBadge>)}
            </div>
          </div>
        </div>

        <div className={cn(anime.coverImage && "sm:ml-[11.75rem] lg:ml-[14.25rem]")}>
          <AnimeDescription description={anime.description} />
        </div>

        {metadata.length > 0 && (
          <dl className="mt-8 grid gap-x-6 gap-y-5 border-t border-line pt-7 sm:grid-cols-2 lg:grid-cols-4">
            {metadata.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-faint">{label}</dt>
                <dd className="mt-1.5 text-sm leading-5 text-ink-muted">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </article>
  );
}
