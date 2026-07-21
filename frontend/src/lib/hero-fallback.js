/**
 * Fisher-Yates shuffle with injectable randomness for deterministic tests.
 *
 * @template T
 * @param {readonly T[]} values
 * @param {() => number} [random]
 * @returns {T[]}
 */
export function shuffleHeroFallback(values, random = Math.random) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }

  return result;
}

/**
 * Select unique one-indexed pages without automatically favouring page one.
 *
 * @param {number} lastPage
 * @param {number} pageCount
 * @param {() => number} [random]
 */
export function selectRandomHeroPages(lastPage, pageCount, random = Math.random) {
  const validLastPage = Math.max(1, Math.floor(lastPage));
  const validPageCount = Math.max(1, Math.min(Math.floor(pageCount), validLastPage));
  const pages = Array.from({ length: validLastPage }, (_, index) => index + 1);
  return shuffleHeroFallback(pages, random).slice(0, validPageCount);
}

/**
 * Deduplicate, validate, shuffle, and cap a fallback candidate collection.
 *
 * @template {{id: number}} T
 * @param {readonly T[]} values
 * @param {(value: T) => boolean} isEligible
 * @param {number} limit
 * @param {() => number} [random]
 */
export function selectHeroFallbackCandidates(
  values,
  isEligible,
  limit,
  random = Math.random,
) {
  const seenIds = new Set();
  const eligible = [];

  values.forEach((value) => {
    if (seenIds.has(value.id) || !isEligible(value)) return;
    seenIds.add(value.id);
    eligible.push(value);
  });

  return shuffleHeroFallback(eligible, random).slice(0, Math.max(0, limit));
}
