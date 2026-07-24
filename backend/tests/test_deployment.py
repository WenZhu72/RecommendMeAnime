import asyncio
import json
from collections.abc import Callable

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_anilist_client
from app.clients.anilist import (
    DETAIL_QUERY,
    AniListClient,
    ExactPaginationMetadata,
    build_page_query_and_variables,
    build_page_query_identity,
)
from app.core.config import ConfigurationError, get_settings
from app.core.exceptions import (
    AniListGraphQLError,
    AniListMalformedResponseError,
    AniListRateLimitError,
    AniListResponseError,
    AniListTimeoutError,
    AniListUnavailableError,
    AniListUpstreamError,
)
from app.services.anime_service import get_anime_list
from tests.support import create_test_app, make_test_settings


def test_health_check_starts_with_explicit_test_database_configuration() -> None:
    application = create_test_app()
    with TestClient(application) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_url_is_required() -> None:
    with pytest.raises(ConfigurationError, match="DATABASE_URL is required"):
        get_settings({"ENVIRONMENT": "development"})


@pytest.mark.parametrize(
    "values",
    [
        {
            "ENVIRONMENT": "production",
            "DATABASE_URL": (
                "postgresql+psycopg://postgres:development"
                "@localhost:5432/recommend_me_anime"
            ),
        },
        {
            "ENVIRONMENT": "development",
            "DATABASE_URL": (
                "postgresql+psycopg://neondb_owner:secret"
                "@ep-example.eu-west-2.aws.neon.tech/neondb?sslmode=require"
            ),
        },
        {
            "ENVIRONMENT": "production",
            "DATABASE_URL": (
                "postgresql+psycopg://neondb_owner:secret"
                "@ep-example.eu-west-2.aws.neon.tech/neondb"
            ),
        },
    ],
)
def test_environment_separation_rejects_unsafe_database_targets(
    values: dict[str, str],
) -> None:
    with pytest.raises(ConfigurationError):
        get_settings(values)


def test_settings_parse_multiple_normalised_cors_origins() -> None:
    settings = get_settings(
        {
            "ENVIRONMENT": "production",
            "DATABASE_URL": (
                "postgresql://neondb_owner:secret@ep-example.eu-west-2.aws.neon.tech/"
                "neondb?sslmode=require"
            ),
            "CORS_ALLOWED_ORIGINS": " http://localhost:3000/ , https://recommend-me-anime.vercel.app/ ",
            "EXTERNAL_API_TIMEOUT_SECONDS": "12.5",
            "CACHE_TTL_SECONDS": "120",
            "EXACT_PAGINATION_CACHE_TTL_SECONDS": "2400",
            "ANILIST_EXACT_PROBE_RESPONSE_WAIT_SECONDS": "2.75",
            "ANILIST_EXACT_PROBE_MAX_PAGE": "80",
            "ANILIST_STALE_IF_ERROR_SECONDS": "900",
            "ANILIST_MAX_CONCURRENCY": "3",
            "ANILIST_MAX_RETRIES": "1",
            "ANILIST_RETRY_FALLBACK_SECONDS": "2.5",
            "ANILIST_MAX_RETRY_DELAY_SECONDS": "20",
            "LOG_LEVEL": "warning",
        }
    )
    assert settings.app_env == "production"
    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.cors_allowed_origins == (
        "http://localhost:3000",
        "https://recommend-me-anime.vercel.app",
    )
    assert settings.external_api_timeout_seconds == 12.5
    assert settings.cache_ttl_seconds == 120
    assert settings.exact_pagination_cache_ttl_seconds == 2400
    assert settings.anilist_exact_probe_response_wait_seconds == 2.75
    assert settings.anilist_exact_probe_max_page == 80
    assert settings.stale_if_error_seconds == 900
    assert settings.anilist_max_concurrency == 3
    assert settings.anilist_max_retries == 1
    assert settings.anilist_retry_fallback_seconds == 2.5
    assert settings.anilist_max_retry_delay_seconds == 20
    assert settings.log_level == "WARNING"


