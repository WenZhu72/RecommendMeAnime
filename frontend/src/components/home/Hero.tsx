import type { ReactNode } from "react";

import { HeroSearch } from "@/components/home/HeroSearch";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";

export function Hero({ recommendations }: { recommendations: ReactNode }) {
  return (
    <section className="home-hero relative isolate overflow-clip border-b border-line/45">
      <div aria-hidden="true" className="pointer-events-none absolute left-[44%] top-1/2 -z-10 size-[32rem] -translate-y-1/2 rounded-full bg-brand/[0.07] blur-[110px]" />
      <div className="mx-auto grid w-full max-w-content items-center gap-14 px-5 pb-16 pt-12 sm:px-7 sm:pb-20 sm:pt-16 lg:min-h-[44rem] lg:grid-cols-[minmax(0,1.04fr)_minmax(28rem,0.96fr)] lg:gap-12 lg:px-10 lg:py-16 xl:gap-20">
        <div className="relative z-10 max-w-[42rem] animate-enter">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-soft">
            Recommendations, made personal
          </p>
          <h1 className="mt-5 text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.06em] text-ink sm:text-[3.75rem] lg:text-[4rem] xl:text-[4.5rem]">
            Your next <span className="bg-gradient-to-r from-brand-soft via-brand to-violet-400 bg-clip-text text-transparent">favourite</span>
            <br />
            <span className="bg-gradient-to-r from-brand-soft via-brand to-violet-400 bg-clip-text text-transparent">anime</span> is out there.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink-muted sm:text-lg">
            Search AniList or discover shows selected around your taste.
          </p>

          <HeroSearch className="mt-8 max-w-[38rem]" />

          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/recommend" size="lg" className="min-h-12 rounded-xl px-5 hover:-translate-y-0.5">
              Get recommendations
              <ArrowRightIcon className="size-4" />
            </ButtonLink>
            <ButtonLink href="/browse" variant="secondary" size="lg" className="min-h-12 rounded-xl px-5 hover:-translate-y-0.5">
              Browse catalogue
            </ButtonLink>
          </div>
        </div>

        <div className="min-w-0 animate-enter" style={{ animationDelay: "120ms" }}>
          {recommendations}
        </div>
      </div>
    </section>
  );
}
