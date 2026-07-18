import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrowseAnimePath,
  buildBrowseAnimePathFromLocation,
  buildBrowseLocation,
  buildBrowseSearchLocation,
} from "./browse-path.js";

test("the Browse request identity contains search, filters, sort, and pagination", () => {
  assert.equal(
    buildBrowseAnimePath({
      search: "Naruto",
      genres: ["Action", "Adventure"],
      format: "TV",
      season: "FALL",
      seasonYear: 2002,
      minimumScore: 70,
      sort: "top-rated",
      page: 2,
      perPage: 20,
    }),
    "/api/anime/browse?search=Naruto&genre=Action&genre=Adventure&format=TV&season=FALL&season_year=2002&minimum_score=70&sort=top-rated&page=2&per_page=20",
  );
});

test("different submitted searches have different response identities", () => {
  const naruto = buildBrowseAnimePath({ search: "Naruto", sort: "popular" });
  const bleach = buildBrowseAnimePath({ search: "Bleach", sort: "popular" });

  assert.notEqual(naruto, bleach);
  assert.match(naruto, /search=Naruto/);
  assert.match(bleach, /search=Bleach/);
});

test("the current URL resolves to the exact server response identity", () => {
  const parameters = new URLSearchParams([
    ["search", "Naruto"],
    ["genre", "Action"],
    ["genre", "Adventure"],
    ["format", "TV"],
    ["season", "FALL"],
    ["year", "2002"],
    ["minimumScore", "70"],
    ["sort", "top-rated"],
    ["page", "2"],
  ]);

  assert.equal(
    buildBrowseAnimePathFromLocation(parameters),
    "/api/anime/browse?search=Naruto&genre=Action&genre=Adventure&format=TV&season=FALL&season_year=2002&minimum_score=70&sort=top-rated&page=2&per_page=20",
  );
});

test("submitting search resets page while preserving every other active value", () => {
  const parameters = new URLSearchParams({
    search: "Naruto",
    format: "TV",
    sort: "trending",
    page: "8",
  });

  assert.equal(
    buildBrowseLocation(parameters),
    "/browse?search=Naruto&format=TV&sort=trending",
  );
});

test("clearing the search restores the unfiltered first-page URL", () => {
  const parameters = new URLSearchParams({ page: "3" });
  assert.equal(buildBrowseLocation(parameters), "/browse");
});

test("public title searches use Browse as their only destination", () => {
  assert.equal(buildBrowseSearchLocation("  Naruto Shippuden  "), "/browse?search=Naruto+Shippuden");
  assert.equal(buildBrowseSearchLocation("   "), "/browse");
});