def test_cors_accepts_local_and_configured_origins_but_rejects_others() -> None:
    application = create_test_app(
        make_test_settings(
            {
                "CORS_ALLOWED_ORIGINS": "http://localhost:3000,https://recommend-me-anime.vercel.app",
            }
        )
    )
    with TestClient(application) as client:
        local = client.get("/health", headers={"Origin": "http://localhost:3000"})
        production = client.options(
            "/api/recommendations",
            headers={
                "Origin": "https://recommend-me-anime.vercel.app",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        rejected = client.get("/health", headers={"Origin": "https://untrusted.example"})

    assert local.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert production.status_code == 200
    assert production.headers["access-control-allow-origin"] == "https://recommend-me-anime.vercel.app"
    assert "access-control-allow-origin" not in rejected.headers


async def _call_list_media(handler: Callable[[httpx.Request], httpx.Response]) -> None:
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
        client = AniListClient(http_client, cache_ttl_seconds=0)
        await client.list_media(page=1, per_page=1)


async def _call_get_media(handler: Callable[[httpx.Request], httpx.Response]) -> dict[str, object] | None:
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
        client = AniListClient(http_client, cache_ttl_seconds=0)
        return await client.get_media(999999999)


def test_anilist_timeout_is_classified_for_a_gateway_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("upstream timeout", request=request)

    with pytest.raises(AniListTimeoutError):
        asyncio.run(_call_list_media(handler))


@pytest.mark.parametrize(
    ("handler", "expected_error"),
    [
        (
            lambda request: httpx.Response(502, request=request, json={"message": "bad gateway"}),
            AniListUpstreamError,
        ),
        (
            lambda request: httpx.Response(200, request=request, json={"errors": [{"message": "invalid query"}]}),
            AniListGraphQLError,
        ),
        (
            lambda request: httpx.Response(200, request=request, content=b"not valid JSON"),
            AniListMalformedResponseError,
        ),
    ],
)
def test_anilist_upstream_responses_are_classified_without_exposing_payloads(
    handler: Callable[[httpx.Request], httpx.Response],
    expected_error: type[Exception],
) -> None:
    with pytest.raises(expected_error):
        asyncio.run(_call_list_media(handler))


def test_anilist_missing_detail_is_classified_as_not_found() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            404,
            request=request,
            json={"errors": [{"message": "Not Found.", "status": 404}]},
        )

    assert asyncio.run(_call_get_media(handler)) is None


def test_non_graphql_upstream_404_is_not_misclassified_as_a_missing_anime() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, request=request, json={"detail": "Route does not exist."})

    with pytest.raises(AniListResponseError):
        asyncio.run(_call_get_media(handler))


class FakeAniListClient:
    async def list_media(self, **_: object) -> dict[str, object]:
        return {
            "pageInfo": {"total": 1, "currentPage": 1, "lastPage": 1, "hasNextPage": False, "perPage": 1},
            "media": [
                {
                    "id": 1,
                    "title": {"english": "Example Anime", "romaji": None, "native": None},
                    "coverImage": {"large": "https://s4.anilist.co/example.jpg"},
                    "genres": ["Action"],
                    "isAdult": False,
                }
            ],
        }


class FailingAniListClient:
    def __init__(self, error: Exception) -> None:
        self.error = error

    async def list_media(self, **_: object) -> dict[str, object]:
        raise self.error


class RecordingAniListClient:
    def __init__(self) -> None:
        self.parameters: dict[str, object] = {}
        self.calls: list[dict[str, object]] = []

    async def list_media(self, **parameters: object) -> dict[str, object]:
        if not self.parameters:
            self.parameters = parameters
        self.calls.append(parameters)
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        total = 61
        last_page = (total + per_page - 1) // per_page
        item_count = max(0, min(per_page, total - (page - 1) * per_page))
        return {
            "pageInfo": {
                "total": total,
                "currentPage": page,
                "lastPage": last_page,
                "hasNextPage": page < last_page,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Result {(page - 1) * per_page + index + 1}"},
                    "isAdult": False,
                }
                for index in range(item_count)
            ],
        }


class DegradedSearchPageInfoClient:
    def __init__(self) -> None:
        self.pages: list[int] = []

    async def list_media(self, **parameters: object) -> dict[str, object]:
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        self.pages.append(page)
        total = 26
        last_page = (total + per_page - 1) // per_page
        item_count = max(0, min(per_page, total - (page - 1) * per_page))
        return {
            "pageInfo": {
                "total": 5000 if page == 1 else total,
                "currentPage": page,
                "lastPage": 250 if page == 1 else last_page,
                "hasNextPage": page < last_page,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Naruto result {(page - 1) * per_page + index + 1}"},
                    "isAdult": False,
                }
                for index in range(item_count)
            ],
        }


class DegradedScorePageInfoClient:
    def __init__(self) -> None:
        self.pages: list[int] = []

    async def list_media(self, **parameters: object) -> dict[str, object]:
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        self.pages.append(page)
        item_count = 50 if page < 3 else 9 if page == 3 else 0
        return {
            "pageInfo": {
                "total": 5000 if page == 1 else 109,
                "currentPage": page,
                "lastPage": 100 if page == 1 else page,
                "hasNextPage": page < 3,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"High-score result {(page - 1) * per_page + index + 1}"},
                    "averageScore": 85,
                    "isAdult": False,
                }
                for index in range(item_count)
            ],
        }


