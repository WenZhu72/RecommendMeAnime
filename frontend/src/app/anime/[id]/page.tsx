import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AnimeDescription } from "@/components/anime/AnimeDescription";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { GenreBadge } from "@/components/ui/GenreBadge";
import { getAnimeById } from "@/lib/api/anime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Anime details", description: "View anime details, related titles, and recommendations." };

type AnimeDetailsPageProps = { params: Promise<{ id: string }> };

function animeIdFromParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const animeId = Number(value);
  return Number.isSafeInteger(animeId) && animeId > 0 ? animeId : null;
}

function formatDate(date: { year: number | null; month: number | null; day: number | null } | null): string | null {
  if (!date?.year) return null;
  return [date.year, date.month, date.day].filter(Boolean).join("-");
}

export default async function AnimeDetailsPage({ params }: AnimeDetailsPageProps) {
  const { id } = await params;
  const animeId = animeIdFromParam(id);
  if (animeId === null) notFound();

  const anime = await getAnimeById(animeId);
  if (anime === null) notFound();

  const metadata = [
    ["Format", anime.format],
    ["Status", anime.status],
    ["Episodes", anime.episodes?.toString() ?? null],
    ["Duration", anime.duration ? `${anime.duration} min per episode` : null],
    ["Started", formatDate(anime.startDate)],
    ["Studios", anime.studios.join(", ") || null],
  ].filter(([, value]) => value) as [string, string][];

  return (
    <Container className="py-10 sm:py-14">
      <Link href="/browse" className="text-sm font-semibold text-indigo-300 hover:text-indigo-200">Back to browse</Link>
      <article className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        {anime.bannerImage && <div className="relative h-44 bg-slate-800 sm:h-64"><Image src={anime.bannerImage} alt="" fill loading="eager" sizes="100vw" className="object-cover opacity-50" /></div>}
        <div className={`p-6 sm:p-8 ${anime.bannerImage ? "sm:-mt-24 sm:relative" : ""}`}>
          <div className="flex flex-col gap-6 sm:flex-row">
            {anime.coverImage && <div className="relative mx-auto aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl bg-slate-800 shadow-xl sm:mx-0"><Image src={anime.coverImage} alt={`Cover art for ${anime.title}`} fill loading={anime.bannerImage ? "lazy" : "eager"} sizes="160px" className="object-cover" /></div>}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-300">Anime</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">{anime.title}</h1>
              {anime.titles.romaji && anime.titles.romaji !== anime.title && <p className="mt-2 text-slate-400">{anime.titles.romaji}</p>}
              {anime.averageScore && <p className="mt-4 font-semibold text-amber-300">AniList score: {anime.averageScore}%</p>}
              <div className="mt-4 flex flex-wrap gap-2">{anime.genres.map((genre) => <GenreBadge key={genre}>{genre}</GenreBadge>)}</div>
              <AnimeDescription description={anime.description} />
            </div>
          </div>
          {metadata.length > 0 && <dl className="mt-8 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2 lg:grid-cols-3">{metadata.map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 text-sm text-slate-200">{value}</dd></div>)}</dl>}
        </div>
      </article>
      {anime.relations.length > 0 && <section className="mt-12"><h2 className="text-2xl font-bold text-white">Related anime</h2><div className="mt-5"><AnimeGrid anime={anime.relations} /></div></section>}
      {anime.recommendations.length > 0 && <section className="mt-12"><h2 className="text-2xl font-bold text-white">More to explore</h2><div className="mt-5"><AnimeGrid anime={anime.recommendations} /></div></section>}
    </Container>
  );
}
