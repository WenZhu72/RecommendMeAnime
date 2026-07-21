/**
 * @typedef {"up" | "down" | null} NavScrollDirection
 * @typedef {{
 *   previousScroll: number,
 *   directionStart: number,
 *   direction: NavScrollDirection,
 * }} NavScrollTracker
 */

/** @param {number} scrollY @returns {NavScrollTracker} */
export function createNavScrollTracker(scrollY = 0) {
  const currentScroll = Math.max(scrollY, 0);
  return {
    previousScroll: currentScroll,
    directionStart: currentScroll,
    direction: null,
  };
}

/** @param {NavScrollTracker} tracker @param {number} scrollY */
export function resetNavScrollTracker(tracker, scrollY) {
  const currentScroll = Math.max(scrollY, 0);
  tracker.previousScroll = currentScroll;
  tracker.directionStart = currentScroll;
  tracker.direction = null;
}

/**
 * Returns the next hidden state after meaningful movement, or null while the
 * current direction has not crossed the threshold yet.
 *
 * @param {NavScrollTracker} tracker
 * @param {number} scrollY
 * @param {number} threshold
 * @returns {boolean | null}
 */
export function getNavScrollHiddenState(tracker, scrollY, threshold) {
  const currentScroll = Math.max(scrollY, 0);
  const delta = currentScroll - tracker.previousScroll;
  if (delta === 0) return null;

  const direction = delta > 0 ? "down" : "up";
  if (direction !== tracker.direction) {
    tracker.direction = direction;
    tracker.directionStart = tracker.previousScroll;
  }

  tracker.previousScroll = currentScroll;
  if (Math.abs(currentScroll - tracker.directionStart) < threshold) return null;
  return direction === "down";
}
