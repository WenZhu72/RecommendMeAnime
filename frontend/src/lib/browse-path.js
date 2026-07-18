/**
 * @typedef {object} BrowsePathOptions
 * @property {number=} page
 * @property {number=} perPage
 * @property {string=} search
 * @property {string=} genre
 * @property {string[]=} genres
 * @property {"TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL"=} format
 * @property {"WINTER" | "SPRING" | "SUMMER" | "FALL"=} season
 * @property {number=} seasonYear
 * @property {number=} minimumScore
 * @property {"trending" | "popular" | "top-rated"=} sort
 */

/**
 * Build the one authoritative API identity for a Browse response. The stable
 * field order is intentional: the same identity keys the request, results,
 * result count, and pagination metadata.
 *
 * @param {BrowsePathOptions} [options]
 */
export function buildBrowseAnimePath(options = {}) {
  const query = new URLSearchParams();

  function set(name, value) {
    if (value !== undefined && value !== "") query.set(name, String(value));
  }

  set("search", options.search);
  const genres = options.genres ?? (options.genre ? [options.genre] : []);
  genres.forEach((genre) => {
    if (genre) query.append("genre", genre);
  });
  set("format", options.format);
  set("season", options.season);
  set("season_year", options.seasonYear);
  set("minimum_score", options.minimumScore);
  set("sort", options.sort);
  set("page", options.page ?? 1);
  set("per_page", options.perPage ?? 20);

  return `/api/anime/browse?${query.toString()}`;
}

/**
 * Convert the public Browse URL state to the same canonical identity used by
 * the server request. This lets client history navigation hide a response
 * whose URL state has already changed but whose replacement has not arrived.
 *
 * @param {URLSearchParams | string} source
 */
export function buildBrowseAnimePathFromLocation(source) {
  const parameters = new URLSearchParams(source.toString());
  const formats = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
  const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const sorts = ["trending", "popular", "top-rated"];

  function positiveInteger(name, fallback) {
    const parsed = Number(parameters.get(name));
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  const rawYear = positiveInteger("year", 0);
  const rawScore = positiveInteger("minimumScore", 0);
  const rawFormat = parameters.get("format") ?? "";
  const rawSeason = parameters.get("season") ?? "";
  const rawSort = parameters.get("sort") ?? "";

  return buildBrowseAnimePath({
    search: parameters.get("search")?.trim() || undefined,
    genres: parameters.getAll("genre").map((genre) => genre.trim()).filter(Boolean),
    format: formats.includes(rawFormat) ? rawFormat : undefined,
    season: seasons.includes(rawSeason) ? rawSeason : undefined,
    seasonYear: rawYear >= 1940 && rawYear <= 2100 ? rawYear : undefined,
    minimumScore: rawScore >= 1 && rawScore <= 100 ? rawScore : undefined,
    sort: sorts.includes(rawSort) ? rawSort : "popular",
    page: positiveInteger("page", 1),
    perPage: 20,
  });
}

/**
 * Return a Browse URL for a submitted filter change. Page is always removed,
 * so a new search/filter/sort begins at the authoritative first page.
 *
 * @param {URLSearchParams | string} source
 */
export function buildBrowseLocation(source) {
  const parameters = new URLSearchParams(source.toString());
  parameters.delete("page");
  return `/browse${parameters.size ? `?${parameters.toString()}` : ""}`;
}

/**
 * Build the single public destination for title searches across the app.
 *
 * @param {string} search
 */
export function buildBrowseSearchLocation(search) {
  const cleaned = search.trim();
  if (!cleaned) return "/browse";
  const parameters = new URLSearchParams({ search: cleaned });
  return `/browse?${parameters.toString()}`;
}
