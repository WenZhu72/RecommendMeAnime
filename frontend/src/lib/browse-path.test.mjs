import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrowseAnimePath,
  buildBrowseAnimePathFromLocation,
  buildBrowseLocation,
  buildBrowsePageLocation,
  buildBrowseParametersFromHref,
  buildBrowseRequestKeyFromHref,
  buildBrowseSearchLocation,
  getBrowseNavigationParameters,
  shouldNavigateBrowse,
  shouldShowBrowseFallback,
  toggleBrowseYear,
  updateBrowseGenres,
  updateBrowseParameter,
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

test("selecting a year writes the singular year parameter and resets pagination", () => {
  const selectedYear = toggleBrowseYear("", "2025");
  const parameters = updateBrowseParameter("format=TV&page=4", "year", selectedYear);

  assert.equal(buildBrowseLocation(parameters), "/browse?format=TV&year=2025");
});

test("selecting the current year again clears the year parameter", () => {
  const selectedYear = toggleBrowseYear("2025", "2025");
  const parameters = updateBrowseParameter("genre=Action&year=2025", "year", selectedYear);

  assert.equal(buildBrowseLocation(parameters), "/browse?genre=Action");
});

test("clearing a year removes it without dropping other filters", () => {
  const parameters = updateBrowseParameter("year=2025&sort=trending", "year", "");

  assert.equal(buildBrowseLocation(parameters), "/browse?sort=trending");
});

test("changing another filter preserves the selected year", () => {
  const parameters = updateBrowseParameter("year=2025&page=3", "format", "MOVIE");

  assert.equal(buildBrowseLocation(parameters), "/browse?year=2025&format=MOVIE");
});

test("changing pages preserves the selected year and forwards it to the API request", () => {
  const location = buildBrowsePageLocation("/browse", "year=2025&format=TV", 3);

  assert.equal(location, "/browse?year=2025&format=TV&page=3");
  assert.equal(
    buildBrowseAnimePathFromLocation(location.split("?")[1]),
    "/api/anime/browse?format=TV&season_year=2025&sort=popular&page=3&per_page=20",
  );
});

test("each dropdown selection writes one canonical first-page URL", () => {
  const cases = [
    ["format", "TV", "/browse?format=TV"],
    ["season", "FALL", "/browse?season=FALL"],
    ["year", "2025", "/browse?year=2025"],
    ["sort", "top-rated", "/browse?sort=top-rated"],
  ];

  for (const [name, value, expected] of cases) {
    const parameters = updateBrowseParameter("page=4", name, value);
    assert.equal(buildBrowseLocation(parameters), expected);
  }

  assert.equal(
    buildBrowseLocation(updateBrowseGenres("page=4", ["Action", "Comedy"])),
    "/browse?genre=Action&genre=Comedy",
  );
});

test("clearing each dropdown removes only its own parameter", () => {
  const source = "genre=Action&format=TV&season=FALL&year=2025&sort=top-rated";
  const cases = [
    ["format", "/browse?genre=Action&season=FALL&year=2025&sort=top-rated"],
    ["season", "/browse?genre=Action&format=TV&year=2025&sort=top-rated"],
    ["year", "/browse?genre=Action&format=TV&season=FALL&sort=top-rated"],
    ["sort", "/browse?genre=Action&format=TV&season=FALL&year=2025"],
  ];

  for (const [name, expected] of cases) {
    assert.equal(buildBrowseLocation(updateBrowseParameter(source, name, "")), expected);
  }

  assert.equal(
    buildBrowseLocation(updateBrowseGenres(source, [])),
    "/browse?format=TV&season=FALL&year=2025&sort=top-rated",
  );
});

test("one interaction cannot enqueue the same Browse navigation twice", () => {
  const currentRequestKey = buildBrowseAnimePathFromLocation("");
  const nextRequestKey = buildBrowseRequestKeyFromHref("/browse?format=TV");

  assert.equal(shouldNavigateBrowse(currentRequestKey, null, nextRequestKey), true);
  assert.equal(shouldNavigateBrowse(currentRequestKey, nextRequestKey, nextRequestKey), false);
  assert.equal(shouldNavigateBrowse(nextRequestKey, null, nextRequestKey), false);
  assert.equal(shouldNavigateBrowse(currentRequestKey, nextRequestKey, currentRequestKey), true);
});

