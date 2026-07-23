/**
 * Build the Browse count and page labels from one pagination metadata source.
 * AniList's total and lastPage values are only displayed when the backend has
 * verified them against a terminal page.
 *
 * @param {{ currentPage: number, lastPage: number, total: number, isExact: boolean }} pageInfo
 */
export function formatBrowsePagination(pageInfo) {
  const currentPage = Math.max(1, pageInfo.currentPage);

  if (!pageInfo.isExact) {
    return {
      titleCount: null,
      pageSummary: `Page ${currentPage}`,
      compactPage: `Page ${currentPage}`,
    };
  }

  const lastPage = Math.max(currentPage, pageInfo.lastPage, 1);
  const total = Math.max(0, pageInfo.total);
  const titleCount = `${total.toLocaleString("en-US")} title${total === 1 ? "" : "s"}`;

  return {
    titleCount,
    pageSummary: `Page ${currentPage} of ${lastPage} / ${titleCount}`,
    compactPage: `${currentPage} / ${lastPage}`,
  };
}
