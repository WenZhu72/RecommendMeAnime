import asyncio
from datetime import datetime, timedelta, timezone

from app.services.browse_cache import BrowsePageCache, cached_page
from app.services.browse_filters import (
    BrowseFilterSet,
    browse_page_cache_key,
    canonical_filter_key,
    metadata_filter_key,
    ordered_filter_key,
    sort_semantics,
)
from app.services.browse_service import BrowseService
from app.services.pagination_metadata import PaginationMetadataService, metadata_needs_verification
from tests.support import InMemoryPaginationMetadataStore, make_test_settings


POPULAR = ["POPULARITY_DESC"]
TRENDING = ["TRENDING_DESC", "POPULARITY_DESC"]
TOP_RATED = ["SCORE_DESC", "POPULARITY_DESC"]


def filters(
    *,
    genres: list[str] | None = None,
    per_page: int = 20,
    search: str = "  Frieren   Beyond Journey's End  ",
    anime_format: str = "tv",
    season: str = "winter",
    season_year: int = 2022,
    minimum_score: int = 80,
    sort: list[str] | None = None,
) -> BrowseFilterSet:
    return BrowseFilterSet.create(
        search=search,
        genres=genres or ["Fantasy", "Adventure"],
        anime_format=anime_format,
        season=season,
        season_year=season_year,
        minimum_score=minimum_score,
        sort=sort or POPULAR,
        per_page=per_page,
    )


def test_metadata_key_normalises_filters_and_shares_reviewed_ordering_only_sorts() -> None:
    first = filters()
    equivalent = BrowseFilterSet.create(
        search="frieren beyond journey's end",
        genres=[" adventure ", "FANTASY", ""],
        anime_format="TV",
        season="WINTER",
        season_year=2022,
        minimum_score=80,
        sort=["popularity_desc"],
        per_page=20,
    )
    compatible_sorts = [
        filters(sort=POPULAR),
        filters(sort=TRENDING),
        filters(sort=TOP_RATED),
    ]
    single_value_sorts = [
        filters(sort=["POPULARITY_DESC"]),
        filters(sort=["TRENDING_DESC"]),
        filters(sort=["SCORE_DESC"]),
    ]

    assert canonical_filter_key(first) == canonical_filter_key(equivalent)
    assert len({metadata_filter_key(selected) for selected in compatible_sorts}) == 1
    assert {
        metadata_filter_key(selected) for selected in single_value_sorts
    } == {metadata_filter_key(first)}
    assert len({ordered_filter_key(selected) for selected in compatible_sorts}) == 3
    assert all(sort_semantics(selected.sort) == "ordering_only" for selected in compatible_sorts)
    assert "genres=ADVENTURE,FANTASY" in metadata_filter_key(first)
    assert "is_adult=false" in metadata_filter_key(first)
    assert "per_page=20" in metadata_filter_key(first)
    assert "sort=" not in metadata_filter_key(first)


def test_metadata_key_changes_only_for_membership_and_unknown_sort_semantics() -> None:
    base = filters()
    base_key = metadata_filter_key(base)
    membership_changes = [
        filters(per_page=50),
        filters(genres=["Drama"]),
        filters(anime_format="MOVIE"),
        filters(season="SPRING"),
        filters(season_year=2025),
        filters(search="Naruto"),
        filters(minimum_score=65),
    ]
    unknown_sort = filters(sort=["FUTURE_SORT_DESC"])

    assert all(metadata_filter_key(changed) != base_key for changed in membership_changes)
    assert sort_semantics(unknown_sort.sort) == "sort_specific"
    assert metadata_filter_key(unknown_sort) != base_key
    assert "sort=FUTURE_SORT_DESC" in metadata_filter_key(unknown_sort)
    assert browse_page_cache_key(ordered_filter_key(base), 1) != browse_page_cache_key(
        ordered_filter_key(base),
        2,
    )


