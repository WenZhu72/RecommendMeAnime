import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const heroCarouselSource = await readFile(
  new URL("../components/home/HeroCarousel.tsx", import.meta.url),
  "utf8",
);
const heroCardSource = await readFile(
  new URL("../components/home/HeroRecommendationCard.tsx", import.meta.url),
  "utf8",
);
const animeCardSource = await readFile(
  new URL("../components/search/AnimeCard.tsx", import.meta.url),
  "utf8",
);

test("Hero, Trending, and Popular retain independent Suspense boundaries", () => {
  assert.equal((pageSource.match(/<Suspense\b/g) ?? []).length, 3);
  assert.match(
    pageSource,
    /<Suspense fallback=\{<HomeAnimeSection kind="trending" loading \/>\}>\s*<TrendingAnimeSection \/>\s*<\/Suspense>/,
  );
  assert.match(
    pageSource,
    /<Suspense fallback=\{<HomeAnimeSection kind="popular" loading \/>\}>\s*<PopularAnimeSection \/>\s*<\/Suspense>/,
  );
  assert.doesNotMatch(pageSource, /Promise\.all\(/);
});

test("Trending and Popular can settle independently without a parent fetch waterfall", () => {
  const trendingStart = pageSource.indexOf("async function TrendingAnimeSection");
  const popularStart = pageSource.indexOf("async function PopularAnimeSection");
  const sectionPropsStart = pageSource.indexOf("type HomeAnimeSectionProps");
  const trendingSection = pageSource.slice(trendingStart, popularStart);
  const popularSection = pageSource.slice(popularStart, sectionPropsStart);

  assert.ok(trendingStart > -1);
  assert.ok(popularStart > trendingStart);
  assert.ok(sectionPropsStart > popularStart);
  assert.match(trendingSection, /await getTrendingAnime\(\{ perPage: 10 \}\)/);
  assert.doesNotMatch(trendingSection, /getPopularAnime/);
  assert.match(popularSection, /await getPopularAnime\(\{ perPage: 10 \}\)/);
  assert.doesNotMatch(popularSection, /getTrendingAnime/);
  assert.match(pageSource, /export default function Home\(\)/);
  assert.doesNotMatch(pageSource, /export default async function Home\(\)/);
});

test("both Home list fallbacks render the shared ten-card grid skeleton", () => {
  assert.match(
    pageSource,
    /loading \? \(\s*<AnimeGridSkeleton count=\{10\} label=\{`Loading \$\{trending \? "trending" : "popular"\} anime`\} \/>/,
  );
  assert.match(pageSource, /<HomeAnimeSection kind="trending" loading \/>/);
  assert.match(pageSource, /<HomeAnimeSection kind="popular" loading \/>/);
});

test("the stable Hero shell suspends only an effect-free carousel fallback", () => {
  assert.match(pageSource, /<Hero[\s\S]*fallback=\{<HeroCarouselSkeleton\s*\/>\}/);
  assert.doesNotMatch(pageSource, /fallback=\{<Hero\b/);
  assert.equal((pageSource.match(/<HeroCarousel\b/g) ?? []).length, 1);
});

test("only the active Hero image is prioritized and Home grid cards stay lazy", () => {
  assert.match(heroCarouselSource, /priority=\{relativeIndex === visualActiveRelative\}/);
  assert.doesNotMatch(heroCarouselSource, /new window\.Image|preloadedImagesRef/);
  assert.match(heroCardSource, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(heroCardSource, /priority=\{priority\}/);
  assert.doesNotMatch(pageSource, /eagerFirstImage/);
  assert.match(animeCardSource, /imageLoading = "lazy"/);
  assert.match(animeCardSource, /loading=\{imagePriority \? undefined : imageLoading\}/);
});
