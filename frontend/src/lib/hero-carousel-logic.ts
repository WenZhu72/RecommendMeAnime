export const DISTANT_FADE_START_DISTANCE = 1.05;
export const DISTANT_HIDDEN_DISTANCE = 1.45;

const SIDE_CARD_DISTANCE = 1;
const VISIBILITY_HIDDEN_DISTANCE = 1.55;
const INTERACTIVE_DISTANCE = 1.1;
const SIDE_CARD_OPACITY = 0.52;

export type CarouselPhase = "idle" | "pressing" | "dragging" | "settling";
export type GestureIntent = "pending" | "horizontal" | "vertical";

export type PointerSample = {
  position: number;
  time: number;
};

export type CarouselCardVisualState = {
  distanceFromCentre: number;
  translateY: number;
  translateZ: number;
  rotation: number;
  scale: number;
  opacity: number;
  saturation: number;
  brightness: number;
  zIndex: number;
  interactive: boolean;
  visibilityHidden: boolean;
};

export type VirtualCarouselSlide<T> = {
  anime: T;
  index: number;
  relativeIndex: number;
};

export function clampCarouselValue(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function wrapCarouselIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function getCarouselCardVisualState(
  visualPosition: number,
  sideBrightness = 0.72,
): CarouselCardVisualState {
  const distanceFromCentre = Math.abs(visualPosition);
  const sideProgress = Math.min(distanceFromCentre, SIDE_CARD_DISTANCE);
  const overflowProgress = Math.max(distanceFromCentre - SIDE_CARD_DISTANCE, 0);

  let opacity = 0;
  if (distanceFromCentre <= SIDE_CARD_DISTANCE) {
    opacity = 1 - ((1 - SIDE_CARD_OPACITY) * distanceFromCentre);
  } else if (distanceFromCentre <= DISTANT_FADE_START_DISTANCE) {
    opacity = SIDE_CARD_OPACITY;
  } else if (distanceFromCentre < DISTANT_HIDDEN_DISTANCE) {
    const fadeProgress = (
      distanceFromCentre - DISTANT_FADE_START_DISTANCE
    ) / (
      DISTANT_HIDDEN_DISTANCE - DISTANT_FADE_START_DISTANCE
    );
    opacity = SIDE_CARD_OPACITY * (1 - fadeProgress);
  }

  const saturation = clampCarouselValue(
    1 - (0.3 * sideProgress) - (0.1 * overflowProgress),
    0.55,
    1,
  );
  const brightness = clampCarouselValue(
    1 - ((1 - sideBrightness) * sideProgress) - (0.08 * overflowProgress),
    0.52,
    1,
  );

  return {
    distanceFromCentre,
    translateY: (17.6 * sideProgress) + (7 * overflowProgress),
    translateZ: (-80 * sideProgress) - (36 * overflowProgress),
    rotation: clampCarouselValue(-visualPosition * 8, -12, 12),
    scale: clampCarouselValue(
      1 - (0.16 * sideProgress) - (0.06 * overflowProgress),
      0.72,
      1,
    ),
    opacity,
    saturation,
    brightness,
    zIndex: Math.max(1, 30 - Math.round(distanceFromCentre * 10)),
    interactive: distanceFromCentre <= INTERACTIVE_DISTANCE && opacity > 0,
    visibilityHidden: distanceFromCentre >= VISIBILITY_HIDDEN_DISTANCE,
  };
}

export function getVirtualCarouselSlides<T extends { id: number }>(
  items: readonly T[],
  activeIndex: number,
  renderRadius: number,
): VirtualCarouselSlide<T>[] {
  if (!items.length) return [];

  const seenAnimeIds = new Set<number>();
  const candidates = [0];
  for (let distance = 1; distance <= renderRadius; distance += 1) {
    candidates.push(distance, -distance);
  }

  return candidates
    .flatMap((relativeIndex) => {
      const index = wrapCarouselIndex(activeIndex + relativeIndex, items.length);
      const anime = items[index];
      if (!anime || seenAnimeIds.has(anime.id)) return [];
      seenAnimeIds.add(anime.id);
      return [{ anime, index, relativeIndex }];
    })
    .sort((left, right) => left.relativeIndex - right.relativeIndex);
}

export function getVisualIndicatorIndex(
  activeIndex: number,
  visualActiveRelative: number,
  itemCount: number,
  phase: CarouselPhase,
): number {
  return phase === "idle" || phase === "pressing"
    ? activeIndex
    : wrapCarouselIndex(activeIndex + visualActiveRelative, itemCount);
}

export function resolveGestureIntent(
  horizontalOffset: number,
  verticalOffset: number,
  threshold: number,
  dominanceRatio: number,
): GestureIntent {
  const horizontalDistance = Math.abs(horizontalOffset);
  const verticalDistance = Math.abs(verticalOffset);
  if (Math.max(horizontalDistance, verticalDistance) < threshold) return "pending";
  if (horizontalDistance > verticalDistance * dominanceRatio) return "horizontal";
  if (verticalDistance > horizontalDistance * dominanceRatio) return "vertical";
  return "pending";
}

export function getCarouselTargetProgress(
  currentProgress: number,
  velocityProgressPerSecond: number,
  projectionSeconds: number,
  minimum: number,
  maximum: number,
): number {
  const projectedProgress = currentProgress
    + (velocityProgressPerSecond * projectionSeconds);
  const target = clampCarouselValue(Math.round(projectedProgress), minimum, maximum);
  return Object.is(target, -0) ? 0 : target;
}

export function getReleaseVelocity(
  samples: readonly PointerSample[],
  releaseTime: number,
  staleAfterMs: number,
): number {
  const newest = samples.at(-1);
  if (!newest || releaseTime - newest.time > staleAfterMs) return 0;

  const oldest = samples[0];
  if (!oldest) return 0;
  const elapsed = newest.time - oldest.time;
  return elapsed > 0 ? (newest.position - oldest.position) / elapsed : 0;
}

export function shouldSuppressCarouselClick(
  dragClickPending: boolean,
  clickDetail: number,
): boolean {
  return dragClickPending && clickDetail > 0;
}
