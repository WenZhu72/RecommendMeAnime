from __future__ import annotations

import asyncio
import logging
from collections import OrderedDict
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from time import monotonic

from app.schemas.anime import Anime
from app.services.browse_filters import BrowseFilterSet, browse_page_cache_key

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PageEvidence:
    page: int
    per_page: int
    item_count: int
    has_next_page: bool

    @property
    def is_non_empty(self) -> bool:
        return self.item_count > 0


@dataclass(frozen=True)
class CachedBrowsePage:
    items: tuple[Anime, ...]
    evidence: PageEvidence
    fetched_at: datetime


@dataclass
class _CacheEntry:
    value: CachedBrowsePage
    expires_at: float
    hit_count: int = 0


class BrowsePageCache:
    """Bounded LRU+TTL cache for transformed Browse page responses."""

    def __init__(
        self,
        *,
        max_entries: int,
        hot_ttl_seconds: int,
        warm_ttl_seconds: int,
        cold_ttl_seconds: int,
        hot_access_threshold: int,
    ) -> None:
        self._max_entries = max_entries
        self._hot_ttl_seconds = hot_ttl_seconds
        self._warm_ttl_seconds = warm_ttl_seconds
        self._cold_ttl_seconds = cold_ttl_seconds
        self._hot_access_threshold = hot_access_threshold
        self._entries: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._inflight: dict[str, asyncio.Task[CachedBrowsePage]] = {}
        self._inflight_lock = asyncio.Lock()

    @property
    def size(self) -> int:
        return len(self._entries)

    async def shutdown(self) -> None:
        async with self._inflight_lock:
            tasks = list(self._inflight.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    @staticmethod
    def key(ordered_filter_key: str, page: int) -> str:
        return browse_page_cache_key(ordered_filter_key, page)

    def get(self, ordered_filter_key: str, page: int) -> CachedBrowsePage | None:
        key = self.key(ordered_filter_key, page)
        entry = self._entries.get(key)
        if entry is None:
            logger.info("Browse page cache miss page=%d", page)
            return None
        if entry.expires_at <= monotonic():
            self._entries.pop(key, None)
            logger.info("Browse page cache miss reason=expired page=%d", page)
            return None
        entry.hit_count += 1
        now = monotonic()
        if page == 1 and entry.hit_count >= self._hot_access_threshold:
            entry.expires_at = max(entry.expires_at, now + self._hot_ttl_seconds)
        elif page <= 3 and entry.hit_count >= max(2, self._hot_access_threshold // 2):
            entry.expires_at = max(entry.expires_at, now + self._warm_ttl_seconds)
        self._entries.move_to_end(key)
        logger.info("Browse page cache hit page=%d hits=%d", page, entry.hit_count)
        return entry.value

    def _select_ttl(
        self,
        *,
        filters: BrowseFilterSet,
        page: int,
        access_count: int,
    ) -> tuple[int, str]:
        if page == 1 and (filters.is_default() or access_count >= self._hot_access_threshold):
            return self._hot_ttl_seconds, "hot"
        if page == 1 or (page <= 3 and access_count >= max(2, self._hot_access_threshold // 2)):
            return self._warm_ttl_seconds, "warm"
        return self._cold_ttl_seconds, "cold"

    def set(
        self,
        ordered_filter_key: str,
        page: int,
        value: CachedBrowsePage,
        *,
        filters: BrowseFilterSet,
        access_count: int,
    ) -> int:
        ttl, tier = self._select_ttl(filters=filters, page=page, access_count=access_count)
        if ttl <= 0 or self._max_entries <= 0:
            return 0
        key = self.key(ordered_filter_key, page)
        if key not in self._entries:
            while len(self._entries) >= self._max_entries:
                evicted_key, _ = self._entries.popitem(last=False)
                logger.info("Browse page cache eviction key_length=%d", len(evicted_key))
        self._entries[key] = _CacheEntry(value=value, expires_at=monotonic() + ttl)
        self._entries.move_to_end(key)
        logger.info("Browse page cache stored page=%d ttl_seconds=%d tier=%s", page, ttl, tier)
        return ttl

    async def get_or_create(
        self,
        ordered_filter_key: str,
        page: int,
        *,
        filters: BrowseFilterSet,
        creator: Callable[[], Awaitable[CachedBrowsePage]],
    ) -> CachedBrowsePage:
        cached = self.get(ordered_filter_key, page)
        if cached is not None:
            return cached
        key = self.key(ordered_filter_key, page)
        async with self._inflight_lock:
            cached = self.get(ordered_filter_key, page)
            if cached is not None:
                return cached
            task = self._inflight.get(key)
            if task is None:
                task = asyncio.create_task(creator(), name=f"browse-page:{page}")
                self._inflight[key] = task
            else:
                logger.info("Browse page request single-flight join page=%d", page)
        try:
            result = await asyncio.shield(task)
            self.set(
                ordered_filter_key,
                page,
                result,
                filters=filters,
                access_count=1,
            )
            return result
        finally:
            async with self._inflight_lock:
                if task.done() and self._inflight.get(key) is task:
                    self._inflight.pop(key, None)


def cached_page(
    *,
    items: list[Anime],
    page: int,
    per_page: int,
    has_next_page: bool,
    item_count: int | None = None,
) -> CachedBrowsePage:
    return CachedBrowsePage(
        items=tuple(item.model_copy(deep=True) for item in items),
        evidence=PageEvidence(
            page=page,
            per_page=per_page,
            item_count=len(items) if item_count is None else item_count,
            has_next_page=has_next_page,
        ),
        fetched_at=datetime.now(timezone.utc),
    )
