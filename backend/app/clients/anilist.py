from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from time import monotonic
from typing import Generic, TypeVar

import httpx

from app.core.config import DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE
from app.core.exceptions import (
    AniListGraphQLError,
    AniListMalformedResponseError,
    AniListRateLimitError,
    AniListRequestError,
    AniListTimeoutError,
    AniListUnavailableError,
    AniListUpstreamError,
)
from app.services.browse_filters import BrowseFilterSet, metadata_filter_key

logger = logging.getLogger(__name__)

CATALOGUE_POLICY_VERSION = "strict-non-adult-v1"
CACHE_MAX_ENTRIES = 256

SUMMARY_FIELDS = """
  id
  title { english romaji native }
  description(asHtml: false)
  coverImage { extraLarge large color }
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
  isAdult
"""

DETAIL_QUERY = f"""
query AnimeDetail($id: Int!) {{
  Media(id: $id, type: ANIME, isAdult: false) {{
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


def _is_missing_media_response(response: httpx.Response) -> bool:
    """Recognise AniList's GraphQL payload for an absent ``Media(id: ...)``.

    A generic HTTP 404 can also be caused by a bad upstream URL or proxy. Only
    AniList's structured GraphQL error is an expected missing anime.
    """

    if response.status_code != 404:
        return False
    try:
        payload: object = response.json()
    except ValueError:
        return False
    root = _as_mapping(payload)
    errors = root.get("errors") if root else None
    return isinstance(errors, list) and any(
        (error := _as_mapping(item))
        and error.get("status") == 404
        and isinstance(error.get("message"), str)
        and error["message"].strip().casefold() == "not found."
        for item in errors
    )


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
    arguments = ["type: ANIME", "isAdult: false"]
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


def build_page_query_identity(
    *,
    search: str | None,
    genre: str | None,
    genre_in: list[str] | None,
    anime_format: str | None,
    format_in: list[str] | None,
    season: str | None,
    season_year: int | None,
    minimum_score: int | None,
    sort: list[str] | None,
    per_page: int | None = None,
) -> str:
    """Compatibility wrapper around the central Browse canonical-key helper."""

    filters = BrowseFilterSet.create(
        search=search,
        genres=[value for value in [genre, *(genre_in or [])] if value],
        anime_format=anime_format,
        season=season,
        season_year=season_year,
        minimum_score=minimum_score,
        sort=sort,
        per_page=per_page or 20,
    )
    identity = metadata_filter_key(filters)
    if format_in:
        normalised_formats = sorted({value.strip().upper() for value in format_in if value.strip()})
        identity = f"{identity}|formats={','.join(normalised_formats)}"
    return identity


def _identity_hash(identity: str | None) -> str | None:
    return sha256(identity.encode("utf-8")).hexdigest()[:12] if identity is not None else None


@dataclass(frozen=True)
class ExactPaginationMetadata:
    total: int
    is_exact: bool = True


@dataclass(frozen=True)
class ExactPaginationUnavailable:
    max_probe_page: int
    reason: str = "anilist_result_window_exceeded"
    is_exact: bool = False


ExactPaginationResult = ExactPaginationMetadata | ExactPaginationUnavailable


@dataclass(frozen=True)
class _ExactPaginationFailure:
    error: Exception


ValueT = TypeVar("ValueT")


@dataclass(frozen=True)
class _CacheEntry(Generic[ValueT]):
    value: ValueT
    fresh_until: float
    stale_until: float


class InMemoryTtlCache(Generic[ValueT]):
    """Small process-local TTL cache with optional stale-if-error retention."""

    def __init__(self, *, max_entries: int = CACHE_MAX_ENTRIES) -> None:
        self._entries: dict[str, _CacheEntry[ValueT]] = {}
        self._max_entries = max_entries

    def get_fresh(self, key: str) -> ValueT | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.fresh_until > monotonic():
            return entry.value
        if entry.stale_until <= monotonic():
            self._entries.pop(key, None)
        return None

    def get_stale(self, key: str) -> ValueT | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.stale_until > monotonic():
            return entry.value
        self._entries.pop(key, None)
        return None

    def set(self, key: str, value: ValueT, *, ttl_seconds: int, stale_seconds: int = 0) -> None:
        if ttl_seconds <= 0:
            return
        now = monotonic()
        if len(self._entries) >= self._max_entries:
            self._entries = {cache_key: entry for cache_key, entry in self._entries.items() if entry.stale_until > now}
            if len(self._entries) >= self._max_entries:
                self._entries.pop(next(iter(self._entries)), None)
        self._entries[key] = _CacheEntry(
            value=value,
            fresh_until=now + ttl_seconds,
            stale_until=now + ttl_seconds + stale_seconds,
        )


@dataclass(frozen=True)
class _RequestContext:
    operation_name: str
    requested_page: int | None
    per_page: int | None
    filter_key_hash: str | None


class AniListClient:
    def __init__(
        self,
        client: httpx.AsyncClient,
        *,
        cache_ttl_seconds: int = 0,
        exact_pagination_cache_ttl_seconds: int | None = None,
        exact_probe_response_wait_seconds: float = 3,
        exact_probe_max_page: int = DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE,
        stale_if_error_seconds: int = 0,
        max_concurrency: int = 4,
        max_retries: int = 1,
        retry_fallback_seconds: float = 1,
        max_retry_delay_seconds: float = 30,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._client = client
        self._cache_ttl_seconds = cache_ttl_seconds
        self._exact_pagination_cache_ttl_seconds = (
            cache_ttl_seconds
            if exact_pagination_cache_ttl_seconds is None
            else exact_pagination_cache_ttl_seconds
        )
        self._exact_probe_response_wait_seconds = exact_probe_response_wait_seconds
        self._exact_probe_max_page = exact_probe_max_page
        self._stale_if_error_seconds = stale_if_error_seconds
        self._max_retries = max_retries
        self._retry_fallback_seconds = retry_fallback_seconds
        self._max_retry_delay_seconds = max_retry_delay_seconds
        self._sleep = sleep
        self._response_cache: InMemoryTtlCache[Mapping[str, object]] = InMemoryTtlCache()
        self._exact_pagination_cache: InMemoryTtlCache[ExactPaginationResult] = InMemoryTtlCache()
        self._exact_pagination_inflight: dict[
            str,
            asyncio.Task[ExactPaginationResult | _ExactPaginationFailure],
        ] = {}
        self._exact_pagination_lock = asyncio.Lock()
        self._request_semaphore = asyncio.Semaphore(max_concurrency)
        self._rate_limit_lock = asyncio.Lock()
        self._rate_limited_until = 0.0

    @staticmethod
    def _cache_key(query: str, variables: Mapping[str, object]) -> str:
        return json.dumps(
            {
                "cataloguePolicy": CATALOGUE_POLICY_VERSION,
                "query": query,
                "variables": variables,
            },
            sort_keys=True,
            separators=(",", ":"),
        )

    @property
    def exact_probe_max_page(self) -> int:
        return self._exact_probe_max_page

    def get_cached_exact_pagination(self, query_identity: str) -> ExactPaginationResult | None:
        try:
            return self._exact_pagination_cache.get_fresh(query_identity)
        except Exception:
            logger.warning(
                "Exact pagination cache lookup failed filter_key=%s",
                _identity_hash(query_identity),
            )
            return None

    def store_exact_pagination(
        self,
        query_identity: str,
        *,
        total: int,
        last_page: int | None = None,
    ) -> None:
        # last_page is derived per visible page size; accept the old argument so
        # existing callers can migrate without maintaining duplicate cache data.
        del last_page
        try:
            self._exact_pagination_cache.set(
                query_identity,
                ExactPaginationMetadata(total=total),
                ttl_seconds=self._exact_pagination_cache_ttl_seconds,
            )
        except Exception:
            logger.warning(
                "Exact pagination metadata could not be cached filter_key=%s",
                _identity_hash(query_identity),
            )

    def store_exact_pagination_unavailable(self, query_identity: str, *, max_probe_page: int) -> None:
        try:
            self._exact_pagination_cache.set(
                query_identity,
                ExactPaginationUnavailable(max_probe_page=max_probe_page),
                ttl_seconds=self._exact_pagination_cache_ttl_seconds,
            )
        except Exception:
            logger.warning(
                "Exact pagination unavailable state could not be cached filter_key=%s",
                _identity_hash(query_identity),
            )

    async def resolve_exact_pagination(
        self,
        query_identity: str,
        resolver: Callable[[], Awaitable[ExactPaginationResult]],
        *,
        response_wait_seconds: float | None = None,
    ) -> ExactPaginationResult:
        """Return exact metadata while bounding only this caller's wait."""

        cached = self.get_cached_exact_pagination(query_identity)
        if cached is not None:
            return cached

        async with self._exact_pagination_lock:
            cached = self.get_cached_exact_pagination(query_identity)
            if cached is not None:
                return cached
            task = self._exact_pagination_inflight.get(query_identity)
            if task is None:

                async def run() -> ExactPaginationResult | _ExactPaginationFailure:
                    try:
                        result = await resolver()
                        if isinstance(result, ExactPaginationMetadata):
                            self.store_exact_pagination(query_identity, total=result.total)
                        else:
                            self.store_exact_pagination_unavailable(
                                query_identity,
                                max_probe_page=result.max_probe_page,
                            )
                            logger.info(
                                "Exact pagination unavailable reason=anilist_result_window_exceeded "
                                "filter_key=%s max_probe_page=%d",
                                _identity_hash(query_identity),
                                result.max_probe_page,
                            )
                        return result
                    except asyncio.CancelledError:
                        logger.info(
                            "Exact pagination shared task was cancelled filter_key=%s",
                            _identity_hash(query_identity),
                        )
                        raise
                    except Exception as error:
                        # Shared tasks return failures as values so a background
                        # exception can never leak through an abandoned Future.
                        logger.warning(
                            "Exact pagination shared task failed filter_key=%s category=%s",
                            _identity_hash(query_identity),
                            type(error).__name__,
                        )
                        return _ExactPaginationFailure(error=error)
                    finally:
                        current = asyncio.current_task()
                        async with self._exact_pagination_lock:
                            if self._exact_pagination_inflight.get(query_identity) is current:
                                self._exact_pagination_inflight.pop(query_identity, None)

                task = asyncio.create_task(run())
                self._exact_pagination_inflight[query_identity] = task

        wait_seconds = (
            self._exact_probe_response_wait_seconds
            if response_wait_seconds is None
            else response_wait_seconds
        )
        done, _ = await asyncio.wait({task}, timeout=wait_seconds)
        if task not in done:
            logger.info(
                "Exact pagination response wait exceeded filter_key=%s wait_seconds=%.3f",
                _identity_hash(query_identity),
                wait_seconds,
            )
            raise TimeoutError

        outcome = task.result()
        if isinstance(outcome, _ExactPaginationFailure):
            raise outcome.error
        return outcome

    @staticmethod
    def _parse_retry_after(value: str | None) -> float | None:
        if value is None:
            return None
        try:
            return max(0.0, float(value.strip()))
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(value)
            except (TypeError, ValueError, OverflowError):
                return None
            if retry_at.tzinfo is None:
                retry_at = retry_at.replace(tzinfo=timezone.utc)
            return max(0.0, (retry_at - datetime.now(timezone.utc)).total_seconds())

    async def _set_rate_limit_cooldown(self, delay: float) -> None:
        async with self._rate_limit_lock:
            self._rate_limited_until = max(self._rate_limited_until, monotonic() + delay)

    async def _wait_for_rate_limit_cooldown(self) -> None:
        # Holding this lock while sleeping creates one shared gate, preventing a
        # burst of independent retries when several calls observe the same 429.
        async with self._rate_limit_lock:
            delay = max(0.0, self._rate_limited_until - monotonic())
            if delay > 0:
                await self._sleep(delay)
            self._rate_limited_until = 0.0

    @staticmethod
    def _log_context(context: _RequestContext) -> tuple[object, ...]:
        return (
            context.operation_name,
            context.requested_page,
            context.per_page,
            context.filter_key_hash,
        )

    async def _post_with_retry(
        self,
        query: str,
        variables: Mapping[str, object],
        context: _RequestContext,
    ) -> httpx.Response:
        parsed_retry_after: float | None = None
        for attempt_index in range(self._max_retries + 1):
            await self._wait_for_rate_limit_cooldown()
            try:
                async with self._request_semaphore:
                    response = await self._client.post("", json={"query": query, "variables": variables})
            except httpx.TimeoutException as error:
                logger.warning(
                    "AniList request failed operation=%s status=None rate_limited=false retry_after=None "
                    "attempt=%d page=%s per_page=%s filter_key=%s category=timeout",
                    context.operation_name,
                    attempt_index + 1,
                    context.requested_page,
                    context.per_page,
                    context.filter_key_hash,
                )
                raise AniListTimeoutError from error
            except httpx.RequestError as error:
                logger.warning(
                    "AniList request failed operation=%s status=None rate_limited=false retry_after=None "
                    "attempt=%d page=%s per_page=%s filter_key=%s category=network",
                    context.operation_name,
                    attempt_index + 1,
                    context.requested_page,
                    context.per_page,
                    context.filter_key_hash,
                )
                raise AniListUnavailableError from error

            if response.status_code != 429:
                return response

            parsed_retry_after = self._parse_retry_after(response.headers.get("Retry-After"))
            fallback = self._retry_fallback_seconds * (2**attempt_index)
            delay = min(
                parsed_retry_after if parsed_retry_after is not None else fallback,
                self._max_retry_delay_seconds,
            )
            logger.warning(
                "AniList request failed operation=%s status=429 rate_limited=true retry_after=%s "
                "attempt=%d page=%s per_page=%s filter_key=%s category=rate_limit",
                context.operation_name,
                parsed_retry_after,
                attempt_index + 1,
                context.requested_page,
                context.per_page,
                context.filter_key_hash,
            )
            await self._set_rate_limit_cooldown(delay)
            if attempt_index >= self._max_retries:
                raise AniListRateLimitError(
                    retry_after=parsed_retry_after,
                    attempts=attempt_index + 1,
                )

        raise AniListRateLimitError(retry_after=parsed_retry_after, attempts=self._max_retries + 1)

    async def _request(
        self,
        query: str,
        variables: Mapping[str, object],
        *,
        context: _RequestContext,
        return_none_on_not_found: bool = False,
    ) -> Mapping[str, object] | None:
        cache_key: str | None
        try:
            cache_key = self._cache_key(query, variables)
            cached = self._response_cache.get_fresh(cache_key)
            if cached is not None:
                return cached
        except Exception:
            cache_key = None
            logger.warning(
                "AniList response cache lookup failed operation=%s page=%s per_page=%s filter_key=%s",
                *self._log_context(context),
            )

        try:
            response = await self._post_with_retry(query, variables, context)

            if return_none_on_not_found and _is_missing_media_response(response):
                logger.info("AniList did not find requested anime detail")
                return None

            if response.status_code >= 500:
                logger.warning(
                    "AniList request failed operation=%s status=%d rate_limited=false retry_after=None "
                    "attempt=1 page=%s per_page=%s filter_key=%s category=upstream_5xx",
                    context.operation_name,
                    response.status_code,
                    context.requested_page,
                    context.per_page,
                    context.filter_key_hash,
                )
                raise AniListUpstreamError(response.status_code)
            if response.status_code >= 400:
                logger.warning(
                    "AniList request failed operation=%s status=%d rate_limited=false retry_after=None "
                    "attempt=1 page=%s per_page=%s filter_key=%s category=invalid_request",
                    context.operation_name,
                    response.status_code,
                    context.requested_page,
                    context.per_page,
                    context.filter_key_hash,
                )
                raise AniListRequestError(response.status_code)
        except AniListUnavailableError:
            stale = self._response_cache.get_stale(cache_key) if cache_key is not None else None
            if stale is not None:
                logger.warning(
                    "Serving stale AniList response operation=%s page=%s per_page=%s filter_key=%s",
                    *self._log_context(context),
                )
                return stale
            raise

        try:
            payload: object = response.json()
        except ValueError as error:
            logger.warning(
                "AniList request failed operation=%s status=%d page=%s per_page=%s filter_key=%s "
                "category=malformed_json",
                context.operation_name,
                response.status_code,
                context.requested_page,
                context.per_page,
                context.filter_key_hash,
            )
            raise AniListMalformedResponseError from error

        root = _as_mapping(payload)
        if root is None:
            logger.warning(
                "AniList request failed operation=%s status=%d page=%s per_page=%s filter_key=%s "
                "category=malformed_root",
                context.operation_name,
                response.status_code,
                context.requested_page,
                context.per_page,
                context.filter_key_hash,
            )
            raise AniListMalformedResponseError

        errors = root.get("errors")
        if isinstance(errors, list) and errors:
            logger.warning(
                "AniList request failed operation=%s status=%d page=%s per_page=%s filter_key=%s "
                "category=graphql error_count=%d",
                context.operation_name,
                response.status_code,
                context.requested_page,
                context.per_page,
                context.filter_key_hash,
                len(errors),
            )
            raise AniListGraphQLError

        data = _as_mapping(root.get("data"))
        if data is None:
            logger.warning(
                "AniList request failed operation=%s status=%d page=%s per_page=%s filter_key=%s "
                "category=missing_data",
                context.operation_name,
                response.status_code,
                context.requested_page,
                context.per_page,
                context.filter_key_hash,
            )
            raise AniListMalformedResponseError
        if cache_key is not None:
            try:
                self._response_cache.set(
                    cache_key,
                    data,
                    ttl_seconds=self._cache_ttl_seconds,
                    stale_seconds=self._stale_if_error_seconds,
                )
            except Exception:
                logger.warning(
                    "AniList response could not be cached operation=%s page=%s per_page=%s filter_key=%s",
                    *self._log_context(context),
                )
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
        return await self.list_media_for_operation(
            operation_name="anime_page_fetch",
            page=page,
            per_page=per_page,
            search=search,
            genre=genre,
            genre_in=genre_in,
            anime_format=anime_format,
            format_in=format_in,
            season=season,
            season_year=season_year,
            minimum_score=minimum_score,
            sort=sort,
        )

    async def list_media_for_operation(
        self,
        *,
        operation_name: str,
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
            page=page,
            per_page=per_page,
            search=search,
            genre=genre,
            genre_in=genre_in,
            anime_format=anime_format,
            format_in=format_in,
            season=season,
            season_year=season_year,
            minimum_score=minimum_score,
            sort=sort,
        )
        identity = build_page_query_identity(
            search=search,
            genre=genre,
            genre_in=genre_in,
            anime_format=anime_format,
            format_in=format_in,
            season=season,
            season_year=season_year,
            minimum_score=minimum_score,
            sort=sort,
            per_page=per_page,
        )
        context = _RequestContext(
            operation_name=operation_name,
            requested_page=page,
            per_page=per_page,
            filter_key_hash=_identity_hash(identity),
        )
        data = await self._request(query, variables, context=context)
        if data is None:
            raise AniListMalformedResponseError
        page_data = _as_mapping(data.get("Page"))
        if (
            page_data is None
            or _as_mapping(page_data.get("pageInfo")) is None
            or not isinstance(page_data.get("media"), list)
        ):
            logger.warning(
                "AniList request failed operation=%s status=200 page=%s per_page=%s filter_key=%s "
                "category=malformed_page",
                operation_name,
                page,
                per_page,
                context.filter_key_hash,
            )
            raise AniListMalformedResponseError
        return page_data

    async def get_media(self, anime_id: int) -> Mapping[str, object] | None:
        data = await self._request(
            DETAIL_QUERY,
            {"id": anime_id},
            context=_RequestContext(
                operation_name="anime_detail",
                requested_page=None,
                per_page=None,
                filter_key_hash=None,
            ),
            return_none_on_not_found=True,
        )
        if data is None:
            return None
        media = data.get("Media")
        if media is None:
            return None
        mapped_media = _as_mapping(media)
        if mapped_media is None:
            logger.warning("AniList request failed operation=anime_detail status=200 category=malformed_media")
            raise AniListMalformedResponseError
        return mapped_media
