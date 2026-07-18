import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnimeDetailHero } from "@/components/anime/AnimeDetailHero";
import { Container } from "@/components/layout/Container";
import { AnimeGrid } from "@/components/search/AnimeGrid";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getAnimeById } from "@/lib/api/anime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Anime details",
  description: "View anime details, related titles, and recommendations.",
};

type AnimeDetailsPageProps = { params: Promise<{ id: string }> };

function animeIdFromParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const animeId = Number(value);
  return Number.isSafeInteger(animeId) && animeId > 0 ? animeId : null;
}

function formatDate(date: { year: number | null; month: number | null; day: number | null } | null): string | null {
  if (!date?.year) return null;
  return [date.year, date.month, date.day]
    .filter(Boolean)
    .map((part, index) => (index > 0 ? String(part).padStart(2, "0") : part))
    .join("-");
}

function readableValue(value: string | null): string | null {
  return value?.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? null;
}

export default async function AnimeDetailsPage({ params }: AnimeDetailsPageProps) {
  const { id } = await params;
  const animeId = animeIdFromParam(id);
  if (animeId === null) notFound();

  const anime = await getAnimeById(animeId);
  if (anime === null) notFound();

  const metadata = [
    ["Format", readableValue(anime.format)],
    ["Status", readableValue(anime.status)],
    ["Episodes", anime.episodes?.toString() ?? null],
    ["Duration", anime.duration ? `${anime.duration} min per episode` : null],
    ["Started", formatDate(anime.startDate)],
    ["Season", [readableValue(anime.season), anime.seasonYear].filter(Boolean).join(" ") || null],
    ["Studios", anime.studios.join(", ") || null],
    ["Source", readableValue(anime.source)],
  ].filter(([, value]) => value) as [string, string][];

  return (
    <Container className="py-7 sm:py-10">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
      >
        <ArrowLeftIcon className="size-4" />
        Back to browse
      </Link>

      <div className="mt-5">
        <AnimeDetailHero anime={anime} metadata={metadata} />
      </div>

      {anime.relations.length > 0 && (
        <section className="mt-14 sm:mt-18">
          <SectionHeader title="Related anime" description="Sequels, adaptations, and connected stories." />
          <AnimeGrid anime={anime.relations} />
        </section>
      )}
      {anime.recommendations.length > 0 && (
        <section className="mt-14 sm:mt-18">
          <SectionHeader title="More to explore" description="Titles recommended by the AniList community." />
          <AnimeGrid anime={anime.recommendations} />
        </section>
      )}
    </Container>
  );
}