class DegradedBrowsePageInfoClient:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []
        self.exact_pagination: dict[str, tuple[int, int]] = {}

    def get_cached_exact_pagination(self, query_identity: str) -> tuple[int, int] | None:
        return self.exact_pagination.get(query_identity)

    def store_exact_pagination(self, query_identity: str, *, last_page: int, total: int) -> None:
        self.exact_pagination[query_identity] = (last_page, total)

    async def list_media(self, **parameters: object) -> dict[str, object]:
        self.calls.append(parameters)
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        total = 25 if parameters.get("season_year") == 2024 else 46
        last_page = (total + per_page - 1) // per_page
        item_count = max(0, min(per_page, total - (page - 1) * per_page))
        return {
            "pageInfo": {
                "total": 5000,
                "currentPage": page,
                "lastPage": 250,
                "hasNextPage": page < last_page,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Fall 2025 result {(page - 1) * per_page + index + 1}"},
                    "isAdult": False,
                }
                for index in range(item_count)
            ],
        }


class ProbeFailurePageInfoClient:
    def __init__(self) -> None:
        self.pages: list[int] = []

    async def list_media(self, **parameters: object) -> dict[str, object]:
        page = int(parameters["page"])
        self.pages.append(page)
        if page != 1:
            raise AniListUnavailableError
        per_page = int(parameters["per_page"])
        return {
            "pageInfo": {
                "total": 5000,
                "currentPage": 1,
                "lastPage": 250,
                "hasNextPage": True,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": index + 1,
                    "title": {"english": f"Fallback result {index + 1}"},
                    "isAdult": False,
                }
                for index in range(per_page)
            ],
        }


class CappedPageInfoClient:
    async def list_media(self, **parameters: object) -> dict[str, object]:
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        return {
            "pageInfo": {
                "total": 5000,
                "currentPage": page,
                "lastPage": 250,
                "hasNextPage": page < 250,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Capped result {(page - 1) * per_page + index + 1}"},
                    "isAdult": False,
                }
                for index in range(per_page)
            ],
        }


class DetailAniListClient:
    async def get_media(self, anime_id: int) -> dict[str, object] | None:
        if anime_id != 21:
            return None
        return {
            "id": 21,
            "title": {"english": "ONE PIECE", "romaji": "ONE PIECE", "native": "ONE PIECE"},
            "description": "A pirate adventure.",
            "coverImage": {"large": "https://s4.anilist.co/example.jpg"},
            "genres": ["Action", "Adventure"],
            "episodes": 1140,
            "isAdult": False,
            "relations": {"nodes": []},
            "recommendations": {"nodes": []},
        }


class MixedSafetyAniListClient:
    async def list_media(self, **parameters: object) -> dict[str, object]:
        page = int(parameters["page"])
        per_page = int(parameters["per_page"])
        return {
            "pageInfo": {
                "total": 4,
                "currentPage": page,
                "lastPage": 1,
                "hasNextPage": False,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": 1,
                    "title": {"english": "Confirmed safe"},
                    "genres": ["Action"],
                    "averageScore": 90,
                    "seasonYear": 2025,
                    "isAdult": False,
                },
                {"id": 2, "title": {"english": "Adult"}, "genres": ["Action"], "isAdult": True},
                {"id": 3, "title": {"english": "Unknown"}, "genres": ["Action"], "isAdult": None},
                {"id": 4, "title": {"english": "Missing flag"}, "genres": ["Action"]},
            ],
        }


class RestrictedDetailAniListClient:
    async def get_media(self, anime_id: int) -> dict[str, object] | None:
        if anime_id == 1:
            return {"id": 1, "title": {"english": "Adult"}, "isAdult": True}
        if anime_id == 2:
            return {"id": 2, "title": {"english": "Unknown"}}
        if anime_id != 3:
            return None
        return {
            "id": 3,
            "title": {"english": "Safe detail"},
            "isAdult": False,
            "relations": {
                "nodes": [
                    {"id": 31, "title": {"english": "Safe relation"}, "isAdult": False},
                    {"id": 32, "title": {"english": "Adult relation"}, "isAdult": True},
                    {"id": 33, "title": {"english": "Unknown relation"}},
                ],
            },
            "recommendations": {
                "nodes": [
                    {"mediaRecommendation": {"id": 34, "title": {"english": "Safe recommendation"}, "isAdult": False}},
                    {"mediaRecommendation": {"id": 35, "title": {"english": "Adult recommendation"}, "isAdult": True}},
                    {"mediaRecommendation": {"id": 36, "title": {"english": "Unknown recommendation"}}},
                ],
            },
        }


@pytest.mark.parametrize(
    ("upstream_error", "expected_status"),
    [
        (AniListUnavailableError(), 503),
        (AniListTimeoutError(), 503),
        (AniListRateLimitError(retry_after=1, attempts=2), 503),
        (AniListUpstreamError(500), 503),
        (AniListResponseError(), 502),
    ],
)
def test_upstream_failures_return_stable_gateway_responses(upstream_error: Exception, expected_status: int) -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: FailingAniListClient(upstream_error)
    with TestClient(application) as client:
        response = client.get("/api/anime/trending")

    assert response.status_code == expected_status
    assert "detail" in response.json()


