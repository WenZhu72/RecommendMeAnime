import assert from "node:assert/strict";
import test from "node:test";

import { buildBrowseLocation, updateBrowseParameter } from "./browse-path.js";
import { formatBrowsePagination } from "./pagination.js";

test("capped AniList metadata is not presented as an exact title or page count", () => {
  assert.deepEqual(
    formatBrowsePagination({ currentPage: 2, lastPage: 250, total: 5000, isExact: false }),
    {
      titleCount: null,
      pageSummary: "Page 2",
      compactPage: "Page 2",
    },
  );
});

test("verified metadata is presented consistently in the heading and pagination", () => {
  assert.deepEqual(
    formatBrowsePagination({ currentPage: 3, lastPage: 3, total: 46, isExact: true }),
    {
      titleCount: "46 titles",
      pageSummary: "Page 3 of 3 / 46 titles",
      compactPage: "3 / 3",
    },
  );
});

test("verified dropdown metadata shows the exact count from page 1", () => {
  assert.deepEqual(
    formatBrowsePagination({ currentPage: 1, lastPage: 3, total: 46, isExact: true }),
    {
      titleCount: "46 titles",
      pageSummary: "Page 1 of 3 / 46 titles",
      compactPage: "1 / 3",
    },
  );
});

test("new inexact metadata never reuses an exact count from the previous filter", () => {
  const previous = formatBrowsePagination({ currentPage: 2, lastPage: 4, total: 61, isExact: true });
  const next = formatBrowsePagination({ currentPage: 1, lastPage: 250, total: 5000, isExact: false });

  assert.equal(previous.titleCount, "61 titles");
  assert.equal(next.titleCount, null);
  assert.equal(next.pageSummary, "Page 1");
});

test("changing a filter on page 2 resets the page and starts with fresh pagination metadata", () => {
  const parameters = updateBrowseParameter(
    "format=TV&season=FALL&year=2025&page=2",
    "season",
    "SPRING",
  );
  const next = formatBrowsePagination({ currentPage: 1, lastPage: 250, total: 5000, isExact: false });

  assert.equal(buildBrowseLocation(parameters), "/browse?format=TV&season=SPRING&year=2025");
  assert.equal(next.titleCount, null);
  assert.equal(next.pageSummary, "Page 1");
});
