import assert from "node:assert/strict";
import test from "node:test";

import { buildHomeCataloguePath } from "./home-catalogue.js";

test("home collections use dedicated lightweight endpoints", () => {
  assert.equal(
    buildHomeCataloguePath("trending", { page: 1, perPage: 10 }),
    "/api/anime/trending?page=1&per_page=10",
  );
  assert.equal(
    buildHomeCataloguePath("popular", { page: 1, perPage: 10 }),
    "/api/anime/popular?page=1&per_page=10",
  );
  assert.equal(
    buildHomeCataloguePath("top-rated", { page: 4, perPage: 50 }),
    "/api/anime/top-rated?page=4&per_page=50",
  );
});

test("home requests never opt into Browse pagination or metadata resolution", () => {
  const requests = [
    buildHomeCataloguePath("trending", { perPage: 10 }),
    buildHomeCataloguePath("popular", { perPage: 10 }),
    buildHomeCataloguePath("top-rated", { perPage: 50 }),
  ];

  assert.equal(new Set(requests).size, requests.length);
  for (const request of requests) {
    assert.doesNotMatch(request, /\/browse(?:\?|$)/);
    assert.doesNotMatch(request, /exact|metadata|minimum_score/);
  }
});
