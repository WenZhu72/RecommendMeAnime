import logging
from collections.abc import Mapping
from hashlib import sha256

from app.clients.anilist import (
    AniListClient,
    ExactPaginationMetadata,
    ExactPaginationResult,
    ExactPaginationUnavailable,
    build_page_query_identity,
)
from app.core.config import DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE
from app.core.exceptions import (
    AniListError,
    AniListMalformedResponseError,
    AniListResponseError,
    AnimeNotFoundError,
)
from app.schemas.anime import Anime, AnimeDate, AnimeListResponse, AnimeTitle, PageInfo

SORTS = {
    "trending": ["TRENDING_DESC", "POPULARITY_DESC"],
    "popular": ["POPULARITY_DESC"],
    "top-rated": ["SCORE_DESC", "POPULARITY_DESC"],
    "search": ["SEARCH_MATCH", "POPULARITY_DESC"],
}

MAX_ANILIST_PAGE = 250
EXACT_PROBE_PER_PAGE = 50
logger = logging.getLogger(__name__)


def _mapping(value: object) -> Mapping[str, object] | None:
    return value if isinstance(value, Mapping) else None


def _string(value: object) -> str | None:
    return value if isinstance(value, str) else None


def _integer(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _strings(value: object) -> list[str]:
    return [item for item in value if isinstance(item, str)] if isinstance(value, list) else []


def _date(value: object) -> AnimeDate | None:
    date = _mapping(value)
    if date is None:
        return None
    parsed = AnimeDate(year=_integer(date.get("year")), month=_integer(date.get("month")), day=_integer(date.get("day")))
    return parsed if any((parsed.year, parsed.month, parsed.day)) else None


def _studios(value: object) -> list[str]:
    studios = _mapping(value)
    nodes = studios.get("nodes") if studios else None
    return [name for node in nodes if (mapped := _mapping(node)) and (name := _string(mapped.get("name")))] if isinstance(nodes, list) else []


def is_safe_catalogue_anime(media: object) -> bool:
    """Return whether AniList explicitly marks a media item as non-adult."""

    mapped = _mapping(media)
    return mapped is not None and mapped.get("isAdult") is False


def map_anime(raw: Mapping[str, object], *, include_related: bool = False) -> Anime:
    raw_title = _mapping(raw.get("title")) or {}
    titles = AnimeTitle(
        english=_string(raw_title.get("english")),
        romaji=_string(raw_title.get("romaji")),
        native=_string(raw_title.get("native")),
    )
    cover = _mapping(raw.get("coverImage"))
    anime = Anime(
        id=_integer(raw.get("id")) or 0,
        title=titles.english or titles.romaji or titles.native or "Untitled anime",
        titles=titles,
        description=_string(raw.get("description")),
        cover_image=(_string(cover.get("extraLarge")) or _string(cover.get("large"))) if cover else None,
        color=_string(cover.get("color")) if cover else None,
        banner_image=_string(raw.get("bannerImage")),
        average_score=_integer(raw.get("averageScore")),
        mean_score=_integer(raw.get("meanScore")),
        popularity=_integer(raw.get("popularity")),
        genres=_strings(raw.get("genres")),
        format=_string(raw.get("format")),
        status=_string(raw.get("status")),
        episodes=_integer(raw.get("episodes")),
        duration=_integer(raw.get("duration")),
        season=_string(raw.get("season")),
        season_year=_integer(raw.get("seasonYear")),
        start_date=_date(raw.get("startDate")),
        end_date=_date(raw.get("endDate")),
        studios=_studios(raw.get("studios")),
        source=_string(raw.get("source")),
        country_of_origin=_string(raw.get("countryOfOrigin")),
        synonyms=_strings(raw.get("synonyms")),
        site_url=_string(raw.get("siteUrl")),
        is_adult=False,
    )
    if not include_related:
        return anime

    relations = _mapping(raw.get("relations"))
    relation_nodes = relations.get("nodes") if relations else None
    anime.relations = [
        map_anime(item)
        for item in relation_nodes
        if isinstance(item, Mapping) and is_safe_catalogue_anime(item)
    ] if isinstance(relation_nodes, list) else []
    recommendation_data = _mapping(raw.get("recommendations"))
    nodes = recommendation_data.get("nodes", []) if recommendation_data else []
    anime.recommendations = [
        map_anime(media)
        for node in nodes
        if (mapped := _mapping(node))
        and (media := _mapping(mapped.get("mediaRecommendation")))
        and is_safe_catalogue_anime(media)
    ] if isinstance(nodes, list) else []
    return anime


def _page_info(raw: Mapping[str, object], fallback_page: int, fallback_per_page: int) -> PageInfo:
    info = _mapping(raw.get("pageInfo"))
    if info is None:
        raise AniListResponseError

    current_page = _integer(info.get("currentPage")) or fallback_page
    has_next_page = bool(info.get("hasNextPage"))
    per_page = _integer(info.get("perPage")) or fallback_per_page
    media = _page_media(raw)
    is_exact = not has_next_page and current_page < MAX_ANILIST_PAGE and (bool(media) or current_page == 1)

    return PageInfo(
        current_page=current_page,
        has_next_page=has_next_page,
        last_page=current_page if is_exact else (_integer(info.get("lastPage")) or fallback_page),
        per_page=per_page,
        total=((current_page - 1) * per_page + len(media)) if is_exact else (_integer(info.get("total")) or 0),
        is_exact=is_exact,
    )


def _inexact_page_info(raw: Mapping[str, object], fallback_page: int, fallback_per_page: int) -> PageInfo:
    info = _mapping(raw.get("pageInfo"))
    if info is None:
        raise AniListMalformedResponseError
    current_page = _integer(info.get("currentPage")) or fallback_page
    per_page = _integer(info.get("perPage")) or fallback_per_page
    has_next_page = bool(info.get("hasNextPage"))
    return PageInfo(
        current_page=current_page,
        has_next_page=has_next_page,
        # The schema keeps these fields for frontend compatibility, but capped
        # AniList totals must never be presented as verified pagination.
        last_page=current_page + (1 if has_next_page else 0),
        per_page=per_page,
        total=0,
        is_exact=False,
    )


def _page_media(raw: Mapping[str, object]) -> list[object]:
    media = raw.get("media")
    if not isinstance(media, list):
        raise AniListResponseError
    return media


def _has_next_page(raw: Mapping[str, object]) -> bool:
    info = _mapping(raw.get("pageInfo"))
    if info is None:
        raise AniListResponseError
    return bool(info.get("hasNextPage"))


def _verified_page_info(
    raw_page: Mapping[str, object],
    *,
    page: int,
    per_page: int,
    last_page: int,
    total: int,
) -> PageInfo:
    current_info = _mapping(raw_page.get("pageInfo"))
    if current_info is None:
        raise AniListResponseError
    current_page = _integer(current_info.get("currentPage")) or page
    return PageInfo(
        current_page=current_page,
        has_next_page=current_page < last_page,
        last_page=last_page,
        per_page=_integer(current_info.get("perPage")) or per_page,
        total=total,
        is_exact=True,
    )


async def _list_media_for_operation(
    client: AniListClient,
    *,
    operation_name: str,
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
) -> Mapping[str, object]:
    parameters = {
        "page": page,
        "per_page": per_page,
        "search": search,
        "genre": genre,
        "genre_in": genre_in,
        "anime_format": anime_format,
        "format_in": format_in,
        "season": season,
        "season_year": season_year,
        "minimum_score": minimum_score,
        "sort": sort,
    }
    operation_request = getattr(client, "list_media_for_operation", None)
    if callable(operation_request):
        return await operation_request(operation_name=operation_name, **parameters)
    return await client.list_media(**parameters)


async def _probe_exact_pagination(
    client: AniListClient,
    *,
    max_probe_page: int,
    search: str | None,
    genre: str | None,
    genre_in: list[str] | None,
    anime_format: str | None,
    format_in: list[str] | None,
    season: str | None,
    season_year: int | None,
    minimum_score: int | None,
    sort: list[str] | None,
) -> ExactPaginationResult:
    """Resolve exact totals from AniList's reliable page boundary.

    AniList documents ``total`` and ``lastPage`` as degraded fields. Its
    ``hasNextPage`` value remains reliable, so probes locate the first page
    without a successor and derive the exact total from that final page. Every
    probe uses the complete filter and sort set from the requested response.
    """

    pages: dict[int, Mapping[str, object]] = {}

    async def fetch(candidate: int) -> Mapping[str, object]:
        cached = pages.get(candidate)
        if cached is not None:
            return cached
        result = await _list_media_for_operation(
            client,
            operation_name="exact_count_probe",
            page=candidate,
            per_page=EXACT_PROBE_PER_PAGE,
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
        pages[candidate] = result
        return result

    first_page = await fetch(1)
    first_media = _page_media(first_page)
    if not _has_next_page(first_page):
        if max_probe_page == 1 and len(first_media) >= EXACT_PROBE_PER_PAGE:
            return ExactPaginationUnavailable(max_probe_page=max_probe_page)
        return ExactPaginationMetadata(total=len(first_media))
    if max_probe_page == 1:
        return ExactPaginationUnavailable(max_probe_page=max_probe_page)

    lower = 1
    step = 1
    upper = min(lower + step, max_probe_page)
    upper_page = await fetch(upper)
    while _has_next_page(upper_page) and upper < max_probe_page:
        lower = upper
        step *= 2
        upper = min(lower + step, max_probe_page)
        upper_page = await fetch(upper)

    # A full final accessible page cannot distinguish exactly 5,000 matches
    # from a broader result set hidden beyond AniList's public result window.
    if upper == max_probe_page and (
        _has_next_page(upper_page) or len(_page_media(upper_page)) >= EXACT_PROBE_PER_PAGE
    ):
        return ExactPaginationUnavailable(max_probe_page=max_probe_page)

    while upper - lower > 1:
        middle = (lower + upper) // 2
        middle_page = await fetch(middle)
        if _has_next_page(middle_page):
            lower = middle
        else:
            upper = middle
            upper_page = middle_page

    last_page = upper
    final_page = upper_page

    total = (last_page - 1) * EXACT_PROBE_PER_PAGE + len(_page_media(final_page))
    return ExactPaginationMetadata(total=total)


def _cached_result(value: object) -> ExactPaginationResult | None:
    if isinstance(value, (ExactPaginationMetadata, ExactPaginationUnavailable)):
        return value
    # Compatibility with the previous process-local cache shape: (last_page, total).
    if isinstance(value, tuple) and len(value) == 2 and isinstance(value[1], int):
        return ExactPaginationMetadata(total=value[1])
    return None


async def _exact_page_info(
    client: AniListClient,
    raw_page: Mapping[str, object],
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
) -> PageInfo:
    query_identity = build_page_query_identity(
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
    max_probe_page = getattr(client, "exact_probe_max_page", DEFAULT_ANILIST_EXACT_PROBE_MAX_PAGE)
    cache_reader = getattr(client, "get_cached_exact_pagination", None)
    cached = _cached_result(cache_reader(query_identity) if callable(cache_reader) else None)
    if cached is not None:
        if isinstance(cached, ExactPaginationUnavailable):
            return _inexact_page_info(raw_page, page, per_page)
        last_page = max(1, (cached.total + per_page - 1) // per_page)
        return _verified_page_info(
            raw_page,
            page=page,
            per_page=per_page,
            last_page=last_page,
            total=cached.total,
        )

    async def probe() -> ExactPaginationResult:
        return await _probe_exact_pagination(
            client,
            max_probe_page=max_probe_page,
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

    try:
        single_flight = getattr(client, "resolve_exact_pagination", None)
        resolved = await single_flight(query_identity, probe) if callable(single_flight) else await probe()
    except TimeoutError:
        logger.info(
            "Exact pagination probe still running; returning inexact metadata filter_key=%s "
            "page=%s per_page=%s",
            sha256(query_identity.encode("utf-8")).hexdigest()[:12],
            page,
            EXACT_PROBE_PER_PAGE,
        )
        return _inexact_page_info(raw_page, page, per_page)
    except AniListError as error:
        logger.warning(
            "Exact pagination probe failed operation=exact_count_probe filter_key=%s "
            "page=%s per_page=%s category=%s",
            sha256(query_identity.encode("utf-8")).hexdigest()[:12],
            page,
            EXACT_PROBE_PER_PAGE,
            type(error).__name__,
        )
        return _inexact_page_info(raw_page, page, per_page)

    if isinstance(resolved, ExactPaginationUnavailable):
        cache_unavailable = getattr(client, "store_exact_pagination_unavailable", None)
        if callable(cache_unavailable) and not callable(single_flight):
            cache_unavailable(query_identity, max_probe_page=resolved.max_probe_page)
        if not callable(single_flight):
            logger.info(
                "Exact pagination unavailable reason=anilist_result_window_exceeded filter_key=%s "
                "max_probe_page=%d",
                sha256(query_identity.encode("utf-8")).hexdigest()[:12],
                resolved.max_probe_page,
            )
        return _inexact_page_info(raw_page, page, per_page)

    last_page = max(1, (resolved.total + per_page - 1) // per_page)
    cache_writer = getattr(client, "store_exact_pagination", None)
    if callable(cache_writer) and not callable(getattr(client, "resolve_exact_pagination", None)):
        cache_writer(query_identity, last_page=last_page, total=resolved.total)
    return _verified_page_info(
        raw_page,
        page=page,
        per_page=per_page,
        last_page=last_page,
        total=resolved.total,
    )


async def get_anime_list(
    client: AniListClient,
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
    exact_pagination: bool | None = None,
) -> AnimeListResponse:
    raw_page = await _list_media_for_operation(
        client,
        operation_name="browse_page_fetch" if exact_pagination else "anime_page_fetch",
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
    media = [item for item in _page_media(raw_page) if is_safe_catalogue_anime(item)]
    page_info = (
        await _exact_page_info(
            client,
            raw_page,
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
        if (
            exact_pagination
            if exact_pagination is not None
            else search is not None or minimum_score is not None
        )
        else _page_info(raw_page, page, per_page)
    )
    return AnimeListResponse(
        items=[map_anime(item) for item in media if isinstance(item, Mapping)],
        page_info=page_info,
    )


async def get_anime_by_id(client: AniListClient, anime_id: int) -> Anime:
    raw_media = await client.get_media(anime_id)
    if raw_media is None or not is_safe_catalogue_anime(raw_media):
        raise AnimeNotFoundError
    return map_anime(raw_media, include_related=True)
