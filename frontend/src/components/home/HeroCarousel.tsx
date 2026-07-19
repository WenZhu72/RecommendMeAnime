"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import { HeroRecommendationCard } from "@/components/home/HeroRecommendationCard";
import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from "@/components/ui/Icons";
import { getRecommendations } from "@/lib/api/recommendations";
import {
  getHeroRecommendationReason,
  selectPersonalizedHeroAnime,
} from "@/lib/hero-recommendations";
import { getSavedRecommendationPreferences } from "@/lib/recommendation-storage";
import { cn } from "@/lib/utils";
import type { Anime } from "@/types/anime";
import type { RecommendationPreferences } from "@/types/recommendation";

const DEFAULT_AUTOPLAY_INTERVAL_MS = 6000;

// Gesture tuning: progress is measured in neighbour-to-neighbour card positions.
const DIRECTION_LOCK_DISTANCE_PX = 7;
const DIRECTION_DOMINANCE_RATIO = 1.15;
const CLICK_SUPPRESSION_DISTANCE_PX = 7;
const MOMENTUM_PROJECTION_SECONDS = 0.18;
const VELOCITY_STALE_AFTER_MS = 90;
const MAX_DRAG_STEPS = 4;
const MAX_MOMENTUM_STEPS = 5;
// One extra neighbour remains beyond the furthest possible momentum target.
const RENDER_RADIUS = MAX_MOMENTUM_STEPS + 1;

// Side cards rest 62% of one card width from centre; the stage ratio is a safe fallback.
const CARD_CENTRE_OFFSET_RATIO = 0.62;
const NEIGHBOUR_CENTRE_DISTANCE_RATIO = 0.38;

// Damped spring values use seconds, normalised card progress, and progress per second.
const SPRING_STIFFNESS = 320;
const SPRING_DAMPING = 34;
const SPRING_REST_DISPLACEMENT = 0.0015;
const SPRING_REST_SPEED_PER_SECOND = 0.02;
const MAX_PROJECTED_VELOCITY_PER_SECOND = 14;
const MAX_SPRING_VELOCITY_PER_SECOND = 8;
const IMAGE_PRELOAD_STAGGER_MS = 110;

type HeroCarouselProps = {
  fallbackItems: Anime[];
  intervalMs?: number;
};

type GestureAxis = "pending" | "horizontal" | "vertical";
type GesturePhase = "idle" | "dragging" | "settling";
type NavigationDirection = -1 | 1;

type DragSession = {
  pointerId: number | null;
  captureTarget: HTMLDivElement | null;
  axis: GestureAxis;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  offset: number;
  velocity: number;
};

type VisibleSlide = {
  anime: Anime;
  index: number;
  relativeIndex: number;
};

type ProgressBounds = {
  dragMinimum: number;
  dragMaximum: number;
  momentumMinimum: number;
  momentumMaximum: number;
};