class ControlledAniList:
    exact_probe_max_page = 250

    def __init__(self, *, fail_probe: bool = False) -> None:
        self.fail_probe = fail_probe
        self.probe_started = asyncio.Event()
        self.release_probe = asyncio.Event()
        self.calls: list[tuple[str, int]] = []
        self.requests: list[tuple[str, int, tuple[str, ...]]] = []

    async def list_media_for_operation(
        self,
        *,
        operation_name: str,
        page: int,
        per_page: int,
        sort: list[str] | None = None,
        **_: object,
    ):
        ordered_sort = tuple(sort or ())
        self.calls.append((operation_name, page))
        self.requests.append((operation_name, page, ordered_sort))
        if operation_name == "pagination_probe":
            self.probe_started.set()
            await self.release_probe.wait()
            if self.fail_probe:
                raise RuntimeError("metadata-only failure")
            count = 7
            has_next = False
        else:
            count = per_page
            has_next = True
        sort_offset = {
            tuple(POPULAR): 1_000,
            tuple(TRENDING): 2_000,
            tuple(TOP_RATED): 3_000,
        }.get(ordered_sort, 9_000)
        return {
            "pageInfo": {
                "currentPage": page,
                "perPage": per_page,
                "hasNextPage": has_next,
            },
            "media": [
                {
                    "id": sort_offset + (page - 1) * per_page + index + 1,
                    "title": {"english": f"Anime {index + 1}"},
                    "isAdult": False,
                }
                for index in range(count)
            ],
        }


async def make_services(client: ControlledAniList):
    settings = make_test_settings(
        {
            "PAGINATION_PROBE_TIMEOUT_SECONDS": "2",
            "PAGINATION_RETRY_BACKOFF_SECONDS": "300,900,3600,21600",
        }
    )
    store = InMemoryPaginationMetadataStore()
    await store.initialise()
    cache = BrowsePageCache(
        max_entries=8,
        hot_ttl_seconds=60,
        warm_ttl_seconds=30,
        cold_ttl_seconds=10,
        hot_access_threshold=3,
    )
    pagination = PaginationMetadataService(store=store, client=client, settings=settings)  # type: ignore[arg-type]
    browse = BrowseService(client=client, cache=cache, pagination=pagination, settings=settings)  # type: ignore[arg-type]
    return settings, store, cache, pagination, browse


async def wait_for_status(
    store: InMemoryPaginationMetadataStore,
    key: str,
    status: str,
):
    for _ in range(100):
        metadata = await store.get(key)
        if metadata is not None and metadata.verification_status == status:
            return metadata
        await asyncio.sleep(0.01)
    raise AssertionError(f"metadata did not reach {status}")