def test_invalid_search_parameters_are_stable_and_frontend_response_is_compatible() -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: FakeAniListClient()
    with TestClient(application) as client:
        invalid_query = client.get("/api/anime/search", params={"q": "   "})
        response = client.get("/api/anime/trending")

    assert invalid_query.status_code == 400
    assert invalid_query.json() == {"detail": "Search query cannot be blank."}
    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": 1,
                "title": "Example Anime",
                "titles": {"english": "Example Anime", "romaji": None, "native": None},
                "description": None,
                "coverImage": "https://s4.anilist.co/example.jpg",
                "color": None,
                "bannerImage": None,
                "averageScore": None,
                "meanScore": None,
                "popularity": None,
                "genres": ["Action"],
                "format": None,
                "status": None,
                "episodes": None,
                "duration": None,
                "season": None,
                "seasonYear": None,
                "startDate": None,
                "endDate": None,
                "studios": [],
                "source": None,
                "countryOfOrigin": None,
                "synonyms": [],
                "siteUrl": None,
                "isAdult": False,
                "relations": [],
                "recommendations": [],
            }
        ],
        "pageInfo": {
            "currentPage": 1,
            "hasNextPage": False,
            "lastPage": 1,
            "perPage": 1,
            "total": 1,
            "isExact": True,
        },
    }


def test_browse_forwards_search_filters_and_pagination_to_anilist() -> None:
    recording_client = RecordingAniListClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: recording_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params=[
                ("search", "Frieren"),
                ("genre", "Fantasy"),
                ("genre", "Adventure"),
                ("format", "TV"),
                ("minimum_score", "80"),
                ("sort", "top-rated"),
                ("page", "3"),
                ("per_page", "20"),
            ],
        )
        invalid_page_size = client.get("/api/anime/browse", params={"per_page": 51})

    assert response.status_code == 200
    assert response.json()["pageInfo"] == {
        "currentPage": 3,
        "hasNextPage": True,
        "lastPage": None,
        "perPage": 20,
        "total": None,
        "isExact": False,
        "verificationStatus": "calculating",
        "lastVerifiedAt": None,
    }
    assert recording_client.parameters == {
        "page": 3,
        "per_page": 20,
        "search": "Frieren",
        "genre": None,
        "genre_in": ["Adventure", "Fantasy"],
        "anime_format": "TV",
        "format_in": None,
        "season": None,
        "season_year": None,
        "minimum_score": 80,
        "sort": ["SCORE_DESC", "POPULARITY_DESC"],
    }
    assert int(recording_client.calls[0]["page"]) == 3
    assert all(int(call["per_page"]) == 20 for call in recording_client.calls)
    assert sum(int(call["page"]) == 3 for call in recording_client.calls) == 1
    assert invalid_page_size.status_code == 400


def test_browse_parses_and_forwards_the_year_as_an_integer() -> None:
    recording_client = RecordingAniListClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: recording_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"season_year": "2025", "page": "2", "per_page": "20"},
        )

    assert response.status_code == 200
    assert recording_client.parameters["season_year"] == 2025
    assert type(recording_client.parameters["season_year"]) is int


def test_anilist_page_query_uses_the_numeric_season_year_filter() -> None:
    query, variables = build_page_query_and_variables(
        page=1,
        per_page=20,
        search=None,
        genre=None,
        genre_in=None,
        anime_format=None,
        format_in=None,
        season=None,
        season_year=2025,
        minimum_score=None,
        sort=["POPULARITY_DESC"],
    )

    assert "$seasonYear: Int" in query
    assert "seasonYear: $seasonYear" in query
    assert variables["seasonYear"] == 2025
    assert type(variables["seasonYear"]) is int


def test_all_anilist_media_queries_request_and_filter_the_adult_flag() -> None:
    query, _ = build_page_query_and_variables(
        page=1,
        per_page=20,
        search=None,
        genre=None,
        genre_in=None,
        anime_format=None,
        format_in=None,
        season=None,
        season_year=None,
        minimum_score=None,
        sort=["POPULARITY_DESC"],
    )

    assert "isAdult: false" in query
    assert "isAdult" in query
    assert "Media(id: $id, type: ANIME, isAdult: false)" in DETAIL_QUERY
    assert DETAIL_QUERY.count("isAdult") >= 2


