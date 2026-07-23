import asyncio
import json
import logging

import httpx
import pytest

from app.api.dependencies import get_anilist_client
from app.clients.anilist import (
    AniListClient,
    ExactPaginationMetadata,
    ExactPaginationUnavailable,
    build_page_query_identity,
)
from app.core.config import get_settings
from app.core.exceptions import AniListUpstreamError
from app.main import create_app


FILTERS = {
    "search": None,
    "genre": None,
    "genre_in": ["Adventure", "Drama"],
    "anime_format": None,
    "format_in": None,
    "season": None,
    "season_year": None,
    "minimum_score": None,
    "sort": ["POPULARITY_DESC"],
}


def _filter_identity() -> str:
    return build_page_query_identity(**FILTERS)


def _page_payload(*, page: int, per_page: int, total: int = 46) -> dict[str, object]:
    last_page = max(1, (total + per_page - 1) // per_page)
    item_count = max(0, min(per_page, total - (page - 1) * per_page))
    return {
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
                        "title": {"english": f"Result {(page - 1) * per_page + index + 1}"},
                        "isAdult": False,
                    }
                    for index in range(item_count)
                ],
            }
        }
    }


class ControlledUpstream:
    def __init__(self, *, block_probe: bool = True, essential_failure_status: int | None = None) -> None:
        self.block_probe = block_probe
        self.essential_failure_status = essential_failure_status
        self.probe_started = asyncio.Event()
        self.release_probe = asyncio.Event()
        self.probe_calls = 0
        self.page_calls = 0

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        variables = json.loads(request.content)["variables"]
        page = int(variables["page"])
        per_page = int(variables["perPage"])
        if per_page == 50:
            self.probe_calls += 1
            self.probe_started.set()
            if self.block_probe:
                await self.release_probe.wait()
        else:
            self.page_calls += 1
            if self.essential_failure_status is not None:
                return httpx.Response(self.essential_failure_status, request=request)
        return httpx.Response(
            200,
            request=request,
            json=_page_payload(page=page, per_page=per_page),
        )


class WindowLimitedUpstream:
    def __init__(self, *, window_last_page: int = 100) -> None:
        self.window_last_page = window_last_page
        self.probe_pages: list[int] = []
        self.page_calls = 0

    async def __call__(self, request: httpx.Request) -> httpx.Response:
        variables = json.loads(request.content)["variables"]
        page = int(variables["page"])
        per_page = int(variables["perPage"])
        if per_page == 50:
            self.probe_pages.append(page)
            item_count = 50
            has_next_page = page < self.window_last_page
        else:
            self.page_calls += 1
            item_count = per_page
            has_next_page = True
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
                            "hasNextPage": has_next_page,
                            "perPage": per_page,
                        },
                        "media": [
                            {
                                "id": (page - 1) * per_page + index + 1,
                                "title": {"english": f"Window result {index + 1}"},
                                "isAdult": False,
                            }
                            for index in range(item_count)
                        ],
                    }
                }
            },
        )


async def _api_client(
    anilist: AniListClient,
) -> tuple[httpx.AsyncClient, object]:
    application = create_app(get_settings({}))
    application.dependency_overrides[get_anilist_client] = lambda: anilist
    transport = httpx.ASGITransport(app=application)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver"), application


def test_probe_ceiling_is_never_exceeded_and_unavailable_result_is_cached(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        upstream = WindowLimitedUpstream(window_last_page=100)
        transport = httpx.MockTransport(upstream)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
                exact_probe_response_wait_seconds=5,
                exact_probe_max_page=100,
            )
            api, _ = await _api_client(anilist)
            async with api:
                first = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama")],
                )
                probes_after_first_request = list(upstream.probe_pages)
                second = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama"), ("page", "2")],
                )

        assert first.status_code == 200
        assert first.json()["pageInfo"]["isExact"] is False
        assert first.json()["pageInfo"]["total"] == 0
        assert first.json()["pageInfo"]["lastPage"] == 2
        assert second.status_code == 200
        assert second.json()["pageInfo"]["isExact"] is False
        assert second.json()["pageInfo"]["total"] == 0
        assert second.json()["pageInfo"]["lastPage"] == 3
        assert probes_after_first_request == [1, 2, 4, 8, 16, 32, 64, 100]
        assert upstream.probe_pages == probes_after_first_request
        assert max(upstream.probe_pages) == 100
        assert 128 not in upstream.probe_pages
        assert anilist.get_cached_exact_pagination(_filter_identity()) == ExactPaginationUnavailable(
            max_probe_page=100
        )

    with caplog.at_level(logging.INFO, logger="app.clients.anilist"):
        asyncio.run(scenario())

    assert "reason=anilist_result_window_exceeded" in caplog.text
    assert "max_probe_page=100" in caplog.text


