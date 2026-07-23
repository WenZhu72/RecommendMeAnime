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
 * Return a copy of Browse URL state with one parameter updated.
 *
 * @param {URLSearchParams | string} source
 * @param {string} name
 * @param {string} value
 */
export function updateBrowseParameter(source, name, value) {
  const parameters = new URLSearchParams(source.toString());
  if (value) parameters.set(name, value);
  else parameters.delete(name);
  return parameters;
}

/**
 * Return a copy of Browse URL state with its repeated genre parameters updated.
 *
 * @param {URLSearchParams | string} source
 * @param {string[]} genres
 */
export function updateBrowseGenres(source, genres) {
  const parameters = new URLSearchParams(source.toString());
  parameters.delete("genre");
  genres.forEach((genre) => {
    if (genre) parameters.append("genre", genre);
  });
  return parameters;
}

/**
 * Toggle an exact year selection. Selecting the active year clears it.
 *
 * @param {string} currentYear
 * @param {string} selectedYear
 */
export function toggleBrowseYear(currentYear, selectedYear) {
  return currentYear === selectedYear ? "" : selectedYear;
}

/**
 * Build a paginated Browse URL without dropping active filters.
 *
 * @param {string} pathname
 * @param {URLSearchParams | string} source
 * @param {number} page
 */
export function buildBrowsePageLocation(pathname, source, page) {
  const parameters = new URLSearchParams(source.toString());
  if (page === 1) parameters.delete("page");
  else parameters.set("page", String(page));
  return `${pathname}${parameters.size ? `?${parameters.toString()}` : ""}`;
}

/**
 * Resolve a public Browse href to its canonical API response identity.
 *
 * @param {string} href
 */
export function buildBrowseRequestKeyFromHref(href) {
  return buildBrowseAnimePathFromLocation(buildBrowseParametersFromHref(href));
}

/**
 * Read the search parameters from a relative or absolute Browse href.
 *
 * @param {string} href
 */
export function buildBrowseParametersFromHref(href) {
  const queryStart = href.indexOf("?");
  const query = queryStart === -1 ? "" : href.slice(queryStart + 1).split("#", 1)[0];
  return new URLSearchParams(query);
}

/**
 * Resolve the URL state the Browse controls should display. While a route is
 * pending, its destination is authoritative so triggers do not show stale
 * values until the server response commits.
 *
 * @param {URLSearchParams | string} current
 * @param {string | null} targetHref
 */
export function getBrowseNavigationParameters(current, targetHref) {
  return targetHref
    ? buildBrowseParametersFromHref(targetHref)
    : new URLSearchParams(current.toString());
}

/**
 * Suppress repeat pushes to either the committed or already-requested response.
 *
 * @param {string} currentRequestKey
 * @param {string | null} targetRequestKey
 * @param {string} nextRequestKey
 */
export function shouldNavigateBrowse(currentRequestKey, targetRequestKey, nextRequestKey) {
  if (nextRequestKey === targetRequestKey) return false;
  return targetRequestKey !== null || nextRequestKey !== currentRequestKey;
}

/**
 * Keep loading visible until the rendered response belongs to the latest target.
 *
 * @param {{
 *   transitionPending: boolean,
 *   currentRequestKey: string,
 *   targetRequestKey: string | null,
 *   responseKey: string,
 * }} state
 */
export function shouldShowBrowseFallback({
  transitionPending,
  currentRequestKey,
  targetRequestKey,
  responseKey,
}) {
  const expectedRequestKey = targetRequestKey ?? currentRequestKey;
  return transitionPending || responseKey !== expectedRequestKey;
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
