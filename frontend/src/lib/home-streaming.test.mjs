import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("Hero, Trending, and Popular retain independent Suspense boundaries", () => {
  assert.equal((pageSource.match(/<Suspense\b/g) ?? []).length, 3);
  assert.match(pageSource, /<HomeHeroRecommendations\s*\/>/);
  assert.match(pageSource, /<TrendingAnimeSection\s*\/>/);
  assert.match(pageSource, /<PopularAnimeSection\s*\/>/);
  assert.doesNotMatch(pageSource, /Promise\.all\(/);
});

test("the stable Hero shell suspends only an effect-free carousel fallback", () => {
  assert.match(pageSource, /<Hero[\s\S]*fallback=\{<HeroCarouselSkeleton\s*\/>\}/);
  assert.doesNotMatch(pageSource, /fallback=\{<Hero\b/);
  assert.equal((pageSource.match(/<HeroCarousel\b/g) ?? []).length, 1);
});