def test_unavailable_cache_expiry_allows_a_later_probe(monkeypatch: pytest.MonkeyPatch) -> None:
    async def scenario() -> None:
        clock = [0.0]
        resolver_calls = 0
        monkeypatch.setattr("app.clients.anilist.monotonic", lambda: clock[0])

        async def resolver() -> ExactPaginationUnavailable:
            nonlocal resolver_calls
            resolver_calls += 1
            return ExactPaginationUnavailable(max_probe_page=100)

        async with httpx.AsyncClient() as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=1,
                exact_probe_response_wait_seconds=1,
                exact_probe_max_page=100,
            )
            first = await anilist.resolve_exact_pagination("broad-filter", resolver)
            cached = await anilist.resolve_exact_pagination("broad-filter", resolver)
            clock[0] = 2
            retried = await anilist.resolve_exact_pagination("broad-filter", resolver)

        assert first == cached == retried == ExactPaginationUnavailable(max_probe_page=100)
        assert resolver_calls == 2

    asyncio.run(scenario())


def test_narrow_results_inside_probe_ceiling_still_return_exact_metadata() -> None:
    async def scenario() -> None:
        upstream = ControlledUpstream(block_probe=False)
        transport = httpx.MockTransport(upstream)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
                exact_probe_response_wait_seconds=5,
                exact_probe_max_page=100,
            )
            api, _ = await _api_client(anilist)
            async with api:
                response = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama")],
                )

        assert response.status_code == 200
        assert response.json()["pageInfo"] == {
            "currentPage": 1,
            "hasNextPage": True,
            "lastPage": 3,
            "perPage": 20,
            "total": 46,
            "isExact": True,
        }
        assert upstream.probe_calls == 1

    asyncio.run(scenario())


def test_slow_exact_probe_returns_200_then_populates_cache_for_the_next_page() -> None:
    async def scenario() -> None:
        upstream = ControlledUpstream()
        transport = httpx.MockTransport(upstream)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
                exact_probe_response_wait_seconds=0,
            )
            api, _ = await _api_client(anilist)
            async with api:
                first = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama")],
                )

                assert first.status_code == 200
                assert len(first.json()["items"]) == 20
                assert first.json()["pageInfo"]["isExact"] is False

                await asyncio.wait_for(upstream.probe_started.wait(), timeout=1)
                shared_task = anilist._exact_pagination_inflight[_filter_identity()]
                assert not shared_task.cancelled()

                upstream.release_probe.set()

                unexpected_resolvers = 0

                async def unexpected_resolver() -> ExactPaginationMetadata:
                    nonlocal unexpected_resolvers
                    unexpected_resolvers += 1
                    return ExactPaginationMetadata(total=999)

                metadata = await anilist.resolve_exact_pagination(
                    _filter_identity(),
                    unexpected_resolver,
                    response_wait_seconds=1,
                )
                assert metadata == ExactPaginationMetadata(total=46)
                assert unexpected_resolvers == 0
                assert anilist.get_cached_exact_pagination(_filter_identity()) == metadata

                second = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama"), ("page", "2")],
                )

            assert second.status_code == 200
            assert second.json()["pageInfo"] == {
                "currentPage": 2,
                "hasNextPage": True,
                "lastPage": 3,
                "perPage": 20,
                "total": 46,
                "isExact": True,
            }
            assert upstream.page_calls == 2
            assert upstream.probe_calls == 1

    asyncio.run(scenario())


