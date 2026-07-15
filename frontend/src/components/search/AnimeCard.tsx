import Image from "next/image";
import Link from "next/link";

import { GenreBadge } from "@/components/ui/GenreBadge";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import type { Anime } from "@/types/anime";

type AnimeCardProps = {
  anime: Anime;
  imageLoading?: "eager" | "lazy";
};

export function AnimeCard({ anime, imageLoading = "lazy" }: AnimeCardProps) {
  return (
    <article className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm transition-colors hover:border-slate-700">
      <Link href={`/anime/${anime.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400">
        <div className="relative aspect-[2/3] bg-slate-800">
          {anime.coverImage ? (
            <Image src={anime.coverImage} alt={`Cover art for ${anime.title}`} fill loading={imageLoading} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" className="object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">No cover image available</div>
          )}
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold text-white">
            <Link href={`/anime/${anime.id}`} className="hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
              {anime.title}
            </Link>
          </h3>
          <WatchlistButton anime={anime} compact />
        </div>
        <p className="text-sm text-slate-400">
          {anime.averageScore ? `AniList score: ${anime.averageScore}%` : "No AniList score"}
          {anime.format ? ` · ${anime.format}` : ""}
          {anime.seasonYear ? ` · ${anime.seasonYear}` : ""}
        </p>
        <div className="flex min-h-5 flex-wrap gap-1.5">
          {anime.genres.slice(0, 3).map((genre) => <GenreBadge key={genre}>{genre}</GenreBadge>)}
        </div>
      </div>
    </article>
  );
}
