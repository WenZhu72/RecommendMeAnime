import logging
import json
from collections.abc import Mapping
from time import monotonic

import httpx

from app.core.exceptions import AniListResponseError, AniListTimeoutError, AniListUnavailableError

logger = logging.getLogger(__name__)

SUMMARY_FIELDS = """
  id
  title { english romaji native }
  description(asHtml: false)
  coverImage { large }
  bannerImage
  averageScore
  meanScore
  popularity
  genres
  format
  status
  episodes
  duration
  season
  seasonYear
  startDate { year month day }
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  source
  countryOfOrigin
  synonyms
  siteUrl
"""

DETAIL_QUERY = f"""
query AnimeDetail($id: Int!) {{
  Media(id: $id, type: ANIME) {{
    {SUMMARY_FIELDS}
    relations {{ nodes {{ {SUMMARY_FIELDS} }} }}
    recommendations(page: 1, perPage: 10) {{
      nodes {{ mediaRecommendation {{ {SUMMARY_FIELDS} }} }}
    }}
  }}
}}
"""


def _as_mapping(value: object) -> Mapping[str, object] | None:
    return value if isinstance(value, Mapping) else None


def build_page_query_and_variables(
    *,
    page: int,
    per_page: int,
    search: str | None,
    genre: str | None,
    genre_in: list[str] | None,
    anime_format: str | None,
    format_in: list[str] | None,
    season: str | None,
    season_year: int | None,
    minimum_score: int | None,
    sort: list[str] | None,
) -> tuple[str, dict[str, object]]:
    declarations = ["$page: Int!", "$perPage: Int!"]
    arguments = ["type: ANIME"]
    variables: dict[str, object] = {"page": page, "perPage": per_page}

    def include(name: str, graph_type: str, argument: str, value: object) -> None:
        declarations.append(f"${name}: {graph_type}")
        arguments.append(f"{argument}: ${name}")
        variables[name] = value

    if search:
        include("search", "String", "search", search)
    if genre:
        include("genre", "String", "genre", genre)
    if genre_in:
        include("genreIn", "[String]", "genre_in", genre_in)
    if anime_format:
        include("format", "MediaFormat", "format", anime_format)
    if format_in:
        include("formatIn", "[MediaFormat]", "format_in", format_in)
    if season:
        include("season", "MediaSeason", "season", season)
    if season_year is not None:
        include("seasonYear", "Int", "seasonYear", season_year)
    if minimum_score is not None:
        include("minimumScore", "Int", "averageScore_greater", minimum_score)
    if sort:
        include("sort", "[MediaSort]", "sort", sort)

    query = f"""
    query AnimePage({', '.join(declarations)}) {{
      Page(page: $page, perPage: $perPage) {{
        pageInfo {{ total currentPage lastPage hasNextPage perPage }}
        media({', '.join(arguments)}) {{
          {SUMMARY_FIELDS}
        }}
      }}
    }}
    """
    return query, variables


class AniListClient:
    def __init__(self, client: httpx.AsyncClient, *, cache_ttl_seconds: int = 0) -> None:
        self._client = client
        self._cache_ttl_seconds = cache_ttl_seconds
        self._cache: dict[str, tuple[float, Mapping[str, object]]] = {}

    @staticmethod
    def _cache_key(query: str, variables: Mapping[str, object]) -> str:
        return json.dumps({"query": query, "variables": variables}, sort_keys=True, separators=(",", ":"))

    def _get_cached(self, key: str) -> Mapping[str, object] | None:
        if self._cache_ttl_seconds <= 0:
            return None
        cached = self._cache.get(key)
        if cached is None:
            return None
        expires_at, payload = cached
        if expires_at > monotonic():
            return payload
        self._cache.pop(key, None)
        return None

    def _store_cached(self, key: str, payload: Mapping[str, object]) -> None:
        if self._cache_ttl_seconds <= 0:
            return
        try:
            if len(self._cache) >= 256:
                now = monotonic()
                self._cache = {cache_key: entry for cache_key, entry in self._cache.items() if entry[0] > now}
                if len(self._cache) >= 256:
                    self._cache.pop(next(iter(self._cache)), None)
            self._cache[key] = (monotonic() + self._cache_ttl_seconds, payload)
        except Exception:
            # The cache is an optimisation only; a local cache issue must not fail a request.
            logger.warning("AniList response could not be added to the in-memory cache")

    async def _request(
        self,
        query: str,
        variables: Mapping[str, object],
    ) -> Mapping[str, object]:
        cache_key: str | None
        try:
            cache_key = self._cache_key(query, variables)
            cached = self._get_cached(cache_key)
            if cached is not None:
                return cached
        except Exception:
            cache_key = None
            logger.warning("AniList cache lookup failed; continuing without a cached response")

        try:
            response = await self._client.post("", json={"query": query, "variables": variables})
            response.raise_for_status()
        except httpx.TimeoutException as error:
            logger.warning("AniList request timed out: %s", error)
            raise AniListTimeoutError from error
        except httpx.RequestError as error:
            logger.warning("AniList request failed: %s", error)
            raise AniListUnavailableError from error
        except httpx.HTTPStatusError as error:
            logger.warning("AniList returned HTTP %s", error.response.status_code)
            raise AniListResponseError from error

        try:
            payload: object = response.json()
        except ValueError as error:
            logger.warning("AniList returned invalid JSON")
            raise AniListResponseError from error

        root = _as_mapping(payload)
        if root is None:
            logger.warning("AniList response was not a JSON object")
            raise AniListResponseError

        errors = root.get("errors")
        if isinstance(errors, list) and errors:
            logger.warning("AniList GraphQL returned errors")
            raise AniListResponseError

        data = _as_mapping(root.get("data"))
        if data is None:
            logger.warning("AniList response did not contain data")
            raise AniListResponseError
        if cache_key is not None:
            self._store_cached(cache_key, data)
        return data

    async def list_media(
        self,
        *,
        page: int,
        per_page: int,
        search: str | None = None,
        genre: str | None = None,
        genre_in: list[str] | None = None,
        anime_format: str | None = None,
        format_in: list[str] | None = None,
        season: str | None = None,
        season_year: int | None = None,
        minimum_score: int | None = None,
        sort: list[str] | None = None,
    ) -> Mapping[str, object]:
        query, variables = build_page_query_and_variables(
            page=page, per_page=per_page, search=search, genre=genre,
            genre_in=genre_in, anime_format=anime_format, format_in=format_in,
            season=season, season_year=season_year, minimum_score=minimum_score,
            sort=sort,
        )
        data = await self._request(query, variables)
        page_data = _as_mapping(data.get("Page"))
        if page_data is None:
            logger.warning("AniList page response was malformed")
            raise AniListResponseError
        return page_data

    async def get_media(self, anime_id: int) -> Mapping[str, object] | None:
        data = await self._request(DETAIL_QUERY, {"id": anime_id})
        media = data.get("Media")
        if media is None:
            return None
        mapped_media = _as_mapping(media)
        if mapped_media is None:
            logger.warning("AniList detail response was malformed")
            raise AniListResponseError
        return mapped_media
