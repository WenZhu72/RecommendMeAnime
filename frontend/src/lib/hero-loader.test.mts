import assert from "node:assert/strict";
import test from "node:test";

import { loadHeroCandidates } from "./hero-loader.ts";

type Candidate = { eligible: boolean; id: number };

function selectEligible(items: Candidate[]): Candidate[] {
  const seen = new Set<number>();
  return items.filter((item) => item.eligible && !seen.has(item.id) && Boolean(seen.add(item.id)));
}

test("a complete first Hero page returns immediately without random-page fan-out", async () => {
  const calls: number[] = [];
  const items = Array.from({ length: 30 }, (_, index) => ({ eligible: true, id: index + 1 }));

  const result = await loadHeroCandidates({
    getCandidatePage: async (page) => {
      calls.push(page);
      return { items, pageInfo: { lastPage: 100 } };
    },
    limit: 24,
    randomPageCount: 5,
    selectCandidates: selectEligible,
  });

  assert.deepEqual(calls, [1]);
  assert.equal(result.length, 24);
  assert.equal(new Set(result.map((item) => item.id)).size, 24);
});

test("a deficient first page samples unique non-first pages and never requests page 1 twice", async () => {
  const calls: number[] = [];

  const result = await loadHeroCandidates({
    getCandidatePage: async (page) => {
      calls.push(page);
      return {
        items: [{ eligible: true, id: page }],
        pageInfo: { lastPage: 8 },
      };
    },
    limit: 6,
    random: () => 0,
    randomPageCount: 5,
    selectCandidates: selectEligible,
  });

  assert.equal(calls.filter((page) => page === 1).length, 1);
  assert.equal(new Set(calls).size, calls.length);
  assert.ok(calls.slice(1).every((page) => page >= 2 && page <= 8));
  assert.equal(result.length, 6);
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
});

test("failed resilience pages do not discard usable first-page Hero candidates", async () => {
  const result = await loadHeroCandidates({
    getCandidatePage: async (page) => {
      if (page > 1) throw new Error("sample unavailable");
      return {
        items: [{ eligible: true, id: 1 }, { eligible: true, id: 2 }],
        pageInfo: { lastPage: 3 },
      };
    },
    limit: 3,
    randomPageCount: 2,
    selectCandidates: selectEligible,
  });

  assert.deepEqual(result.map((item) => item.id), [1, 2]);
});
