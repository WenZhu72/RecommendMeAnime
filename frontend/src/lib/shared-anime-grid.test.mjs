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

test("Home and Browse results share the same entrance animation", async () => {
  const [home, browse] = await Promise.all([
    source("app/page.tsx"),
    source("app/browse/page.tsx"),
  ]);

  assert.match(home, /<AnimeGrid anime=\{anime\} animateEntrance/);
  assert.match(browse, /<AnimeGrid anime=\{response\.items\} animateEntrance/);
});