def test_public_lists_and_recommendation_candidates_fail_closed_on_adult_status() -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: MixedSafetyAniListClient()

    with TestClient(application) as client:
        list_responses = [
            client.get("/api/anime/trending"),
            client.get("/api/anime/popular"),
            client.get("/api/anime/top-rated"),
            client.get("/api/anime/search", params={"q": "safe"}),
            client.get("/api/anime/genre/Action"),
            client.get("/api/anime/browse"),
        ]
        recommendations = client.post(
            "/api/recommendations",
            json={
                "favoriteGenres": ["Action"],
                "avoidedGenres": [],
                "formats": [],
                "preferredLength": "any",
                "releasePeriod": "any",
                "minimumScore": 0,
                "popularity": "popular",
                "tones": [],
            },
        )

    assert all(response.status_code == 200 for response in list_responses)
    assert all([item["id"] for item in response.json()["items"]] == [1] for response in list_responses)
    assert recommendations.status_code == 200
    assert [item["id"] for item in recommendations.json()["items"]] == [1]


def test_adult_or_unconfirmed_details_are_404_and_nested_lists_are_filtered() -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: RestrictedDetailAniListClient()

    with TestClient(application) as client:
        adult = client.get("/api/anime/1")
        unknown = client.get("/api/anime/2")
        safe = client.get("/api/anime/3")

    assert adult.status_code == 404
    assert unknown.status_code == 404
    assert adult.json() == unknown.json() == {"detail": "Anime not found."}
    assert safe.status_code == 200
    assert [item["id"] for item in safe.json()["relations"]] == [31]
    assert [item["id"] for item in safe.json()["recommendations"]] == [34]


def test_exact_pagination_identity_contains_membership_filters_and_normalises_supported_sorts() -> None:
    base: dict[str, object] = {
        "per_page": 20,
        "search": "Fall anime",
        "genre": "Action",
        "genre_in": ["Comedy", "Drama"],
        "anime_format": "TV",
        "format_in": ["TV", "ONA"],
        "season": "FALL",
        "season_year": 2025,
        "minimum_score": 80,
        "sort": ["POPULARITY_DESC"],
    }
    identity = build_page_query_identity(**base)  # type: ignore[arg-type]
    reordered = {
        **base,
        "per_page": 20,
        "search": "  FALL   ANIME ",
        "genre_in": ["Drama", "Comedy"],
        "format_in": ["ONA", "TV"],
        "anime_format": "tv",
        "season": "fall",
    }
    assert build_page_query_identity(**reordered) == identity  # type: ignore[arg-type]

    changes = {
        "search": "Naruto",
        "genre": "Fantasy",
        "genre_in": ["Comedy", "Fantasy"],
        "anime_format": "MOVIE",
        "format_in": ["MOVIE"],
        "season": "SPRING",
        "season_year": 2024,
        "minimum_score": 70,
    }
    for name, value in changes.items():
        changed = {**base, name: value}
        assert build_page_query_identity(**changed) != identity  # type: ignore[arg-type]

    assert build_page_query_identity(
        **{**base, "sort": ["TRENDING_DESC", "POPULARITY_DESC"]}
    ) == identity  # type: ignore[arg-type]
    assert build_page_query_identity(
        **{**base, "sort": ["SCORE_DESC", "POPULARITY_DESC"]}
    ) == identity  # type: ignore[arg-type]
    assert build_page_query_identity(
        **{**base, "sort": ["FUTURE_SORT_DESC"]}
    ) != identity  # type: ignore[arg-type]
    assert build_page_query_identity(**{**base, "per_page": 50}) != identity  # type: ignore[arg-type]


def test_anilist_client_caches_exact_pagination_metadata_by_query_identity() -> None:
    async def scenario() -> None:
        async with httpx.AsyncClient() as http_client:
            client = AniListClient(http_client, cache_ttl_seconds=60)
            assert client.get_cached_exact_pagination("query-a") is None
            client.store_exact_pagination("query-a", last_page=3, total=46)
            assert client.get_cached_exact_pagination("query-a") == ExactPaginationMetadata(total=46)
            assert client.get_cached_exact_pagination("query-b") is None

    asyncio.run(scenario())