def test_missing_metadata_starts_immediately_without_blocking_anime_and_reuses_page_one() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, browse = await make_services(client)
        selected = filters()
        key = canonical_filter_key(selected)

        response = await browse.browse(selected, page=1)
        assert len(response.items) == 20
        assert response.page_info.is_exact is False
        assert response.page_info.last_page is None
        assert response.page_info.verification_status == "calculating"
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)

        # The visible page is reused as page-one evidence; only page two is a
        # pagination probe.
        assert client.calls.count(("browse_page_fetch", 1)) == 1
        assert ("pagination_probe", 1) not in client.calls

        client.release_probe.set()
        metadata = await wait_for_status(store, key, "verified")
        assert metadata.last_page == 2
        assert metadata.total_titles == 27
        assert metadata.access_count == 1

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_metadata_failure_keeps_cards_and_applies_retry_backoff() -> None:
    async def scenario() -> None:
        client = ControlledAniList(fail_probe=True)
        settings, store, cache, pagination, browse = await make_services(client)
        selected = filters(sort=POPULAR)
        key = canonical_filter_key(selected)

        response = await browse.browse(selected, page=1)
        assert len(response.items) == 20
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)
        client.release_probe.set()
        failed = await wait_for_status(store, key, "failed")
        assert failed.next_retry_at is not None
        assert metadata_needs_verification(failed, settings) is False

        probe_count = sum(operation == "pagination_probe" for operation, _ in client.calls)
        second = await browse.browse(filters(sort=TRENDING), page=1)
        await asyncio.sleep(0)
        assert len(second.items) == 20
        assert second.items[0].id != response.items[0].id
        assert sum(operation == "pagination_probe" for operation, _ in client.calls) == probe_count

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_concurrent_identical_browse_requests_share_page_fetch_and_metadata_probe() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, browse = await make_services(client)
        selected = filters()

        responses = await asyncio.gather(
            browse.browse(selected, page=1),
            browse.browse(selected, page=1),
        )
        assert [len(response.items) for response in responses] == [20, 20]
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)
        assert client.calls.count(("browse_page_fetch", 1)) == 1
        assert client.calls.count(("pagination_probe", 2)) == 1

        client.release_probe.set()
        await wait_for_status(store, canonical_filter_key(selected), "verified")
        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_compatible_sorts_share_one_probe_and_lease_but_keep_ordered_pages_separate() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, browse = await make_services(client)
        claim_keys: list[str] = []
        original_try_claim = store.try_claim

        async def counted_try_claim(filter_key: str, **options: object) -> bool:
            claim_keys.append(filter_key)
            return await original_try_claim(filter_key, **options)  # type: ignore[arg-type]

        store.try_claim = counted_try_claim  # type: ignore[method-assign]
        popular = filters(sort=POPULAR)
        trending = filters(sort=TRENDING)
        top_rated = filters(sort=TOP_RATED)

        popular_response, trending_response = await asyncio.gather(
            browse.browse(popular, page=1),
            browse.browse(trending, page=1),
        )
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)

        assert popular_response.items[0].id != trending_response.items[0].id
        assert client.calls.count(("browse_page_fetch", 1)) == 2
        assert client.calls.count(("pagination_probe", 2)) == 1
        assert claim_keys == [metadata_filter_key(popular)]
        assert cache.get(ordered_filter_key(popular), 1) is not None
        assert cache.get(ordered_filter_key(trending), 1) is not None
        assert ordered_filter_key(popular) != ordered_filter_key(trending)

        client.release_probe.set()
        metadata = await wait_for_status(store, metadata_filter_key(popular), "verified")
        assert metadata.total_titles == 27

        probe_count = sum(operation == "pagination_probe" for operation, _ in client.calls)
        top_rated_response = await browse.browse(top_rated, page=1)
        await asyncio.sleep(0)
        assert top_rated_response.page_info.total == 27
        assert top_rated_response.items[0].id not in {
            popular_response.items[0].id,
            trending_response.items[0].id,
        }
        assert sum(operation == "pagination_probe" for operation, _ in client.calls) == probe_count
        assert cache.get(ordered_filter_key(top_rated), 1) is not None

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_stale_metadata_is_returned_while_verification_runs() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, browse = await make_services(client)
        selected = filters()
        key = canonical_filter_key(selected)
        await store.save_verified(
            key,
            last_page=3,
            total_titles=47,
            now=datetime.now(timezone.utc) - timedelta(days=2),
        )

        response = await browse.browse(selected, page=1)
        assert response.page_info.total == 47
        assert response.page_info.last_page == 3
        assert response.page_info.verification_status == "stale"
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)

        client.release_probe.set()
        await wait_for_status(store, key, "verified")
        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_expired_shared_retry_can_be_recovered_by_another_compatible_sort() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        settings, store, cache, pagination, browse = await make_services(client)
        key = metadata_filter_key(filters(sort=POPULAR))
        failed = await store.save_failure(
            key,
            retry_backoff_seconds=(1,),
            now=datetime.now(timezone.utc) - timedelta(minutes=1),
        )
        assert metadata_needs_verification(failed, settings) is True

        response = await browse.browse(filters(sort=TRENDING), page=1)
        assert len(response.items) == 20
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)
        client.release_probe.set()
        recovered = await wait_for_status(store, key, "verified")
        assert recovered.total_titles == 27
        assert recovered.consecutive_failure_count == 0
        assert recovered.next_retry_at is None

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_contradictory_ordered_page_repairs_shared_metadata_for_all_sorts() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, browse = await make_services(client)
        popular = filters(sort=POPULAR)
        trending = filters(sort=TRENDING)
        key = metadata_filter_key(popular)
        await store.save_verified(key, last_page=2, total_titles=27)

        contradictory = await browse.browse(trending, page=2)
        assert contradictory.page_info.is_exact is False
        assert contradictory.page_info.verification_status == "stale"
        await asyncio.wait_for(client.probe_started.wait(), timeout=1)
        calculating = await store.get(key)
        assert calculating is not None
        assert calculating.last_page == 3
        assert calculating.verification_status == "calculating"

        client.release_probe.set()
        repaired = await wait_for_status(store, key, "verified")
        assert repaired.last_page == 3
        assert repaired.total_titles == 47

        reused = await browse.browse(popular, page=1)
        assert reused.page_info.last_page == 3
        assert reused.page_info.total == 47

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


