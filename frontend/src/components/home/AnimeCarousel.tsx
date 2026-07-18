"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PauseIcon, PlayIcon } from "@/components/ui/Icons";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";

type AnimeCarouselProps = {
  items: Anime[];
  intervalMs?: number;
  label?: string;
};

export function AnimeCarousel({
  items,
  intervalMs = 5000,
  label = "Featured anime",
}: AnimeCarouselProps) {
  const slides = useMemo(() => items.filter((item) => item.coverImage || item.bannerImage), [items]);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeIndex = slides.length ? current % slides.length : 0;
  const next = slides.length ? (activeIndex + 1) % slides.length : 0;
  const autoplayPaused = interactionPaused || manuallyPaused || !tabVisible || reducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    function updateVisibility() {
      setTabVisible(document.visibilityState === "visible");
    }
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || autoplayPaused) return;
    const interval = window.setInterval(() => {
      setCurrent((index) => (index + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [autoplayPaused, intervalMs, slides.length]);

  useEffect(() => {
    [activeIndex, next].forEach((index) => {
      const source = slides[index]?.bannerImage ?? slides[index]?.coverImage;
      if (source) {
        const image = new window.Image();
        image.src = source;
      }
    });
  }, [activeIndex, next, slides]);

  if (!slides.length) {
    return (
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-panel border border-line bg-surface shadow-panel lg:aspect-[4/5]"
        role="status"
        aria-label="Loading featured anime"
      >
        <div className="absolute inset-0 animate-pulse-soft bg-surface-raised" />
        <div className="absolute inset-x-5 bottom-5 space-y-3">
          <div className="h-3 w-20 rounded bg-ink/10" />
          <div className="h-6 w-4/5 rounded bg-ink/10" />
        </div>
      </div>
    );
  }

  return (
    <section
      className="group relative aspect-[4/3] overflow-hidden rounded-panel border border-line bg-surface shadow-panel lg:aspect-[4/5]"
      aria-label={label}
      aria-roledescription="carousel"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
      }}
    >
      <div aria-live={autoplayPaused ? "polite" : "off"}>
        {slides.map((anime, index) => {
          const image = anime.bannerImage ?? anime.coverImage;
          const active = index === activeIndex;
          const eager = active || index === next;
          return (
            <article
              key={anime.id}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-[opacity,transform] duration-700 ease-product",
                active ? "z-10 scale-100 opacity-100" : "pointer-events-none scale-[1.015] opacity-0",
              )}
            >
              {image && (
                <Image
                  src={image}
                  alt=""
                  fill
                  priority={active}
                  loading={active ? undefined : eager ? "eager" : "lazy"}
                  sizes="(max-width: 1023px) 100vw, 34rem"
                  onLoad={() => setLoaded((currentLoaded) => new Set(currentLoaded).add(anime.id))}
                  className={cn(
                    "object-cover transition-[opacity,transform] duration-700 ease-product",
                    anime.bannerImage ? "object-center" : "object-[center_28%]",
                    loaded.has(anime.id) ? "opacity-100" : "opacity-0",
                    active && "group-hover:scale-[1.015]",
                  )}
                />
              )}
              {!loaded.has(anime.id) && <div className="absolute inset-0 animate-pulse-soft bg-surface-raised" />}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(3,4,9,0.96)_0%,rgba(3,4,9,0.62)_32%,rgba(3,4,9,0.06)_72%)]" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.17em] text-white/65">
                  Trending now
                </p>
                <h2 className="mt-2 max-w-md text-xl font-semibold leading-tight tracking-[-0.035em] sm:text-2xl">
                  <Link
                    href={`/anime/${anime.id}`}
                    tabIndex={active ? undefined : -1}
                    className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {anime.title}
                  </Link>
                </h2>
                <p className="mt-2 text-xs text-white/65">
                  {[anime.format?.replaceAll("_", " "), anime.seasonYear, anime.averageScore ? `${anime.averageScore}% score` : null]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between gap-4 sm:inset-x-7 sm:top-7">
          <div className="flex items-center gap-1.5" aria-label={`Slide ${activeIndex + 1} of ${slides.length}`}>
            {slides.map((anime, index) => (
              <button
                key={anime.id}
                type="button"
                onClick={() => setCurrent(index)}
                aria-label={`Show ${anime.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full bg-white/45 transition-[width,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  index === activeIndex ? "w-6 bg-white" : "w-1.5 hover:bg-white/75",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setManuallyPaused((paused) => !paused)}
            aria-label={manuallyPaused ? "Resume carousel" : "Pause carousel"}
            className="inline-flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-sm transition-colors hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {manuallyPaused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-4" />}
          </button>
        </div>
      )}
    </section>
  );
}
