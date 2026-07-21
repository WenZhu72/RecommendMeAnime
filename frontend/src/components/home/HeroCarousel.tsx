"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { HeroRecommendationCard } from "@/components/home/HeroRecommendationCard";
import { useHeroCarouselInteraction } from "@/components/home/useHeroCarouselInteraction";
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from "@/components/ui/Icons";
import { getRecommendations } from "@/lib/api/recommendations";
import {
  getHeroRecommendationReason,
  selectPersonalizedHeroAnime,
} from "@/lib/hero-recommendations";
import {
  getVirtualCarouselSlides,
  getVisualIndicatorIndex,
  wrapCarouselIndex,
} from "@/lib/hero-carousel-logic";
import { getSavedRecommendationPreferences } from "@/lib/recommendation-storage";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

const DEFAULT_AUTOPLAY_INTERVAL_MS = 6000;
const MAX_MOMENTUM_STEPS = 5;
const RENDER_RADIUS = MAX_MOMENTUM_STEPS + 1;
const IMAGE_PRELOAD_STAGGER_MS = 110;

type HeroCarouselProps = {
  fallbackItems: Anime[];
  intervalMs?: number;
};

type NavigationDirection = -1 | 1;

export function HeroCarousel({
  fallbackItems,
  intervalMs = DEFAULT_AUTOPLAY_INTERVAL_MS,
}: HeroCarouselProps) {
  const [items, setItems] = useState(fallbackItems);
  const [preferences, setPreferences] = useState<RecommendationPreferences | null>(null);
  const [current, setCurrent] = useState(0);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [autoplayEpoch, setAutoplayEpoch] = useState(0);
  const preloadedImagesRef = useRef(new Map<string, HTMLImageElement>());

  const activeIndex = items.length ? wrapCarouselIndex(current, items.length) : 0;
  const reasons = useMemo(
    () => new Map(items.map((anime) => [anime.id, getHeroRecommendationReason(anime, preferences)])),
    [items, preferences],
  );
  const visibleSlides = useMemo(
    () => getVirtualCarouselSlides(items, activeIndex, RENDER_RADIUS),
    [activeIndex, items],
  );
  const renderedRelativeIndices = useMemo(
    () => visibleSlides.map(({ relativeIndex }) => relativeIndex),
    [visibleSlides],
  );

  const commitDragSteps = useCallback((steps: number) => {
    if (steps === 0 || items.length < 2) return;
    setCurrent((index) => wrapCarouselIndex(index + steps, items.length));
    setAutoplayEpoch((epoch) => epoch + 1);
  }, [items.length]);

  const {
    stageRef,
    phase,
    visualActiveRelative,
    isIdle,
    reset: resetInteraction,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onClickCapture,
  } = useHeroCarouselInteraction({
    itemCount: items.length,
    reducedMotion,
    renderedRelativeIndices,
    onCommitSteps: commitDragSteps,
  });

  const autoplayPaused = interactionPaused
    || manuallyPaused
    || !tabVisible
    || reducedMotion
    || phase !== "idle";
  const sourceLabel = preferences ? "Picked for you" : "Highly rated by the community";
  const indicatorIndex = getVisualIndicatorIndex(
    activeIndex,
    visualActiveRelative,
    items.length,
    phase,
  );

  const navigateBy = useCallback((direction: NavigationDirection) => {
    if (items.length < 2 || phase !== "idle") return;
    setCurrent((index) => wrapCarouselIndex(index + direction, items.length));
    setAutoplayEpoch((epoch) => epoch + 1);
  }, [items.length, phase]);

  const selectIndex = useCallback((index: number) => {
    if (!items.length || !isIdle()) return;
    setCurrent(wrapCarouselIndex(index, items.length));
    setAutoplayEpoch((epoch) => epoch + 1);
  }, [isIdle, items.length]);

  useEffect(() => {
    let cancelled = false;
    const saved = getSavedRecommendationPreferences();
    if (!saved) return;

    void getRecommendations(saved)
      .then((recommendations) => {
        if (cancelled) return;
        const personalized = selectPersonalizedHeroAnime(recommendations);
        if (!personalized.length) return;
        resetInteraction();
        setPreferences(saved);
        setItems(personalized);
        setCurrent(0);
      })
      .catch(() => {
        // The curated fallback remains visible without being labelled personalized.
      });

    return () => { cancelled = true; };
  }, [resetInteraction]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setTabVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (items.length < 2 || autoplayPaused) return;
    const interval = window.setInterval(() => {
      setCurrent((index) => wrapCarouselIndex(index + 1, items.length));
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [autoplayEpoch, autoplayPaused, intervalMs, items.length]);

  useEffect(() => {
    const timers: number[] = [];

    visibleSlides.forEach(({ anime, relativeIndex }) => {
      const source = anime.coverImage;
      if (!source || preloadedImagesRef.current.has(source)) return;

      const delay = Math.max(0, Math.abs(relativeIndex) - 1) * IMAGE_PRELOAD_STAGGER_MS;
      timers.push(window.setTimeout(() => {
        if (preloadedImagesRef.current.has(source)) return;
        const image = new window.Image();
        image.decoding = "async";
        image.loading = "eager";
        image.src = source;
        preloadedImagesRef.current.set(source, image);
        void image.decode().catch(() => {
          // The mounted Next image remains the fallback if eager decoding is unavailable.
        });
      }, delay));
    });

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [visibleSlides]);

  if (!items.length) {
    return (
      <div className="mx-auto w-full max-w-[35rem]" role="status" aria-label="Loading recommendations">
        <div className="mb-4 h-3 w-44 animate-pulse-soft rounded-full bg-ink/10" />
        <div className="mx-auto aspect-[2/3] w-[min(70vw,19rem)] animate-pulse-soft rounded-[1.6rem] border border-line bg-surface-raised shadow-panel" />
      </div>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-[35rem]"
      aria-label="Anime recommendations"
      aria-roledescription="carousel"
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        const nextFocused = event.relatedTarget;
        if (!(nextFocused instanceof Node) || !event.currentTarget.contains(nextFocused)) {
          setInteractionPaused(false);
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted" aria-live="polite">
          <span className="size-1.5 rounded-full bg-brand shadow-[0_0_14px_2px_rgb(139_92_246_/_0.55)]" />
          {sourceLabel}
        </p>
        <p className="text-xs tabular-nums text-ink-faint">
          {String(activeIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
        </p>
      </div>

      <div
        ref={stageRef}
        className="hero-recommendation-stage relative left-1/2 mt-4 h-[29.5rem] w-[min(100vw,42rem)] sm:h-[31.5rem] lg:h-[32.5rem]"
        data-dragging={phase === "dragging"}
        data-settling={phase === "settling"}
        aria-live="off"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        onClickCapture={onClickCapture}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="hero-recommendation-viewport absolute inset-0">
          {visibleSlides.map(({ anime, index, relativeIndex }) => (
            <HeroRecommendationCard
              key={anime.id}
              anime={anime}
              relativeIndex={relativeIndex}
              visuallyActive={relativeIndex === visualActiveRelative}
              reason={reasons.get(anime.id) ?? "Selected for discovery."}
              priority={Math.abs(relativeIndex) <= 1}
              onSelect={() => selectIndex(index)}
            />
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div className="mt-1 flex items-center justify-between gap-4 px-1">
          <div className="flex h-4 w-32 items-center gap-1 sm:w-40" aria-label={`Slide ${indicatorIndex + 1} of ${items.length}`}>
            {items.map((anime, index) => (
              <button
                key={anime.id}
                type="button"
                onClick={() => selectIndex(index)}
                aria-label={`Show ${anime.title}`}
                aria-current={index === indicatorIndex ? "true" : undefined}
                className={cn(
                  "h-1 min-w-0 flex-1 rounded-full bg-ink/15 transition-[flex-grow,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                  index === indicatorIndex ? "flex-[3] bg-brand" : "hover:bg-ink/35",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigateBy(-1)}
              aria-label="Previous recommendation"
              className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface/65 text-ink-muted backdrop-blur-md transition-[transform,color,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
            >
              <ArrowLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setManuallyPaused((paused) => !paused);
                setAutoplayEpoch((epoch) => epoch + 1);
              }}
              aria-label={manuallyPaused ? "Resume carousel" : "Pause carousel"}
              className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface/65 text-ink-muted backdrop-blur-md transition-[transform,color,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
            >
              {manuallyPaused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigateBy(1)}
              aria-label="Next recommendation"
              className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-surface/65 text-ink-muted backdrop-blur-md transition-[transform,color,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft"
            >
              <ArrowRightIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