def test_concurrent_identical_browse_requests_share_one_exact_probe() -> None:
    async def scenario() -> None:
        probe_started = asyncio.Event()
        release_probe = asyncio.Event()
        probe_calls = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal probe_calls
            variables = json.loads(request.content)["variables"]
            page = int(variables["page"])
            per_page = int(variables["perPage"])
            if per_page == 50:
                probe_calls += 1
                probe_started.set()
                await release_probe.wait()
            total = 46
            last_page = (total + per_page - 1) // per_page
            item_count = max(0, min(per_page, total - (page - 1) * per_page))
            return httpx.Response(
                200,
                request=request,
                json={
                    "data": {
                        "Page": {
                            "pageInfo": {
                                "total": 5000,
                                "currentPage": page,
                                "lastPage": 250,
                                "hasNextPage": page < last_page,
                                "perPage": per_page,
                            },
                            "media": [
                                {
                                    "id": (page - 1) * per_page + index + 1,
                                    "title": {"english": f"Result {index + 1}"},
                                    "isAdult": False,
                                }
                                for index in range(item_count)
                            ],
                        }
                    }
                },
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            client = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=60,
            )
            requests = [
                asyncio.create_task(
                    get_anime_list(
                        client,
                        page=page,
                        per_page=20,
                        sort=["POPULARITY_DESC"],
                        exact_pagination=True,
                    )
                )
                for page in (1, 2)
            ]
            await asyncio.wait_for(probe_started.wait(), timeout=1)
            await asyncio.sleep(0)
            release_probe.set()
            responses = await asyncio.gather(*requests)

        assert probe_calls == 1
        assert [response.page_info.total for response in responses] == [46, 46]
        assert [response.page_info.last_page for response in responses] == [3, 3]

    asyncio.run(scenario())


def test_failed_single_flight_probe_is_removed_and_can_be_retried() -> None:
    async def scenario() -> None:
        attempts = 0

        async def resolver() -> ExactPaginationMetadata:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise AniListUnavailableError
            return ExactPaginationMetadata(total=46)

        async with httpx.AsyncClient() as http_client:
            client = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=60,
            )
            with pytest.raises(AniListUnavailableError):
                await client.resolve_exact_pagination("same-filter", resolver)
            resolved = await client.resolve_exact_pagination("same-filter", resolver)

        assert resolved == ExactPaginationMetadata(total=46)
        assert attempts == 2

    asyncio.run(scenario())


def test_anilist_429_respects_retry_after_and_retries_only_once() -> None:
    async def scenario() -> None:
        calls = 0
        sleeps: list[float] = []

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            if calls == 1:
                return httpx.Response(429, request=request, headers={"Retry-After": "2"})
            return httpx.Response(
                200,
                request=request,
                json={
                    "data": {
                        "Page": {
                            "pageInfo": {
                                "total": 0,
                                "currentPage": 1,
                                "lastPage": 1,
                                "hasNextPage": False,
                                "perPage": 20,
                            },
                            "media": [],
                        }
                    }
                },
            )

        async def record_sleep(delay: float) -> None:
            sleeps.append(delay)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            client = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                max_retries=1,
                sleep=record_sleep,
            )
            await client.list_media(page=1, per_page=20)

        assert calls == 2
        assert sleeps == [pytest.approx(2, abs=0.05)]

    asyncio.run(scenario())


def test_anilist_429_retry_budget_is_bounded() -> None:
    async def scenario() -> None:
        calls = 0
        sleeps: list[float] = []

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            return httpx.Response(429, request=request, headers={"Retry-After": "1"})

        async def record_sleep(delay: float) -> None:
            sleeps.append(delay)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            client = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                max_retries=1,
                sleep=record_sleep,
            )
            with pytest.raises(AniListRateLimitError) as captured:
                await client.list_media(page=1, per_page=20)

        assert captured.value.attempts == 2
        assert calls == 2
        assert sleeps == [pytest.approx(1, abs=0.05)]

    asyncio.run(scenario())