const EMPTY_DRAG_SESSION: DragSession = {
  pointerId: null,
  captureTarget: null,
  axis: "pending",
  startX: 0,
  startY: 0,
  lastX: 0,
  lastTime: 0,
  offset: 0,
  velocity: 0,
};

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getVisibleSlides(items: Anime[], activeIndex: number): VisibleSlide[] {
  if (!items.length) return [];

  const seenAnimeIds = new Set<number>();
  const candidates = [0];
  for (let distance = 1; distance <= RENDER_RADIUS; distance += 1) {
    candidates.push(distance, -distance);
  }

  return candidates
    .flatMap((relativeIndex) => {
      const index = wrapIndex(activeIndex + relativeIndex, items.length);
      const anime = items[index];
      if (!anime || seenAnimeIds.has(anime.id)) return [];
      seenAnimeIds.add(anime.id);
      return [{ anime, index, relativeIndex }];
    })
    .sort((left, right) => left.relativeIndex - right.relativeIndex);
}

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
  const [gesturePhase, setGesturePhaseState] = useState<GesturePhase>("idle");
  const [visualActiveRelative, setVisualActiveRelative] = useState(0);
  const [autoplayEpoch, setAutoplayEpoch] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const gesturePhaseRef = useRef<GesturePhase>("idle");
  const dragSessionRef = useRef<DragSession>({ ...EMPTY_DRAG_SESSION });
  const dragProgressRef = useRef(0);
  const pendingDragProgressRef = useRef(0);
  const transitionDistanceRef = useRef(1);
  const itemCountRef = useRef(items.length);
  const progressBoundsRef = useRef<ProgressBounds>({
    dragMinimum: -MAX_DRAG_STEPS,
    dragMaximum: MAX_DRAG_STEPS,
    momentumMinimum: -MAX_MOMENTUM_STEPS,
    momentumMaximum: MAX_MOMENTUM_STEPS,
  });
  const dragFrameRef = useRef<number | null>(null);
  const springFrameRef = useRef<number | null>(null);
  const visualActiveRelativeRef = useRef(0);
  const preloadedImagesRef = useRef(new Map<string, HTMLImageElement>());
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);

  const activeIndex = items.length ? wrapIndex(current, items.length) : 0;
  const autoplayPaused = interactionPaused
    || manuallyPaused
    || !tabVisible
    || reducedMotion
    || gesturePhase !== "idle";
  const sourceLabel = preferences ? "Picked for you" : "Highly rated by the community";

  const setGesturePhase = useCallback((phase: GesturePhase) => {
    gesturePhaseRef.current = phase;
    setGesturePhaseState(phase);
  }, []);

  const measureTransitionDistance = useCallback(() => {
    const stage = stageRef.current;
    const stageWidth = stage?.clientWidth ?? 0;
    const activeSlide = stage?.querySelector<HTMLElement>('[data-relative-index="0"]');
    const measuredCardDistance = (activeSlide?.offsetWidth ?? 0) * CARD_CENTRE_OFFSET_RATIO;
    const transitionDistance = Math.max(
      measuredCardDistance || (stageWidth * NEIGHBOUR_CENTRE_DISTANCE_RATIO),
      1,
    );
    transitionDistanceRef.current = transitionDistance;
    stage?.style.setProperty("--hero-transition-distance", `${transitionDistance}px`);
    return transitionDistance;
  }, []);

  const applyDragProgress = useCallback((progress: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    dragProgressRef.current = progress;
    stage.style.setProperty("--hero-drag-progress", String(progress));

    const transitionDistance = transitionDistanceRef.current;
    const isLightTheme = document.documentElement.classList.contains("light");
    const slides = stage.querySelectorAll<HTMLElement>(".hero-recommendation-slide");
    let nearestRelativeIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide) => {
      const relativeIndex = Number(slide.dataset.relativeIndex ?? 0);
      // With two unique items, the single neighbour changes sides with the gesture.
      // This preserves infinite movement without mounting the same anime twice.
      const effectiveRelativeIndex = itemCountRef.current === 2 && relativeIndex !== 0
        ? (progress > 0 ? -1 : 1)
        : relativeIndex;
      const cardProgress = effectiveRelativeIndex + progress;
      const distanceFromCentre = Math.abs(cardProgress);
      const sideProgress = Math.min(distanceFromCentre, 1);
      const overflowProgress = Math.max(distanceFromCentre - 1, 0);
      const translateX = cardProgress * transitionDistance;
      const translateY = (17.6 * sideProgress) + (7 * overflowProgress);
      const translateZ = (-80 * sideProgress) - (36 * overflowProgress);
      const rotation = clamp(-cardProgress * 8, -12, 12);
      const scale = clamp(1 - (0.16 * sideProgress) - (0.06 * overflowProgress), 0.72, 1);
      const opacity = clamp(1 - (0.48 * sideProgress) - (0.3 * overflowProgress), 0.08, 1);
      const saturation = clamp(1 - (0.3 * sideProgress) - (0.1 * overflowProgress), 0.55, 1);
      const sideBrightness = isLightTheme ? 0.88 : 0.72;
      const brightness = clamp(
        1 - ((1 - sideBrightness) * sideProgress) - (0.08 * overflowProgress),
        0.52,
        1,
      );

      slide.style.setProperty("--hero-card-x", `${translateX}px`);
      slide.style.setProperty("--hero-card-y", `${translateY}px`);
      slide.style.setProperty("--hero-card-z", `${translateZ}px`);
      slide.style.setProperty("--hero-card-rotation", `${rotation}deg`);
      slide.style.setProperty("--hero-card-scale", String(scale));
      slide.style.setProperty("--hero-card-opacity", String(opacity));
      slide.style.setProperty("--hero-card-saturation", String(saturation));
      slide.style.setProperty("--hero-card-brightness", String(brightness));
      slide.style.setProperty("--hero-card-z-index", String(Math.max(1, 30 - Math.round(distanceFromCentre * 10))));

      if (distanceFromCentre < nearestDistance) {
        nearestDistance = distanceFromCentre;
        nearestRelativeIndex = relativeIndex;
      }
    });

    if (visualActiveRelativeRef.current !== nearestRelativeIndex) {
      visualActiveRelativeRef.current = nearestRelativeIndex;
      setVisualActiveRelative(nearestRelativeIndex);
    }
  }, []);

  const cancelDragFrame = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
  }, []);

  const cancelSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      window.cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
  }, []);

  const scheduleDragProgress = useCallback((progress: number) => {
    pendingDragProgressRef.current = progress;
    if (dragFrameRef.current !== null) return;

    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applyDragProgress(pendingDragProgressRef.current);
    });
  }, [applyDragProgress]);

  const releasePointerCapture = useCallback(() => {
    const session = dragSessionRef.current;
    const pointerId = session.pointerId;
    const captureTarget = session.captureTarget;
    session.pointerId = null;
    session.captureTarget = null;
    if (pointerId === null || !captureTarget) return;
    try {
      if (captureTarget.hasPointerCapture(pointerId)) {
        captureTarget.releasePointerCapture(pointerId);
      }
    } catch {
      // The browser may already have released capture after pointer cancellation.
    }
  }, []);

  const clearDragSession = useCallback(() => {
    dragSessionRef.current = { ...EMPTY_DRAG_SESSION };
  }, []);

  const resetClickSuppressionSoon = useCallback(() => {
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
    }
    suppressClickTimeoutRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimeoutRef.current = null;
    }, 180);
  }, []);

  const abortGesture = useCallback((updateState = true) => {
    cancelDragFrame();
    cancelSpring();
    releasePointerCapture();
    clearDragSession();
    pendingDragProgressRef.current = 0;
    applyDragProgress(0);
    gesturePhaseRef.current = "idle";
    if (updateState) setGesturePhaseState("idle");
  }, [applyDragProgress, cancelDragFrame, cancelSpring, clearDragSession, releasePointerCapture]);

  const runSpring = useCallback((
    target: number,
    initialVelocity: number,
    onComplete: () => void,
  ) => {
    cancelSpring();
    let position = dragProgressRef.current;
    let velocity = clamp(
      initialVelocity,
      -MAX_SPRING_VELOCITY_PER_SECOND,
      MAX_SPRING_VELOCITY_PER_SECOND,
    );
    let previousTime = window.performance.now();

    const step = (time: number) => {
      const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const displacement = position - target;
      const acceleration = (-SPRING_STIFFNESS * displacement) - (SPRING_DAMPING * velocity);
      velocity += acceleration * elapsedSeconds;
      position += velocity * elapsedSeconds;
      applyDragProgress(position);

      const atRest = Math.abs(position - target) <= SPRING_REST_DISPLACEMENT
        && Math.abs(velocity) <= SPRING_REST_SPEED_PER_SECOND;
      if (atRest) {
        springFrameRef.current = null;
        applyDragProgress(target);
        onComplete();
        return;
      }
      springFrameRef.current = window.requestAnimationFrame(step);
    };

    springFrameRef.current = window.requestAnimationFrame(step);
  }, [applyDragProgress, cancelSpring]);

  const finishSettlement = useCallback((targetProgress: number) => {
    const completedSteps = -targetProgress;
    clearDragSession();
    dragProgressRef.current = 0;
    pendingDragProgressRef.current = 0;
    visualActiveRelativeRef.current = 0;
    gesturePhaseRef.current = "idle";
    flushSync(() => {
      if (completedSteps !== 0 && items.length > 1) {
        setCurrent((index) => wrapIndex(index + completedSteps, items.length));
      }
      setVisualActiveRelative(0);
      setGesturePhaseState("idle");
      setAutoplayEpoch((epoch) => epoch + 1);
    });
    applyDragProgress(0);
  }, [applyDragProgress, clearDragSession, items.length]);

  const settleGesture = useCallback((
    targetProgress: number,
    velocityProgressPerSecond: number,
  ) => {
    setGesturePhase("settling");
    if (reducedMotion) {
      finishSettlement(targetProgress);
      return;
    }

    runSpring(
      targetProgress,
      velocityProgressPerSecond,
      () => finishSettlement(targetProgress),
    );
  }, [finishSettlement, reducedMotion, runSpring, setGesturePhase]);

  const navigateBy = useCallback((direction: NavigationDirection) => {
    if (items.length < 2 || gesturePhaseRef.current !== "idle") return;
    setCurrent((index) => wrapIndex(index + direction, items.length));
    setAutoplayEpoch((epoch) => epoch + 1);
  }, [items.length]);

  const selectIndex = useCallback((index: number) => {
    if (!items.length || gesturePhaseRef.current !== "idle") return;
    setCurrent(wrapIndex(index, items.length));
    setAutoplayEpoch((epoch) => epoch + 1);
  }, [items.length]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      items.length < 2
      || gesturePhaseRef.current !== "idle"
      || !event.isPrimary
      || (event.pointerType === "mouse" && event.button !== 0)
    ) return;

    cancelSpring();
    suppressClickRef.current = false;
    const stage = event.currentTarget;
    measureTransitionDistance();
    applyDragProgress(0);

    dragSessionRef.current = {
      pointerId: event.pointerId,
      captureTarget: stage,
      axis: "pending",
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      offset: 0,
      velocity: 0,
    };
    try {
      stage.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort on older embedded browsers.
    }
    setGesturePhase("dragging");
  }, [applyDragProgress, cancelSpring, items.length, measureTransitionDistance, setGesturePhase]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const session = dragSessionRef.current;
    if (session.pointerId !== event.pointerId || gesturePhaseRef.current !== "dragging") return;

    const rawOffset = event.clientX - session.startX;
    const verticalOffset = event.clientY - session.startY;
    const horizontalDistance = Math.abs(rawOffset);
    const verticalDistance = Math.abs(verticalOffset);

    if (Math.max(horizontalDistance, verticalDistance) > CLICK_SUPPRESSION_DISTANCE_PX) {
      suppressClickRef.current = true;
    }

    if (session.axis === "pending") {
      if (Math.max(horizontalDistance, verticalDistance) < DIRECTION_LOCK_DISTANCE_PX) return;
      if (verticalDistance > horizontalDistance * DIRECTION_DOMINANCE_RATIO) {
        session.axis = "vertical";
        releasePointerCapture();
        clearDragSession();
        applyDragProgress(0);
        setGesturePhase("idle");
        resetClickSuppressionSoon();
        return;
      }
      session.axis = "horizontal";
    }

    if (session.axis !== "horizontal") return;
    event.preventDefault();
    const transitionDistance = transitionDistanceRef.current;
    const bounds = progressBoundsRef.current;
    const offset = clamp(
      rawOffset,
      bounds.dragMinimum * transitionDistance,
      bounds.dragMaximum * transitionDistance,
    );
    const elapsed = event.timeStamp - session.lastTime;
    if (elapsed > 0) {
      const instantVelocity = (event.clientX - session.lastX) / elapsed;
      session.velocity = (session.velocity * 0.35) + (instantVelocity * 0.65);
    }
    session.lastX = event.clientX;
    session.lastTime = event.timeStamp;
    session.offset = offset;
    scheduleDragProgress(offset / transitionDistance);
  }, [
    applyDragProgress,
    clearDragSession,
    releasePointerCapture,
    resetClickSuppressionSoon,
    scheduleDragProgress,
    setGesturePhase,
  ]);

  const resolvePointer = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    cancelled: boolean,
  ) => {
    const session = dragSessionRef.current;
    if (session.pointerId !== event.pointerId || gesturePhaseRef.current !== "dragging") return;

    releasePointerCapture();
    cancelDragFrame();
    const transitionDistance = transitionDistanceRef.current;
    applyDragProgress(session.offset / transitionDistance);

    if (session.axis !== "horizontal") {
      clearDragSession();
      applyDragProgress(0);
      setGesturePhase("idle");
      if (suppressClickRef.current) resetClickSuppressionSoon();
      return;
    }

    const timeSinceLastMovement = event.timeStamp - session.lastTime;
    const releaseVelocity = timeSinceLastMovement > VELOCITY_STALE_AFTER_MS
      ? 0
      : session.velocity;
    const currentProgress = session.offset / transitionDistance;
    const rawVelocityProgressPerSecond = (releaseVelocity * 1000) / transitionDistance;
    const velocityProgressPerSecond = clamp(
      rawVelocityProgressPerSecond,
      -MAX_PROJECTED_VELOCITY_PER_SECOND,
      MAX_PROJECTED_VELOCITY_PER_SECOND,
    );
    const projectedProgress = currentProgress
      + (velocityProgressPerSecond * MOMENTUM_PROJECTION_SECONDS);
    const bounds = progressBoundsRef.current;
    const targetProgress = cancelled
      ? 0
      : clamp(
        Math.round(projectedProgress),
        bounds.momentumMinimum,
        bounds.momentumMaximum,
      );

    if (suppressClickRef.current) resetClickSuppressionSoon();
    const initialVelocity = cancelled
      ? 0
      : velocityProgressPerSecond;
    settleGesture(targetProgress, initialVelocity);
  }, [
    applyDragProgress,
    cancelDragFrame,
    clearDragSession,
    releasePointerCapture,
    resetClickSuppressionSoon,
    setGesturePhase,
    settleGesture,
  ]);

  const handleClickCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
      suppressClickTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const saved = getSavedRecommendationPreferences();
    if (!saved) return;

    void getRecommendations(saved)
      .then((recommendations) => {
        if (cancelled) return;
        const personalized = selectPersonalizedHeroAnime(recommendations);
        if (!personalized.length) return;
        abortGesture();
        setPreferences(saved);
        setItems(personalized);
        setCurrent(0);
        setAutoplayEpoch((epoch) => epoch + 1);
      })
      .catch(() => {
        // The curated fallback remains visible without being labelled personalized.
      });

    return () => { cancelled = true; };
  }, [abortGesture]);

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
    const handleResize = () => {
      if (gesturePhaseRef.current !== "idle") abortGesture();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [abortGesture]);

  useEffect(() => {
    if (items.length < 2 || autoplayPaused) return;
    const interval = window.setInterval(() => {
      setCurrent((index) => wrapIndex(index + 1, items.length));
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [autoplayEpoch, autoplayPaused, intervalMs, items.length]);

  useEffect(() => () => {
    abortGesture(false);
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
    }
  }, [abortGesture]);

  const reasons = useMemo(
    () => new Map(items.map((anime) => [anime.id, getHeroRecommendationReason(anime, preferences)])),
    [items, preferences],
  );
  const visibleSlides = useMemo(
    () => getVisibleSlides(items, activeIndex),
    [activeIndex, items],
  );

  useLayoutEffect(() => {
    itemCountRef.current = items.length;
    const relativeIndices = visibleSlides.map(({ relativeIndex }) => relativeIndex);
    const minimumRelative = items.length === 2
      ? -1
      : Math.min(0, ...relativeIndices);
    const maximumRelative = items.length === 2
      ? 1
      : Math.max(0, ...relativeIndices);
    progressBoundsRef.current = {
      dragMinimum: -Math.min(MAX_DRAG_STEPS, maximumRelative),
      dragMaximum: Math.min(MAX_DRAG_STEPS, -minimumRelative),
      momentumMinimum: -Math.min(MAX_MOMENTUM_STEPS, maximumRelative),
      momentumMaximum: Math.min(MAX_MOMENTUM_STEPS, -minimumRelative),
    };
    measureTransitionDistance();
    applyDragProgress(dragProgressRef.current);
  }, [applyDragProgress, items.length, measureTransitionDistance, visibleSlides]);

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
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
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
        className="hero-recommendation-stage relative mt-4 h-[29.5rem] sm:h-[31.5rem] lg:h-[32.5rem]"
        data-dragging={gesturePhase === "dragging"}
        data-settling={gesturePhase === "settling"}
        aria-live={autoplayPaused ? "polite" : "off"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => resolvePointer(event, false)}
        onPointerCancel={(event) => resolvePointer(event, true)}
        onLostPointerCapture={(event) => {
          if (
            dragSessionRef.current.pointerId === event.pointerId
            && gesturePhaseRef.current === "dragging"
          ) resolvePointer(event, true);
        }}
        onClickCapture={handleClickCapture}
        onDragStart={(event) => event.preventDefault()}
      >
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

      {items.length > 1 && (
        <div className="mt-1 flex items-center justify-between gap-4 px-1">
          <div className="flex h-4 w-32 items-center gap-1 sm:w-40" aria-label={`Slide ${activeIndex + 1} of ${items.length}`}>
            {items.map((anime, index) => (
              <button
                key={anime.id}
                type="button"
                onClick={() => selectIndex(index)}
                aria-label={`Show ${anime.title}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={cn(
                  "h-1 min-w-0 flex-1 rounded-full bg-ink/15 transition-[flex-grow,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-soft",
                  index === activeIndex ? "flex-[3] bg-brand" : "hover:bg-ink/35",
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
