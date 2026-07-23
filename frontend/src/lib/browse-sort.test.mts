import assert from "node:assert/strict";
import test from "node:test";

import {
  getBrowseSortConfig,
  normalizeBrowseSort,
} from "../config/catalogue.ts";
import { getBrowseNavigationParameters, updateBrowseParameter } from "./browse-path.js";

test("Browse sort values map to their visible trigger labels", () => {
  const cases = [
    ["", "Most popular"],
    ["sort=popular", "Most popular"],
    ["sort=trending", "Trending"],
    ["sort=top-rated", "Highest rated"],
    ["sort=invalid", "Most popular"],
  ] as const;

  for (const [query, expectedLabel] of cases) {
    const parameters = getBrowseNavigationParameters(query, null);
    const sort = normalizeBrowseSort(parameters.get("sort"));
    assert.equal(getBrowseSortConfig(sort).triggerLabel, expectedLabel);
  }
});

test("changing another Browse filter preserves the active sort label", () => {
  const parameters = updateBrowseParameter("sort=top-rated", "format", "MOVIE");
  const sort = normalizeBrowseSort(parameters.get("sort"));

  assert.equal(getBrowseSortConfig(sort).triggerLabel, "Highest rated");
});

test("a pending sort selection updates the trigger before navigation commits", () => {
  const parameters = getBrowseNavigationParameters(
    "sort=popular",
    "/browse?sort=trending",
  );
  const sort = normalizeBrowseSort(parameters.get("sort"));

  assert.equal(getBrowseSortConfig(sort).triggerLabel, "Trending");
});

test("Browse sort values share one normalized trigger and heading mapping", () => {
  const cases = [
    [null, "popular", "Most popular", "Popular anime"],
    ["popular", "popular", "Most popular", "Popular anime"],
    ["trending", "trending", "Trending", "Trending anime"],
    ["top-rated", "top-rated", "Highest rated", "Highest-rated anime"],
    ["not-a-sort", "popular", "Most popular", "Popular anime"],
    ["constructor", "popular", "Most popular", "Popular anime"],
    ["toString", "popular", "Most popular", "Popular anime"],
  ] as const;

  for (const [input, value, triggerLabel, heading] of cases) {
    assert.deepEqual(getBrowseSortConfig(input), { value, triggerLabel, heading });
  }
});
