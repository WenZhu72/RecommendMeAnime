"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";

import {
  type CarouselPhase,
  type PointerSample,
  clampCarouselValue,
  getCarouselCardVisualState,
  getCarouselTargetProgress,
  getReleaseVelocity,
  resolveGestureIntent,
  shouldSuppressCarouselClick,
} from "@/lib/hero-carousel-logic";

const DRAG_THRESHOLD_PX = 7;
const DIRECTION_DOMINANCE_RATIO = 1.15;
const VELOCITY_SAMPLE_WINDOW_MS = 100;
const VELOCITY_STALE_AFTER_MS = 90;
const MOMENTUM_PROJECTION_SECONDS = 0.2;
const MAX_DRAG_STEPS = 4;
const MAX_MOMENTUM_STEPS = 5;

const CARD_CENTRE_OFFSET_RATIO = 0.64;
const STAGE_DISTANCE_FALLBACK_RATIO = 0.38;

const SPRING_STIFFNESS = 320;
const SPRING_DAMPING = 34;
const SPRING_REST_DISPLACEMENT = 0.0015;
const SPRING_REST_SPEED = 0.02;
const MAX_PROJECTED_VELOCITY = 14;
const MAX_SPRING_VELOCITY = 8;

type IdleInteraction = {
  phase: "idle";
};

type PressingInteraction = {
  phase: "pressing";
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
};

type DraggingInteraction = {
  phase: "dragging";
  pointerId: number;
  captureTarget: HTMLDivElement;
  startX: number;
  startProgress: number;
  currentProgress: number;
  samples: PointerSample[];
};

type SettlingInteraction = {
  phase: "settling";
};

type Interaction =
  | IdleInteraction
  | PressingInteraction
  | DraggingInteraction
  | SettlingInteraction;

type ProgressBounds = {
  dragMinimum: number;
  dragMaximum: number;
  momentumMinimum: number;
  momentumMaximum: number;
};

type UseHeroCarouselInteractionOptions = {
  itemCount: number;
  reducedMotion: boolean;
  renderedRelativeIndices: readonly number[];
  onCommitSteps: (steps: number) => void;
};

