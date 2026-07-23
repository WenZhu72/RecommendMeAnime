import assert from "node:assert/strict";
import test from "node:test";

import { filterPublicAnime, sanitizePublicAnime } from "./anime-safety.ts";
import type { Anime } from "../types/anime.ts";

function anime(id: number, isAdult?: boolean): Anime {
  return {
    id,
    title: `Anime ${id}`,
    titles: { english: `Anime ${id}`, romaji: null, native: null },
    description: null,
    coverImage: null,
    color: null,
    bannerImage: null,
    averageScore: null,
    meanScore: null,
    popularity: null,
    genres: [],
    format: null,
    status: null,
    episodes: null,
    duration: null,
    season: null,
    seasonYear: null,
    startDate: null,
    endDate: null,
    studios: [],
    source: null,
    countryOfOrigin: null,
    synonyms: [],
    siteUrl: null,
    isAdult,
    relations: [],
    recommendations: [],
  };
}

test("public list boundaries remove entries explicitly marked as adult", () => {
  assert.deepEqual(filterPublicAnime([anime(1, false), anime(2, true), anime(3)]).map(({ id }) => id), [1, 3]);
});

test("detail sanitization removes adult nested media and rejects an adult root", () => {
  const safe = anime(1, false);
  safe.relations = [anime(2, false), anime(3, true)];
  safe.recommendations = [anime(4, true), anime(5, false)];

  assert.equal(sanitizePublicAnime(anime(6, true)), null);
  assert.deepEqual(sanitizePublicAnime(safe)?.relations.map(({ id }) => id), [2]);
  assert.deepEqual(sanitizePublicAnime(safe)?.recommendations.map(({ id }) => id), [5]);
});