def test_temporary_anilist_failure_uses_a_stale_cached_page(monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        clock = [0.0]
        calls = 0
        monkeypatch.setattr("app.clients.anilist.monotonic", lambda: clock[0])

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            if calls == 2:
                return httpx.Response(503, request=request)
            return httpx.Response(
                200,
                request=request,
                json={
                    "data": {
                        "Page": {
                            "pageInfo": {
                                "total": 1,
                                "currentPage": 1,
                                "lastPage": 1,
                                "hasNextPage": False,
                                "perPage": 20,
                            },
                            "media": [{"id": 1, "title": {"english": "Cached"}, "isAdult": False}],
                        }
                    }
                },
            )

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            client = AniListClient(
                http_client,
                cache_ttl_seconds=1,
                stale_if_error_seconds=10,
                max_retries=0,
            )
            fresh = await client.list_media(page=1, per_page=20)
            clock[0] = 2
            stale = await client.list_media(page=1, per_page=20)

        assert stale == fresh
        assert calls == 2

    asyncio.run(scenario())


def test_dropdown_browse_resolves_and_caches_exact_metadata_across_every_page() -> None:
    degraded_client = DegradedBrowsePageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    with TestClient(application) as client:
        parameters = {
            "format": "TV",
            "season": "FALL",
            "season_year": 2025,
            "sort": "popular",
            "per_page": 20,
        }
        first = client.get("/api/anime/browse", params={**parameters, "page": 1})
        metadata = client.get("/api/anime/browse/page-info", params={**parameters, "page": 1})
        second = client.get("/api/anime/browse", params={**parameters, "page": 2})
        third = client.get("/api/anime/browse", params={**parameters, "page": 3})

    assert [response.status_code for response in (first, metadata, second, third)] == [200, 200, 200, 200]
    assert metadata.json()["lastPage"] == 3
    assert metadata.json()["total"] == 46
    assert metadata.json()["isExact"] is True
    assert second.json()["pageInfo"]["lastPage"] == 3
    assert third.json()["pageInfo"]["total"] == 46
    assert [response.json()["pageInfo"]["currentPage"] for response in (first, second, third)] == [1, 2, 3]
    assert all(int(call["per_page"]) == 20 for call in degraded_client.calls)


def test_search_and_dropdown_browse_requests_share_exact_pagination_behaviour() -> None:
    search_client = DegradedBrowsePageInfoClient()
    dropdown_client = DegradedBrowsePageInfoClient()
    search_application = create_test_app()
    dropdown_application = create_test_app()
    search_application.dependency_overrides[get_anilist_client] = lambda: search_client
    dropdown_application.dependency_overrides[get_anilist_client] = lambda: dropdown_client

    with TestClient(search_application) as client:
        search_response = client.get(
            "/api/anime/browse",
            params={"search": "Fall anime", "sort": "popular", "page": 1, "per_page": 20},
        )
        search_metadata = client.get(
            "/api/anime/browse/page-info",
            params={"search": "Fall anime", "sort": "popular", "page": 1, "per_page": 20},
        )
    with TestClient(dropdown_application) as client:
        dropdown_response = client.get(
            "/api/anime/browse",
            params={
                "format": "TV",
                "season": "FALL",
                "season_year": 2025,
                "sort": "popular",
                "page": 1,
                "per_page": 20,
            },
        )
        dropdown_metadata = client.get(
            "/api/anime/browse/page-info",
            params={
                "format": "TV",
                "season": "FALL",
                "season_year": 2025,
                "sort": "popular",
                "page": 1,
                "per_page": 20,
            },
        )

    assert search_response.status_code == 200
    assert dropdown_response.status_code == 200
    assert search_response.json()["pageInfo"]["isExact"] is False
    assert dropdown_response.json()["pageInfo"]["isExact"] is False
    assert search_metadata.json()["total"] == dropdown_metadata.json()["total"] == 46
    assert all(int(call["per_page"]) == 20 for call in search_client.calls)
    assert all(int(call["per_page"]) == 20 for call in dropdown_client.calls)


def test_equivalent_filter_parameters_share_one_canonical_pagination_cache_entry() -> None:
    degraded_client = DegradedBrowsePageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    first_filters = [
        ("genre", "Action"),
        ("genre", "Comedy"),
        ("format", "TV"),
        ("season", "FALL"),
        ("season_year", "2025"),
        ("sort", "popular"),
    ]
    reordered_filters = [
        ("genre", "Comedy"),
        ("genre", "Action"),
        ("season_year", "2025"),
        ("season", "FALL"),
        ("format", "TV"),
        ("sort", "popular"),
    ]
    with TestClient(application) as client:
        first_response = client.get("/api/anime/browse", params=first_filters)
        metadata = client.get("/api/anime/browse/page-info", params=first_filters)
        second_response = client.get("/api/anime/browse", params=reordered_filters)

    assert first_response.json()["pageInfo"]["isExact"] is False
    assert second_response.json()["pageInfo"]["isExact"] is True
    assert second_response.json()["items"] == first_response.json()["items"]
    assert metadata.json()["total"] == 46
    assert sum(int(call["page"]) == 1 for call in degraded_client.calls) == 1


def test_filter_changes_use_a_new_exact_pagination_cache_identity() -> None:
    degraded_client = DegradedBrowsePageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    with TestClient(application) as client:
        fall_2025 = client.get(
            "/api/anime/browse",
            params={"format": "TV", "season": "FALL", "season_year": 2025},
        )
        fall_2024 = client.get(
            "/api/anime/browse",
            params={"format": "TV", "season": "FALL", "season_year": 2024},
        )
        metadata_2025 = client.get(
            "/api/anime/browse/page-info",
            params={"format": "TV", "season": "FALL", "season_year": 2025},
        )
        metadata_2024 = client.get(
            "/api/anime/browse/page-info",
            params={"format": "TV", "season": "FALL", "season_year": 2024},
        )

    assert fall_2025.json()["pageInfo"]["isExact"] is False
    assert fall_2024.json()["pageInfo"]["isExact"] is False
    assert (metadata_2025.json()["lastPage"], metadata_2025.json()["total"]) == (3, 46)
    assert (metadata_2024.json()["lastPage"], metadata_2024.json()["total"]) == (2, 25)


def test_broad_exact_probe_uses_exponential_pages_with_visible_page_size() -> None:
    class Total146Client:
        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        async def list_media(self, **parameters: object) -> dict[str, object]:
            self.calls.append(parameters)
            page = int(parameters["page"])
            per_page = int(parameters["per_page"])
            total = 146
            last_page = (total + per_page - 1) // per_page
            item_count = max(0, min(per_page, total - (page - 1) * per_page))
            return {
                "pageInfo": {
                    "total": 5000,
                    "currentPage": page,
                    "lastPage": 250,
                    "hasNextPage": page < last_page,
                    "perPage": per_page,
                },
                "media": [
                    {
                        "id": (page - 1) * per_page + index + 1,
                        "title": {"english": f"Result {index + 1}"},
                        "isAdult": False,
                    }
                    for index in range(item_count)
                ],
            }

    anilist = Total146Client()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: anilist

    with TestClient(application) as client:
        response = client.get("/api/anime/browse", params={"page": 1, "per_page": 20})
        metadata = client.get("/api/anime/browse/page-info", params={"page": 1, "per_page": 20})

    assert response.status_code == 200
    assert response.json()["pageInfo"]["isExact"] is False
    assert metadata.json()["lastPage"] == 8
    assert metadata.json()["total"] == 146
    assert all(int(call["per_page"]) == 20 for call in anilist.calls)
    assert [int(call["page"]) for call in anilist.calls] == [1, 2, 4, 8]


def test_probe_failure_returns_the_requested_page_with_safe_inexact_metadata() -> None:
    failing_probe_client = ProbeFailurePageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: failing_probe_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"format": "TV", "season": "FALL", "season_year": 2025},
        )
        metadata = client.get(
            "/api/anime/browse/page-info",
            params={"format": "TV", "season": "FALL", "season_year": 2025},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 20
    assert response.json()["pageInfo"]["lastPage"] is None
    assert response.json()["pageInfo"]["total"] is None
    assert response.json()["pageInfo"]["isExact"] is False
    assert metadata.json()["verificationStatus"] == "failed"
    assert failing_probe_client.pages == [1, 2]


def test_browse_does_not_treat_the_anilist_page_ceiling_as_an_exact_final_page() -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: CappedPageInfoClient()

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"page": 250, "per_page": 20},
        )
        metadata = client.get(
            "/api/anime/browse/page-info",
            params={"page": 250, "per_page": 20},
        )

    assert response.status_code == 200
    assert response.json()["pageInfo"]["lastPage"] is None
    assert response.json()["pageInfo"]["total"] is None
    assert response.json()["pageInfo"]["isExact"] is False
    assert metadata.json()["isExact"] is False
    assert metadata.json()["verificationStatus"] == "estimated"


