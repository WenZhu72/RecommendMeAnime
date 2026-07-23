import { selectRandomHeroPages } from "./hero-fallback.js";

type HeroCandidatePage<T> = {
  items: T[];
  pageInfo: { lastPage: number };
};

type LoadHeroCandidatesOptions<T> = {
  getCandidatePage: (page: number) => Promise<HeroCandidatePage<T>>;
  limit: number;
  random?: () => number;
  randomPageCount: number;
  selectCandidates: (items: T[]) => T[];
};

/**
 * Resolve a complete first page immediately. Extra, unique non-first pages
 * are sampled only as a resilience path when page one cannot fill the Hero.
 */
export async function loadHeroCandidates<T>({
  getCandidatePage,
  limit,
  random = Math.random,
  randomPageCount,
  selectCandidates,
}: LoadHeroCandidatesOptions<T>): Promise<T[]> {
  const firstPage = await getCandidatePage(1);
  const firstPageSelection = selectCandidates(firstPage.items);
  if (firstPageSelection.length >= limit || firstPage.pageInfo.lastPage <= 1) {
    return firstPageSelection.slice(0, limit);
  }

  const availableNonFirstPages = Math.max(0, firstPage.pageInfo.lastPage - 1);
  const sampledPages = selectRandomHeroPages(
    availableNonFirstPages,
    Math.min(randomPageCount, availableNonFirstPages),
    random,
  ).map((page) => page + 1);
  const pageResults = await Promise.allSettled(
    sampledPages.map((page) => getCandidatePage(page)),
  );
  const candidates = [
    ...firstPage.items,
    ...pageResults.flatMap((result) => (
      result.status === "fulfilled" ? result.value.items : []
    )),
  ];

  return selectCandidates(candidates).slice(0, limit);
}
