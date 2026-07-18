import asyncio
from collections.abc import Callable

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_anilist_client
from app.clients.anilist import AniListClient
from app.core.config import get_settings
from app.core.exceptions import AniListResponseError, AniListTimeoutError, AniListUnavailableError
from app.main import create_app


def test_health_check_and_startup_without_a_local_env_file() -> None:
    # Passing an empty mapping proves the application has safe defaults without .env.
    application = create_app(get_settings({}))
    with TestClient(application) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_settings_parse_multiple_normalised_cors_origins() -> None:
    settings = get_settings(
        {
            "APP_ENV": "production",
            "CORS_ALLOWED_ORIGINS": " http://localhost:3000/ , https://recommend-me-anime.vercel.app/ ",
            "EXTERNAL_API_TIMEOUT_SECONDS": "12.5",
            "CACHE_TTL_SECONDS": "120",
            "LOG_LEVEL": "warning",
        }
    )
    assert settings.app_env == "production"
    assert settings.cors_allowed_origins == (
        "http://localhost:3000",
        "https://recommend-me-anime.vercel.app",
    )
    assert settings.external_api_timeout_seconds == 12.5
    assert settings.cache_ttl_seconds == 120
    assert settings.log_level == "WARNING"


def test_cors_accepts_local_and_configured_origins_but_rejects_others() -> None:
    application = create_app(
        get_settings(
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
    "handler",
    [
        lambda request: httpx.Response(502, request=request, json={"message": "bad gateway"}),
        lambda request: httpx.Response(200, request=request, json={"errors": [{"message": "invalid query"}]}),
        lambda request: httpx.Response(200, request=request, content=b"not valid JSON"),
    ],
)
def test_anilist_unusable_upstream_responses_are_not_exposed(
    handler: Callable[[httpx.Request], httpx.Response],
) -> None:
    with pytest.raises(AniListResponseError):
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
        item_count = max(0, min(per_page, total - (page - 1) * per_page))
        return {
            "pageInfo": {
                "total": total,
                "currentPage": page,
                "lastPage": 4,
                "hasNextPage": page < 4,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Result {(page - 1) * per_page + index + 1}"},
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
        item_count = 20 if page == 1 else 6 if page == 2 else 0
        return {
            "pageInfo": {
                "total": 5000 if page == 1 else 26,
                "currentPage": page,
                "lastPage": 250 if page == 1 else page,
                "hasNextPage": page == 1,
                "perPage": per_page,
            },
            "media": [
                {
                    "id": (page - 1) * per_page + index + 1,
                    "title": {"english": f"Naruto result {(page - 1) * per_page + index + 1}"},
                }
                for index in range(item_count)
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
            "relations": {"nodes": []},
            "recommendations": {"nodes": []},
        }


@pytest.mark.parametrize(
    ("upstream_error", "expected_status"),
    [
        (AniListUnavailableError(), 503),
        (AniListTimeoutError(), 504),
        (AniListResponseError(), 502),
    ],
)
def test_upstream_failures_return_stable_gateway_responses(upstream_error: Exception, expected_status: int) -> None:
    application = create_app(get_settings({}))
    application.dependency_overrides[get_anilist_client] = lambda: FailingAniListClient(upstream_error)
    with TestClient(application) as client:
        response = client.get("/api/anime/trending")

    assert response.status_code == expected_status
    assert "detail" in response.json()


def test_invalid_search_parameters_are_stable_and_frontend_response_is_compatible() -> None:
    application = create_app(get_settings({}))
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
                "relations": [],
                "recommendations": [],
            }
        ],
        "pageInfo": {"currentPage": 1, "hasNextPage": False, "lastPage": 1, "perPage": 1, "total": 1},
    }


def test_browse_forwards_search_filters_and_pagination_to_anilist() -> None:
    recording_client = RecordingAniListClient()
    application = create_app(get_settings({}))
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
        "lastPage": 4,
        "perPage": 20,
        "total": 61,
    }
    assert recording_client.parameters == {
        "page": 3,
        "per_page": 20,
        "search": "Frieren",
        "genre": None,
        "genre_in": ["Fantasy", "Adventure"],
        "anime_format": "TV",
        "format_in": None,
        "season": None,
        "season_year": None,
        "minimum_score": 80,
        "sort": ["SCORE_DESC", "POPULARITY_DESC"],
    }
    assert [int(call["page"]) for call in recording_client.calls] == [3, 4]
    assert recording_client.calls[1] == {**recording_client.parameters, "page": 4}
    assert invalid_page_size.status_code == 400


def test_browse_repairs_degraded_anilist_search_page_info() -> None:
    degraded_client = DegradedSearchPageInfoClient()
    application = create_app(get_settings({}))
    application.dependency_overrides[get_anilist_client] = lambda: degraded_client

    with TestClient(application) as client:
        response = client.get(
            "/api/anime/browse",
            params={"search": "Naruto", "page": 1, "per_page": 20},
        )

    assert response.status_code == 200
    assert len(response.json()["items"]) == 20
    assert response.json()["pageInfo"] == {
        "currentPage": 1,
        "hasNextPage": True,
        "lastPage": 2,
        "perPage": 20,
        "total": 26,
    }
    assert degraded_client.pages == [1, 2]


def test_anime_detail_response_is_frontend_compatible_and_missing_anime_is_404() -> None:
    application = create_app(get_settings({}))
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
        "relations": [],
        "recommendations": [],
    }
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Anime not found."}
