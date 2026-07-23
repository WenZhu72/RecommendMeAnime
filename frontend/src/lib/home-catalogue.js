const HOME_CATALOGUE_ENDPOINTS = {
  trending: "/api/anime/trending",
  popular: "/api/anime/popular",
  "top-rated": "/api/anime/top-rated",
};

/**
 * Build a lightweight home catalogue request. These endpoints return AniList
 * page metadata as-is and never enter Browse's exact-pagination path.
 *
 * @param {"trending" | "popular" | "top-rated"} collection
 * @param {{ page?: number, perPage?: number }} [options]
 */
export function buildHomeCataloguePath(collection, options = {}) {
  const query = new URLSearchParams({
    page: String(options.page ?? 1),
    per_page: String(options.perPage ?? 12),
  });
  return `${HOME_CATALOGUE_ENDPOINTS[collection]}?${query.toString()}`;
}