class TerminalAniList(ControlledAniList):
    async def list_media_for_operation(
        self,
        *,
        operation_name: str,
        page: int,
        per_page: int,
        sort: list[str] | None = None,
        **_: object,
    ):
        ordered_sort = tuple(sort or ())
        self.calls.append((operation_name, page))
        self.requests.append((operation_name, page, ordered_sort))
        total = 47
        item_count = max(0, min(per_page, total - (page - 1) * per_page))
        has_next = page * per_page < total
        sort_offset = {
            tuple(POPULAR): 1_000,
            tuple(TRENDING): 2_000,
        }.get(ordered_sort, 9_000)
        return {
            "pageInfo": {
                "currentPage": page,
                "perPage": per_page,
                "hasNextPage": has_next,
            },
            "media": [
                {
                    "id": sort_offset + (page - 1) * per_page + index + 1,
                    "title": {"english": f"Anime {index + 1}"},
                    "isAdult": False,
                }
                for index in range(item_count)
            ],
        }


def test_partial_terminal_page_metadata_is_shared_without_combining_page_content() -> None:
    async def scenario() -> None:
        client = TerminalAniList()
        _, store, cache, pagination, browse = await make_services(client)
        popular = filters(sort=POPULAR)
        trending = filters(sort=TRENDING)

        terminal = await browse.browse(popular, page=3)
        assert terminal.page_info.is_exact is True
        assert terminal.page_info.total == 47
        persisted = await wait_for_status(store, metadata_filter_key(popular), "verified")
        assert persisted.total_titles == 47

        reused = await browse.browse(trending, page=1)
        assert reused.page_info.is_exact is True
        assert reused.page_info.total == 47
        assert terminal.items[0].id != reused.items[0].id
        assert not any(operation == "pagination_probe" for operation, _ in client.calls)
        assert cache.get(ordered_filter_key(popular), 3) is not None
        assert cache.get(ordered_filter_key(trending), 1) is not None

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_full_page_at_anilist_ceiling_remains_estimated_for_shared_metadata() -> None:
    async def scenario() -> None:
        client = ControlledAniList()
        _, store, cache, pagination, _ = await make_services(client)
        full_ceiling = cached_page(
            items=[],
            page=250,
            per_page=20,
            has_next_page=False,
            item_count=20,
        )

        assert pagination.terminal_is_exact(full_ceiling.evidence) is False

        await pagination.shutdown()
        await cache.shutdown()
        await store.close()

    asyncio.run(scenario())


def test_page_cache_uses_popularity_ttls_and_stays_bounded() -> None:
    cache = BrowsePageCache(
        max_entries=2,
        hot_ttl_seconds=60,
        warm_ttl_seconds=30,
        cold_ttl_seconds=10,
        hot_access_threshold=3,
    )
    default = BrowseFilterSet.create(per_page=20)
    niche = filters()
    page = cached_page(items=[], page=1, per_page=20, has_next_page=True)

    assert cache.set("default", 1, page, filters=default, access_count=1) == 60
    assert cache.set("niche", 6, page, filters=niche, access_count=1) == 10
    cache.set("popular", 1, page, filters=niche, access_count=5)
    assert cache.size == 2
    assert cache.get("default", 1) is None
