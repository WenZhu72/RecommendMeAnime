from collections.abc import Mapping

from app.clients.anilist import AniListClient
from app.core.exceptions import AniListResponseError, AnimeNotFoundError
from app.schemas.anime import Anime, AnimeDate, AnimeListResponse, AnimeTitle, PageInfo

SORTS = {
    "trending": ["TRENDING_DESC", "POPULARITY_DESC"],
    "popular": ["POPULARITY_DESC"],
    "top-rated": ["SCORE_DESC", "POPULARITY_DESC"],
    "search": ["SEARCH_MATCH", "POPULARITY_DESC"],
}


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
        cover_image=_string(cover.get("large")) if cover else None,
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
    )
    if not include_related:
        return anime

    relations = _mapping(raw.get("relations"))
    relation_nodes = relations.get("nodes") if relations else None
    anime.relations = [map_anime(item) for item in relation_nodes if isinstance(item, Mapping)] if isinstance(relation_nodes, list) else []
    recommendation_data = _mapping(raw.get("recommendations"))
    nodes = recommendation_data.get("nodes", []) if recommendation_data else []
    anime.recommendations = [map_anime(media) for node in nodes if (mapped := _mapping(node)) and (media := _mapping(mapped.get("mediaRecommendation")))] if isinstance(nodes, list) else []
    return anime


def _page_info(raw: Mapping[str, object], fallback_page: int, fallback_per_page: int) -> PageInfo:
    info = _mapping(raw.get("pageInfo"))
    if info is None:
        raise AniListResponseError
    return PageInfo(
        current_page=_integer(info.get("currentPage")) or fallback_page,
        has_next_page=bool(info.get("hasNextPage")),
        last_page=_integer(info.get("lastPage")) or fallback_page,
        per_page=_integer(info.get("perPage")) or fallback_per_page,
        total=_integer(info.get("total")) or 0,
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
) -> AnimeListResponse:
    raw_page = await client.list_media(
        page=page, per_page=per_page, search=search, genre=genre, genre_in=genre_in,
        anime_format=anime_format, format_in=format_in, season=season,
        season_year=season_year, minimum_score=minimum_score, sort=sort,
    )
    media = raw_page.get("media")
    if not isinstance(media, list):
        raise AniListResponseError
    return AnimeListResponse(
        items=[map_anime(item) for item in media if isinstance(item, Mapping)],
        page_info=_page_info(raw_page, page, per_page),
    )


async def get_anime_by_id(client: AniListClient, anime_id: int) -> Anime:
    raw_media = await client.get_media(anime_id)
    if raw_media is None:
        raise AnimeNotFoundError
    return map_anime(raw_media, include_related=True)
