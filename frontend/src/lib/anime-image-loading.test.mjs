import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isAnimeImageLoaded } from "./anime-image-loading.js";

const cardSource = await readFile(
  new URL("../components/search/AnimeCard.tsx", import.meta.url),
  "utf8",
);
const motionSource = await readFile(
  new URL("../components/search/AnimeGridMotion.module.css", import.meta.url),
  "utf8",
);

test("a cover starts loading and becomes ready only for its loaded source", () => {
  const source = "https://example.com/cover-a.jpg";

  assert.equal(isAnimeImageLoaded(source, null), false);
  assert.equal(isAnimeImageLoaded(source, source), true);
});

test("a changed cover source resets readiness instead of reusing stale loaded state", () => {
  const previousSource = "https://example.com/cover-a.jpg";
  const nextSource = "https://example.com/cover-b.jpg";

  assert.equal(isAnimeImageLoaded(nextSource, previousSource), false);
  assert.match(cardSource, /<AnimeCardImage\s+key=\{anime\.coverImage\}/);
});

test("AnimeCard handles normal and already-cached image completion", () => {
  assert.match(cardSource, /onLoad=\{markImageLoaded\}/);
  assert.match(cardSource, /ref=\{captureImage\}/);
  assert.match(cardSource, /image\?\.complete && image\.naturalWidth > 0/);
  assert.match(cardSource, /setLoadedImageSource\(src\)/);
});

test("the image fades in while its non-interactive shimmer fades away", () => {
  assert.match(motionSource, /\.cardImage\s*\{[^}]*opacity: 0;[^}]*opacity 400ms[^}]*transform 500ms/s);
  assert.match(motionSource, /\.cardImageLoaded\s*\{\s*opacity: 1;/);
  assert.match(motionSource, /\.imagePlaceholder\s*\{[^}]*pointer-events: none;[^}]*opacity: 1;[^}]*opacity 400ms/s);
  assert.match(motionSource, /\.imagePlaceholderLoaded\s*\{\s*opacity: 0;/);
  assert.match(motionSource, /\.imagePlaceholderLoaded::after\s*\{\s*animation: none;/);
  assert.match(cardSource, /imageLoaded && motionStyles\.cardImageLoaded/);
  assert.match(cardSource, /imageLoaded && motionStyles\.imagePlaceholderLoaded/);
  assert.match(cardSource, /group-hover:scale-\[1\.035\]/);
});

test("image shimmer and fade respect reduced-motion preferences", () => {
  const reducedMotion = motionSource.slice(
    motionSource.indexOf("@media (prefers-reduced-motion: reduce)"),
  );

  assert.match(reducedMotion, /\.skeletonSurface::after\s*\{[^}]*animation: none;/s);
  assert.match(reducedMotion, /\.imagePlaceholder,\s*\.cardImage\s*\{\s*transition-duration: 0\.01ms;/);
});