def test_browse_repairs_degraded_anilist_search_page_info() -> None:
    degraded_client = DegradedSearchPageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"search": "Naruto", "page": 1, "per_page": 20},
        )
        metadata = client.get(
            "/api/anime/browse/page-info",
            params={"search": "Naruto", "page": 1, "per_page": 20},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 20
    assert response.json()["pageInfo"]["isExact"] is False
    assert metadata.json()["lastPage"] == 2
    assert metadata.json()["total"] == 26
    assert degraded_client.pages == [1, 2]


def test_browse_repairs_degraded_anilist_score_filter_page_info() -> None:
    degraded_client = DegradedScorePageInfoClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"minimum_score": 85, "sort": "top-rated", "page": 1, "per_page": 50},
        )
        metadata = client.get(
            "/api/anime/browse/page-info",
            params={"minimum_score": 85, "sort": "top-rated", "page": 1, "per_page": 50},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 50
    assert response.json()["pageInfo"]["isExact"] is False
    assert metadata.json()["lastPage"] == 3
    assert metadata.json()["total"] == 109
    assert degraded_client.pages == [1, 2, 3]


def test_anime_detail_response_is_frontend_compatible_and_missing_anime_is_404() -> None:
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: DetailAniListClient()

    with TestClient(application) as client:
        found = client.get("/api/anime/21")
        missing = client.get("/api/anime/999999999")

    assert found.status_code == 200
    assert found.json() == {
        "id": 21,
        "title": "ONE PIECE",
        "titles": {"english": "ONE PIECE", "romaji": "ONE PIECE", "native": "ONE PIECE"},
        "description": "A pirate adventure.",
        "coverImage": "https://s4.anilist.co/example.jpg",
        "color": None,
        "bannerImage": None,
        "averageScore": None,
        "meanScore": None,
        "popularity": None,
        "genres": ["Action", "Adventure"],
        "format": None,
        "status": None,
        "episodes": 1140,
        "duration": None,
        "season": None,
        "seasonYear": None,
        "startDate": None,
        "endDate": None,
        "studios": [],
        "source": None,
        "countryOfOrigin": None,
        "synonyms": [],
        "siteUrl": None,
        "isAdult": False,
        "relations": [],
        "recommendations": [],
    }
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Anime not found."}
