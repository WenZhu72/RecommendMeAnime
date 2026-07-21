import assert from "node:assert/strict";
import test from "node:test";

import {
  createNavScrollTracker,
  getNavScrollHiddenState,
  resetNavScrollTracker,
} from "./nav-scroll-logic.js";

test("small downward movements accumulate before hiding the navbar", () => {
  const tracker = createNavScrollTracker(0);

  assert.equal(getNavScrollHiddenState(tracker, 4, 12), null);
  assert.equal(getNavScrollHiddenState(tracker, 9, 12), null);
  assert.equal(getNavScrollHiddenState(tracker, 13, 12), true);
});

test("reversing upward reveals the navbar after the threshold", () => {
  const tracker = createNavScrollTracker(0);

  assert.equal(getNavScrollHiddenState(tracker, 100, 12), true);
  assert.equal(getNavScrollHiddenState(tracker, 94, 12), null);
  assert.equal(getNavScrollHiddenState(tracker, 87, 12), false);
});

test("resetting the tracker discards movement from a locked navbar", () => {
  const tracker = createNavScrollTracker(0);
  assert.equal(getNavScrollHiddenState(tracker, 50, 12), true);

  resetNavScrollTracker(tracker, 50);

  assert.equal(getNavScrollHiddenState(tracker, 58, 12), null);
  assert.equal(getNavScrollHiddenState(tracker, 63, 12), true);
});
