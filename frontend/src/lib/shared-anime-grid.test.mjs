import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceRoot = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, sourceRoot), "utf8");
}

test("Home, Browse, route loading, Watchlist, and recommendations share AnimeGridSkeleton", async () => {
  const consumers = await Promise.all([
    source("app/page.tsx"),
    source("app/browse/page.tsx"),
    source("app/loading.tsx"),
    source("app/watchlist/page.tsx"),
    source("components/recommendation/RecommendationResults.tsx"),
  ]);

  for (const consumer of consumers) {
    assert.match(consumer, /AnimeGridSkeleton/);
    assert.doesNotMatch(consumer, /BrowseLoadingCards|\bLoadingCards\b/);
  }
});

test("AnimeCard and its skeleton consume the same footprint primitives", async () => {
  const [card, skeleton, layout] = await Promise.all([
    source("components/search/AnimeCard.tsx"),
    source("components/search/AnimeCardSkeleton.tsx"),
    source("components/search/anime-card-layout.ts"),
  ]);
  const sharedPrimitives = [
    "animeCardShellClasses",
    "animeCardBodyClasses",
    "animeCardMetadataClasses",
    "animeCardGenresClasses",
  ];

  for (const primitive of sharedPrimitives) {
    assert.match(card, new RegExp(`\\b${primitive}\\b`));
    assert.match(skeleton, new RegExp(`\\b${primitive}\\b`));
    assert.match(layout, new RegExp(`export const ${primitive}`));
  }
  assert.match(card, /aspect-\[2\/3\]/);
  assert.match(skeleton, /aspect-\[2\/3\]/);
  assert.match(skeleton, /h-\[1\.375rem\]/);
  assert.match(skeleton, /w-16/);
  assert.match(skeleton, /w-14/);
  assert.match(layout, /min-h-8 flex-wrap content-end gap-1\.5 pt-3/);
});

test("the real and skeleton grids use the exact same responsive grid classes", async () => {
  const [grid, skeleton, layout] = await Promise.all([
    source("components/search/AnimeGrid.tsx"),
    source("components/search/AnimeGridSkeleton.tsx"),
    source("components/search/anime-card-layout.ts"),
  ]);

  assert.match(layout, /export const animeGridClasses\s*=/);
  assert.match(grid, /className=\{animeGridClasses\}/);
  assert.match(skeleton, /className=\{animeGridClasses\}/);
});

test("Home and Browse results share the same entrance animation", async () => {
  const [home, browse, grid] = await Promise.all([
    source("app/page.tsx"),
    source("app/browse/page.tsx"),
    source("components/search/AnimeGrid.tsx"),
  ]);

  assert.match(home, /<AnimeGrid anime=\{anime\} animateEntrance/);
  assert.match(browse, /<AnimeGrid anime=\{response\.items\} animateEntrance/);
  assert.match(grid, /key=\{item\.id\}/);
  assert.match(grid, /className=\{motionStyles\.resultCard\}/);
  assert.match(grid, /--anime-grid-stagger-delay/);
});

test("shared skeleton and result entrance motion is disabled for reduced motion", async () => {
  const motion = await source("components/search/AnimeGridMotion.module.css");
  const reducedMotion = motion.slice(motion.indexOf("@media (prefers-reduced-motion: reduce)"));

  assert.match(reducedMotion, /\.skeletonCard,\s*\.resultCard/);
  assert.match(reducedMotion, /transform: none/);
  assert.match(reducedMotion, /animation: none/);
  assert.match(reducedMotion, /\.skeletonSurface::after/);
});

test("pagination metadata refresh is lightweight and cannot change card identity", async () => {
  const [provider, api, grid] = await Promise.all([
    source("components/browse/BrowsePaginationMetadata.tsx"),
    source("lib/api/anime.ts"),
    source("components/search/AnimeGrid.tsx"),
  ]);

  assert.match(provider, /getBrowsePageInfo/);
  assert.doesNotMatch(provider, /await browseAnime/);
  assert.match(api, /buildBrowsePageInfoPath/);
  assert.match(grid, /key=\{item\.id\}/);
});
