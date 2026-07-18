import { AnimeCarousel } from "@/components/home/AnimeCarousel";
import { SearchBar } from "@/components/search/SearchBar";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";
import type { Anime } from "@/types/anime";

export function Hero({ featured }: { featured: Anime[] }) {
  return (
    <section className="border-b border-line/70">
      <div className="mx-auto grid w-full max-w-content items-center gap-10 px-5 py-12 sm:px-7 sm:py-16 lg:min-h-[40rem] lg:grid-cols-[minmax(0,1fr)_minmax(20rem,31rem)] lg:gap-14 lg:px-10 lg:py-20">
        <div className="max-w-3xl animate-enter">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-soft">
            A considered way to discover anime
          </p>
          <h1 className="mt-5 max-w-3xl text-[2.65rem] font-semibold leading-[1.03] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.25rem]">
            Find the story you want to stay with.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-ink-muted sm:text-lg sm:leading-8">
            Search the AniList catalogue, browse with useful filters, or shape a shortlist around the way you watch.
          </p>

          <SearchBar className="mt-8 max-w-2xl" />

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/recommend" size="lg">
              Get recommendations
              <ArrowRightIcon className="size-4" />
            </ButtonLink>
            <ButtonLink href="/browse" variant="secondary" size="lg">
              Browse the catalogue
            </ButtonLink>
          </div>
        </div>

        <div className="animate-enter" style={{ animationDelay: "100ms" }}>
          <AnimeCarousel items={featured} label="Trending anime" />
        </div>
      </div>
    </section>
  );
}
