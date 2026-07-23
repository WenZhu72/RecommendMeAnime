import assert from "node:assert/strict";
import test from "node:test";

import { pollForExactBrowsePagination } from "./browse-pagination-refresh.ts";
import type { AnimePageInfo } from "../types/anime.ts";

function pageInfo(isExact: boolean): AnimePageInfo {
  return {
    currentPage: 1,
    hasNextPage: true,
    lastPage: isExact ? 3 : 2,
    perPage: 20,
    total: isExact ? 46 : 0,
    isExact,
  };
}

const noDelay = async () => {};

test("an inexact response is checked quietly until exact metadata is available", async () => {
  const controller = new AbortController();
  const responses = [pageInfo(false), pageInfo(true)];
  const events: string[] = [];
  let fetches = 0;

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(false),
    requestKey: "year=2026",
    signal: controller.signal,
    wait: async () => {
      events.push("wait");
    },
    isCurrentRequest: () => true,
    fetchPageInfo: async () => {
      events.push("fetch");
      return responses[fetches++];
    },
  });

  assert.equal(fetches, 2);
  assert.deepEqual(events, ["fetch", "wait", "fetch"]);
  assert.deepEqual(result, pageInfo(true));
});

test("cached exact metadata does not make a follow-up request", async () => {
  const controller = new AbortController();
  let fetches = 0;

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(true),
    requestKey: "year=2026",
    signal: controller.signal,
    wait: noDelay,
    isCurrentRequest: () => true,
    fetchPageInfo: async () => {
      fetches += 1;
      return pageInfo(true);
    },
  });

  assert.equal(fetches, 0);
  assert.deepEqual(result, pageInfo(true));
});

test("an unavailable probe stops after the bounded attempt count", async () => {
  const controller = new AbortController();
  let fetches = 0;

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(false),
    requestKey: "broad-query",
    signal: controller.signal,
    wait: noDelay,
    isCurrentRequest: () => true,
    fetchPageInfo: async () => {
      fetches += 1;
      return pageInfo(false);
    },
  });

  assert.equal(fetches, 3);
  assert.equal(result, null);
});

test("a changed filter prevents an old response from being applied", async () => {
  const controller = new AbortController();
  let currentKey = "year=2026";

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(false),
    requestKey: "year=2026",
    signal: controller.signal,
    wait: noDelay,
    isCurrentRequest: (requestKey) => requestKey === currentKey,
    fetchPageInfo: async () => {
      currentKey = "year=2025";
      return pageInfo(true);
    },
  });

  assert.equal(result, null);
});

test("cancellation stops a scheduled retry after the immediate check", async () => {
  const controller = new AbortController();
  let fetches = 0;

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(false),
    requestKey: "year=2026",
    signal: controller.signal,
    wait: async () => controller.abort(),
    isCurrentRequest: () => true,
    fetchPageInfo: async () => {
      fetches += 1;
      return pageInfo(false);
    },
  });

  assert.equal(fetches, 1);
  assert.equal(result, null);
});

test("an ordinary follow-up failure stops metadata polling", async () => {
  const controller = new AbortController();
  let fetches = 0;

  const result = await pollForExactBrowsePagination({
    initialPageInfo: pageInfo(false),
    requestKey: "year=2026",
    signal: controller.signal,
    wait: noDelay,
    isCurrentRequest: () => true,
    fetchPageInfo: async () => {
      fetches += 1;
      throw new Error("temporary failure");
    },
  });

  assert.equal(fetches, 1);
  assert.equal(result, null);
});