test("pending Browse controls display the destination URL state", () => {
  const pending = getBrowseNavigationParameters(
    "sort=popular&genre=Action",
    "/browse?sort=trending&genre=Action&format=TV",
  );

  assert.equal(pending.get("sort"), "trending");
  assert.equal(pending.get("format"), "TV");
  assert.deepEqual(pending.getAll("genre"), ["Action"]);
});

test("settled and history-driven Browse controls display committed URL state", () => {
  assert.equal(getBrowseNavigationParameters("sort=top-rated", null).get("sort"), "top-rated");
  assert.equal(getBrowseNavigationParameters("sort=trending", null).get("sort"), "trending");
  assert.equal(getBrowseNavigationParameters("", null).get("sort"), null);
});

test("pending and stale result sets remain behind one consistent loading state", () => {
  const oldRequestKey = buildBrowseAnimePathFromLocation("");
  const formatRequestKey = buildBrowseRequestKeyFromHref("/browse?format=TV");

  assert.equal(shouldShowBrowseFallback({
    transitionPending: true,
    currentRequestKey: oldRequestKey,
    targetRequestKey: formatRequestKey,
    responseKey: oldRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: formatRequestKey,
    targetRequestKey: null,
    responseKey: oldRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: formatRequestKey,
    targetRequestKey: null,
    responseKey: formatRequestKey,
  }), false);
});

test("rapid filter changes reject the intermediate response and settle on the latest target", () => {
  const initialRequestKey = buildBrowseAnimePathFromLocation("");
  const firstRequestKey = buildBrowseRequestKeyFromHref("/browse?genre=Action");
  const latestParameters = updateBrowseParameter(
    buildBrowseParametersFromHref("/browse?genre=Action"),
    "format",
    "TV",
  );
  const latestHref = buildBrowseLocation(latestParameters);
  const latestRequestKey = buildBrowseRequestKeyFromHref(latestHref);

  assert.equal(latestHref, "/browse?genre=Action&format=TV");
  assert.equal(shouldNavigateBrowse(initialRequestKey, firstRequestKey, latestRequestKey), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: firstRequestKey,
    targetRequestKey: latestRequestKey,
    responseKey: firstRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: latestRequestKey,
    targetRequestKey: latestRequestKey,
    responseKey: latestRequestKey,
  }), false);
});

test("a filter change during a pending sort composes from the optimistic destination", () => {
  const pendingParameters = getBrowseNavigationParameters(
    "sort=popular&page=4",
    "/browse?sort=trending",
  );
  const filteredHref = buildBrowseLocation(
    updateBrowseParameter(pendingParameters, "format", "TV"),
  );

  assert.equal(filteredHref, "/browse?sort=trending&format=TV");
  assert.equal(
    buildBrowseRequestKeyFromHref(filteredHref),
    buildBrowseAnimePath({ sort: "trending", format: "TV" }),
  );
});

test("dropping a cancelled optimistic target restores the committed response", () => {
  const committedRequestKey = buildBrowseAnimePathFromLocation("sort=popular");
  const pendingRequestKey = buildBrowseRequestKeyFromHref("/browse?sort=trending");

  assert.equal(shouldShowBrowseFallback({
    transitionPending: true,
    currentRequestKey: committedRequestKey,
    targetRequestKey: pendingRequestKey,
    responseKey: committedRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: committedRequestKey,
    targetRequestKey: null,
    responseKey: committedRequestKey,
  }), false);
});

test("Back and Forward hide stale cards until the history response matches", () => {
  const popularRequestKey = buildBrowseAnimePathFromLocation("sort=popular");
  const trendingRequestKey = buildBrowseAnimePathFromLocation("sort=trending");

  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: trendingRequestKey,
    targetRequestKey: null,
    responseKey: popularRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: trendingRequestKey,
    targetRequestKey: null,
    responseKey: trendingRequestKey,
  }), false);
});

test("the Naruto search flow uses the same latest-response guard", () => {
  const oldRequestKey = buildBrowseAnimePathFromLocation("");
  const narutoRequestKey = buildBrowseRequestKeyFromHref("/browse?search=Naruto");

  assert.match(narutoRequestKey, /search=Naruto/);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: narutoRequestKey,
    targetRequestKey: narutoRequestKey,
    responseKey: oldRequestKey,
  }), true);
  assert.equal(shouldShowBrowseFallback({
    transitionPending: false,
    currentRequestKey: narutoRequestKey,
    targetRequestKey: narutoRequestKey,
    responseKey: narutoRequestKey,
  }), false);
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
