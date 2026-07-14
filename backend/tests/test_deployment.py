import asyncio
from collections.abc import Callable

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_anilist_client
from app.clients.anilist import AniListClient
from app.core.config import get_settings
from app.core.exceptions import AniListResponseError, AniListTimeoutError
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


@pytest.mark.parametrize(
    ("upstream_error", "expected_status"),
    [
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
