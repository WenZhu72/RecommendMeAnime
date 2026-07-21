import assert from "node:assert/strict";
import test from "node:test";

import {
  selectHeroFallbackCandidates,
  selectRandomHeroPages,
  shuffleHeroFallback,
} from "./hero-fallback.js";

test("fallback page sampling returns unique bounded pages", () => {
  const pages = selectRandomHeroPages(12, 5, () => 0);
  assert.equal(pages.length, 5);
  assert.equal(new Set(pages).size, pages.length);
  assert.ok(pages.every((page) => page >= 1 && page <= 12));
  assert.equal(pages.includes(1), false);
});

test("fallback page sampling caps the request count to the eligible range", () => {
  assert.deepEqual(selectRandomHeroPages(2, 5, () => 0.5).sort(), [1, 2]);
});

test("fallback shuffle is non-mutating and deterministic with injected randomness", () => {
  const values = [1, 2, 3, 4];
  const shuffled = shuffleHeroFallback(values, () => 0);
  assert.deepEqual(values, [1, 2, 3, 4]);
  assert.deepEqual(shuffled, [2, 3, 4, 1]);
});

test("fallback selection filters, deduplicates, and respects its final limit", () => {
  const candidates = [
    { id: 1, eligible: true },
    { id: 1, eligible: true },
    { id: 2, eligible: false },
    { id: 3, eligible: true },
    { id: 4, eligible: true },
  ];
  const selected = selectHeroFallbackCandidates(
    candidates,
    (candidate) => candidate.eligible,
    2,
    () => 0,
  );
  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(({ id }) => id)).size, selected.length);
  assert.ok(selected.every(({ eligible }) => eligible));
});
