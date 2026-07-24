from fastapi.testclient import TestClient

from app.api.dependencies import get_anilist_client
from tests.support import create_test_app


class HomeCatalogueClient:
    def __init__(self) -> None:
        self.operations: list[dict[str, object]] = []
        self.exact_pagination_calls = 0

    async def list_media_for_operation(self, **parameters: object) -> dict[str, object]:
        self.operations.append(parameters)
        return {
            "pageInfo": {
                "total": 1,
                "currentPage": 1,
                "lastPage": 1,
                "hasNextPage": False,
                "perPage": int(parameters["per_page"]),
            },
            "media": [
                {
                    "id": len(self.operations),
                    "title": {"english": "Home catalogue anime"},
                    "coverImage": {"large": "https://s4.anilist.co/example.jpg"},
                    "genres": ["Action"],
                    "isAdult": False,
                }
            ],
        }

    async def resolve_exact_pagination(self, *_: object, **__: object) -> object:
        self.exact_pagination_calls += 1
        raise AssertionError("Home catalogue endpoints must not resolve exact pagination")


def test_home_catalogue_endpoints_never_enter_browse_exact_pagination() -> None:
    anilist = HomeCatalogueClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: anilist

    with TestClient(application) as client:
        responses = [
            client.get("/api/anime/trending", params={"per_page": 10}),
            client.get("/api/anime/popular", params={"per_page": 10}),
            client.get("/api/anime/top-rated", params={"per_page": 50}),
        ]

    assert all(response.status_code == 200 for response in responses)
    assert [operation["operation_name"] for operation in anilist.operations] == [
        "anime_page_fetch",
        "anime_page_fetch",
        "anime_page_fetch",
    ]
    assert [operation["per_page"] for operation in anilist.operations] == [10, 10, 50]
    assert anilist.exact_pagination_calls == 0


def test_recommendation_candidates_explicitly_skip_exact_pagination() -> None:
    anilist = HomeCatalogueClient()
    application = create_test_app()
    application.dependency_overrides[get_anilist_client] = lambda: anilist

    with TestClient(application) as client:
        response = client.post(
            "/api/recommendations",
            json={
                "favoriteGenres": ["Action"],
                "avoidedGenres": [],
                "formats": [],
                "preferredLength": "any",
                "releasePeriod": "any",
                "minimumScore": 85,
                "popularity": "popular",
                "tones": [],
            },
        )

    assert response.status_code == 200
    assert [operation["operation_name"] for operation in anilist.operations] == ["anime_page_fetch"]
    assert anilist.operations[0]["minimum_score"] == 84
    assert anilist.exact_pagination_calls == 0