def test_two_callers_share_probe_when_one_response_budget_expires() -> None:
    async def scenario() -> None:
        started = asyncio.Event()
        release = asyncio.Event()
        resolver_calls = 0

        async def resolver() -> ExactPaginationMetadata:
            nonlocal resolver_calls
            resolver_calls += 1
            started.set()
            await release.wait()
            return ExactPaginationMetadata(total=46)

        async with httpx.AsyncClient() as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
            )
            short_waiter = asyncio.create_task(
                anilist.resolve_exact_pagination(
                    "shared-filter",
                    resolver,
                    response_wait_seconds=0,
                )
            )
            long_waiter = asyncio.create_task(
                anilist.resolve_exact_pagination(
                    "shared-filter",
                    resolver,
                    response_wait_seconds=1,
                )
            )
            await asyncio.wait_for(started.wait(), timeout=1)
            with pytest.raises(TimeoutError):
                await short_waiter
            assert resolver_calls == 1
            assert not long_waiter.done()

            release.set()
            assert await long_waiter == ExactPaginationMetadata(total=46)
            assert anilist.get_cached_exact_pagination("shared-filter") == ExactPaginationMetadata(total=46)

    asyncio.run(scenario())


def test_background_probe_failure_is_observed_logged_and_cleaned_up(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        started = asyncio.Event()
        release = asyncio.Event()
        loop = asyncio.get_running_loop()
        loop_errors: list[dict[str, object]] = []
        previous_handler = loop.get_exception_handler()
        loop.set_exception_handler(lambda _loop, context: loop_errors.append(context))

        async def failing_resolver() -> ExactPaginationMetadata:
            started.set()
            await release.wait()
            raise AniListUpstreamError(503)

        try:
            async with httpx.AsyncClient() as http_client:
                anilist = AniListClient(
                    http_client,
                    cache_ttl_seconds=0,
                    exact_pagination_cache_ttl_seconds=3600,
                )
                with pytest.raises(TimeoutError):
                    await anilist.resolve_exact_pagination(
                        "failed-filter",
                        failing_resolver,
                        response_wait_seconds=0,
                    )
                await asyncio.wait_for(started.wait(), timeout=1)
                task = anilist._exact_pagination_inflight["failed-filter"]
                release.set()
                await task
                await asyncio.sleep(0)

                assert task.exception() is None
                assert "failed-filter" not in anilist._exact_pagination_inflight
                assert anilist.get_cached_exact_pagination("failed-filter") is None
                assert loop_errors == []
        finally:
            loop.set_exception_handler(previous_handler)

    with caplog.at_level(logging.WARNING, logger="app.clients.anilist"):
        asyncio.run(scenario())

    assert "Exact pagination shared task failed" in caplog.text
    assert "category=AniListUpstreamError" in caplog.text


def test_cached_exact_metadata_returns_without_starting_a_probe() -> None:
    async def scenario() -> None:
        upstream = ControlledUpstream(block_probe=False)
        transport = httpx.MockTransport(upstream)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
                exact_probe_response_wait_seconds=0,
            )
            anilist.store_exact_pagination(_filter_identity(), total=46)
            api, _ = await _api_client(anilist)
            async with api:
                response = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama")],
                )

        assert response.status_code == 200
        assert response.json()["pageInfo"]["isExact"] is True
        assert response.json()["pageInfo"]["total"] == 46
        assert upstream.page_calls == 1
        assert upstream.probe_calls == 0

    asyncio.run(scenario())


def test_genuine_upstream_504_on_essential_page_is_logged_and_returned_as_503(
    caplog: pytest.LogCaptureFixture,
) -> None:
    async def scenario() -> None:
        upstream = ControlledUpstream(block_probe=False, essential_failure_status=504)
        transport = httpx.MockTransport(upstream)
        async with httpx.AsyncClient(base_url="https://anilist.test", transport=transport) as http_client:
            anilist = AniListClient(
                http_client,
                cache_ttl_seconds=0,
                exact_pagination_cache_ttl_seconds=3600,
                exact_probe_response_wait_seconds=0,
            )
            api, _ = await _api_client(anilist)
            async with api:
                response = await api.get(
                    "/api/anime/browse",
                    params=[("genre", "Adventure"), ("genre", "Drama")],
                )

        assert response.status_code == 503
        assert response.json() == {
            "detail": "The catalogue provider is temporarily unavailable. Please try again shortly."
        }
        assert upstream.page_calls == 1
        assert upstream.probe_calls == 0

    with caplog.at_level(logging.WARNING, logger="app.clients.anilist"):
        asyncio.run(scenario())

    assert "status=504" in caplog.text
    assert "category=upstream_5xx" in caplog.text