type HeroCarouselInteraction = {
  stageRef: React.RefObject<HTMLDivElement | null>;
  phase: CarouselPhase;
  visualActiveRelative: number;
  isIdle: () => boolean;
  reset: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

const IDLE_INTERACTION: IdleInteraction = { phase: "idle" };

function releasePointerCapture(interaction: DraggingInteraction): void {
  try {
    if (interaction.captureTarget.hasPointerCapture(interaction.pointerId)) {
      interaction.captureTarget.releasePointerCapture(interaction.pointerId);
    }
  } catch {
    // Capture may already be gone after the browser cancels a touch gesture.
  }
}

function addVelocitySample(samples: PointerSample[], sample: PointerSample): void {
  samples.push(sample);
  const earliestUsefulTime = sample.time - VELOCITY_SAMPLE_WINDOW_MS;
  while (samples.length > 1 && samples[0]?.time < earliestUsefulTime) {
    samples.shift();
  }
}

export function useHeroCarouselInteraction({
  itemCount,
  reducedMotion,
  renderedRelativeIndices,
  onCommitSteps,
}: UseHeroCarouselInteractionOptions): HeroCarouselInteraction {
  const stageRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<CarouselPhase>("idle");
  const [visualActiveRelative, setVisualActiveRelative] = useState(0);

  const interactionRef = useRef<Interaction>(IDLE_INTERACTION);
  const itemCountRef = useRef(itemCount);
  const progressRef = useRef(0);
  const pendingProgressRef = useRef(0);
  const transitionDistanceRef = useRef(1);
  const progressBoundsRef = useRef<ProgressBounds>({
    dragMinimum: -MAX_DRAG_STEPS,
    dragMaximum: MAX_DRAG_STEPS,
    momentumMinimum: -MAX_MOMENTUM_STEPS,
    momentumMaximum: MAX_MOMENTUM_STEPS,
  });
  const slideElementsRef = useRef<HTMLElement[]>([]);
  const visualActiveRelativeRef = useRef(0);
  const dragFrameRef = useRef<number | null>(null);
  const springFrameRef = useRef<number | null>(null);
  const dragClickPendingRef = useRef(false);

  const transitionTo = useCallback((next: Interaction) => {
    interactionRef.current = next;
    setPhase(next.phase);
  }, []);

  const applyProgress = useCallback((progress: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    progressRef.current = progress;
    stage.style.setProperty("--hero-drag-progress", String(progress));
    const transitionDistance = transitionDistanceRef.current;
    const sideBrightness = document.documentElement.classList.contains("light") ? 0.88 : 0.72;
    let nearestRelativeIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    slideElementsRef.current.forEach((slide) => {
      const relativeIndex = Number(slide.dataset.relativeIndex ?? 0);
      const effectiveRelativeIndex = itemCountRef.current === 2 && relativeIndex !== 0
        ? (progress > 0 ? -1 : 1)
        : relativeIndex;
      const cardProgress = effectiveRelativeIndex + progress;
      const visualState = getCarouselCardVisualState(cardProgress, sideBrightness);

      slide.style.setProperty("--hero-card-x", `${cardProgress * transitionDistance}px`);
      slide.style.setProperty("--hero-card-y", `${visualState.translateY}px`);
      slide.style.setProperty("--hero-card-z", `${visualState.translateZ}px`);
      slide.style.setProperty("--hero-card-rotation", `${visualState.rotation}deg`);
      slide.style.setProperty("--hero-card-scale", String(visualState.scale));
      slide.style.setProperty("--hero-card-opacity", String(visualState.opacity));
      slide.style.setProperty("--hero-card-saturation", String(visualState.saturation));
      slide.style.setProperty("--hero-card-brightness", String(visualState.brightness));
      slide.style.setProperty("--hero-card-z-index", String(visualState.zIndex));
      slide.style.setProperty(
        "--hero-card-pointer-events",
        visualState.interactive ? "auto" : "none",
      );
      slide.style.setProperty(
        "--hero-card-visibility",
        visualState.visibilityHidden ? "hidden" : "visible",
      );

      const inert = !visualState.interactive;
      if (slide.inert !== inert) slide.inert = inert;
      const ariaHidden = inert ? "true" : "false";
      if (slide.getAttribute("aria-hidden") !== ariaHidden) {
        slide.setAttribute("aria-hidden", ariaHidden);
      }

      if (visualState.distanceFromCentre < nearestDistance) {
        nearestDistance = visualState.distanceFromCentre;
        nearestRelativeIndex = relativeIndex;
      }
    });

    if (visualActiveRelativeRef.current !== nearestRelativeIndex) {
      visualActiveRelativeRef.current = nearestRelativeIndex;
      setVisualActiveRelative(nearestRelativeIndex);
    }
  }, []);

  const cancelDragFrame = useCallback(() => {
    if (dragFrameRef.current === null) return;
    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
  }, []);

  const cancelSpring = useCallback(() => {
    if (springFrameRef.current === null) return;
    window.cancelAnimationFrame(springFrameRef.current);
    springFrameRef.current = null;
  }, []);

  const scheduleProgress = useCallback((progress: number) => {
    pendingProgressRef.current = progress;
    if (dragFrameRef.current !== null) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = null;
      applyProgress(pendingProgressRef.current);
    });
  }, [applyProgress]);

  const settleAtZero = useCallback((initialVelocity: number) => {
    transitionTo({ phase: "settling" });
    if (reducedMotion) {
      applyProgress(0);
      visualActiveRelativeRef.current = 0;
      setVisualActiveRelative(0);
      transitionTo(IDLE_INTERACTION);
      return;
    }

    cancelSpring();
    let position = progressRef.current;
    let velocity = clampCarouselValue(
      initialVelocity,
      -MAX_SPRING_VELOCITY,
      MAX_SPRING_VELOCITY,
    );
    let previousTime = window.performance.now();

    const step = (time: number) => {
      if (interactionRef.current.phase !== "settling") {
        springFrameRef.current = null;
        return;
      }

      const elapsedSeconds = Math.min((time - previousTime) / 1000, 0.032);
      previousTime = time;
      const acceleration = (-SPRING_STIFFNESS * position) - (SPRING_DAMPING * velocity);
      velocity += acceleration * elapsedSeconds;
      position += velocity * elapsedSeconds;
      applyProgress(position);

      const atRest = Math.abs(position) <= SPRING_REST_DISPLACEMENT
        && Math.abs(velocity) <= SPRING_REST_SPEED;
      if (atRest) {
        springFrameRef.current = null;
        applyProgress(0);
        visualActiveRelativeRef.current = 0;
        setVisualActiveRelative(0);
        transitionTo(IDLE_INTERACTION);
        return;
      }
      springFrameRef.current = window.requestAnimationFrame(step);
    };

    springFrameRef.current = window.requestAnimationFrame(step);
  }, [applyProgress, cancelSpring, reducedMotion, transitionTo]);

  const reset = useCallback(() => {
    const interaction = interactionRef.current;
    if (interaction.phase === "dragging") releasePointerCapture(interaction);
    cancelDragFrame();
    cancelSpring();
    dragClickPendingRef.current = false;
    pendingProgressRef.current = 0;
    visualActiveRelativeRef.current = 0;
    applyProgress(0);
    setVisualActiveRelative(0);
    transitionTo(IDLE_INTERACTION);
  }, [applyProgress, cancelDragFrame, cancelSpring, transitionTo]);

  const finishDrag = useCallback((
    interaction: DraggingInteraction,
    releaseTime: number,
    cancelled: boolean,
  ) => {
    cancelDragFrame();
    const releaseVelocityPxPerMs = cancelled
      ? 0
      : getReleaseVelocity(
        interaction.samples,
        releaseTime,
        VELOCITY_STALE_AFTER_MS,
      );
    const velocityProgressPerSecond = clampCarouselValue(
      (releaseVelocityPxPerMs * 1000) / transitionDistanceRef.current,
      -MAX_PROJECTED_VELOCITY,
      MAX_PROJECTED_VELOCITY,
    );
    const bounds = progressBoundsRef.current;
    const targetProgress = cancelled
      ? 0
      : getCarouselTargetProgress(
        interaction.currentProgress,
        velocityProgressPerSecond,
        MOMENTUM_PROJECTION_SECONDS,
        bounds.momentumMinimum,
        bounds.momentumMaximum,
      );
    const rebasedProgress = interaction.currentProgress - targetProgress;

    progressRef.current = rebasedProgress;
    pendingProgressRef.current = rebasedProgress;
    transitionTo({ phase: "settling" });
    releasePointerCapture(interaction);

    if (targetProgress !== 0) {
      flushSync(() => onCommitSteps(-targetProgress));
    } else {
      applyProgress(rebasedProgress);
    }
    settleAtZero(cancelled ? 0 : velocityProgressPerSecond);
  }, [
    applyProgress,
    cancelDragFrame,
    onCommitSteps,
    settleAtZero,
    transitionTo,
  ]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      itemCount < 2
      || !event.isPrimary
      || (event.pointerType === "mouse" && event.button !== 0)
    ) return;

    const currentInteraction = interactionRef.current;
    if (currentInteraction.phase === "dragging" || currentInteraction.phase === "pressing") return;
    if (currentInteraction.phase === "settling") {
      cancelSpring();
      applyProgress(0);
      visualActiveRelativeRef.current = 0;
      setVisualActiveRelative(0);
    }

    dragClickPendingRef.current = false;
    transitionTo({
      phase: "pressing",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
    });
  }, [applyProgress, cancelSpring, itemCount, transitionTo]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.phase === "pressing") {
      if (interaction.pointerId !== event.pointerId) return;
      const horizontalOffset = event.clientX - interaction.startX;
      const verticalOffset = event.clientY - interaction.startY;
      const intent = resolveGestureIntent(
        horizontalOffset,
        verticalOffset,
        DRAG_THRESHOLD_PX,
        DIRECTION_DOMINANCE_RATIO,
      );
      if (intent === "pending") return;
      if (intent === "vertical") {
        transitionTo(IDLE_INTERACTION);
        return;
      }

      event.preventDefault();
      const dragging: DraggingInteraction = {
        phase: "dragging",
        pointerId: event.pointerId,
        captureTarget: event.currentTarget,
        startX: interaction.startX,
        startProgress: progressRef.current,
        currentProgress: progressRef.current,
        samples: [],
      };
      addVelocitySample(dragging.samples, {
        position: interaction.startX,
        time: interaction.startTime,
      });
      addVelocitySample(dragging.samples, {
        position: event.clientX,
        time: event.timeStamp,
      });
      dragClickPendingRef.current = true;
      transitionTo(dragging);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is an enhancement; touch pointers are implicitly captured.
      }
    }

    const dragging = interactionRef.current;
    if (dragging.phase !== "dragging" || dragging.pointerId !== event.pointerId) return;
    event.preventDefault();
    const progress = clampCarouselValue(
      dragging.startProgress
        + ((event.clientX - dragging.startX) / transitionDistanceRef.current),
      progressBoundsRef.current.dragMinimum,
      progressBoundsRef.current.dragMaximum,
    );
    dragging.currentProgress = progress;
    addVelocitySample(dragging.samples, {
      position: event.clientX,
      time: event.timeStamp,
    });
    scheduleProgress(progress);
  }, [scheduleProgress, transitionTo]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.phase === "pressing" && interaction.pointerId === event.pointerId) {
      transitionTo(IDLE_INTERACTION);
      return;
    }
    if (interaction.phase === "dragging" && interaction.pointerId === event.pointerId) {
      finishDrag(interaction, event.timeStamp, false);
    }
  }, [finishDrag, transitionTo]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.phase === "pressing" && interaction.pointerId === event.pointerId) {
      transitionTo(IDLE_INTERACTION);
      return;
    }
    if (interaction.phase === "dragging" && interaction.pointerId === event.pointerId) {
      finishDrag(interaction, event.timeStamp, true);
    }
  }, [finishDrag, transitionTo]);

  const onLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (interaction.phase === "dragging" && interaction.pointerId === event.pointerId) {
      finishDrag(interaction, event.timeStamp, true);
    }
  }, [finishDrag]);

  const onClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragClickPendingRef.current) return;
    dragClickPendingRef.current = false;
    if (!shouldSuppressCarouselClick(true, event.detail)) return;
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  }, []);

  const isIdle = useCallback(() => interactionRef.current.phase === "idle", []);

  useLayoutEffect(() => {
    itemCountRef.current = itemCount;
    const stage = stageRef.current;
    slideElementsRef.current = stage
      ? Array.from(stage.querySelectorAll<HTMLElement>(".hero-recommendation-slide"))
      : [];

    const minimumRelative = itemCount === 2
      ? -1
      : Math.min(0, ...renderedRelativeIndices);
    const maximumRelative = itemCount === 2
      ? 1
      : Math.max(0, ...renderedRelativeIndices);
    progressBoundsRef.current = {
      dragMinimum: -Math.min(MAX_DRAG_STEPS, maximumRelative),
      dragMaximum: Math.min(MAX_DRAG_STEPS, -minimumRelative),
      momentumMinimum: -Math.min(MAX_MOMENTUM_STEPS, maximumRelative),
      momentumMaximum: Math.min(MAX_MOMENTUM_STEPS, -minimumRelative),
    };

    const stageWidth = stage?.clientWidth ?? 0;
    const activeSlide = stage?.querySelector<HTMLElement>('[data-relative-index="0"]');
    const measuredCardDistance = (activeSlide?.offsetWidth ?? 0) * CARD_CENTRE_OFFSET_RATIO;
    const transitionDistance = Math.max(
      measuredCardDistance || (stageWidth * STAGE_DISTANCE_FALLBACK_RATIO),
      1,
    );
    transitionDistanceRef.current = transitionDistance;
    stage?.style.setProperty("--hero-transition-distance", `${transitionDistance}px`);
    applyProgress(progressRef.current);
  }, [applyProgress, itemCount, renderedRelativeIndices]);

  useEffect(() => {
    const handleResize = () => reset();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [reset]);

  useEffect(() => () => {
    const interaction = interactionRef.current;
    if (interaction.phase === "dragging") releasePointerCapture(interaction);
    if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    if (springFrameRef.current !== null) window.cancelAnimationFrame(springFrameRef.current);
  }, []);

  return {
    stageRef,
    phase,
    visualActiveRelative,
    isIdle,
    reset,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onClickCapture,
  };
}
