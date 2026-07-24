from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from time import monotonic

from app.clients.anilist import AniListClient
from app.core.config import Settings
from app.repositories.pagination_metadata import (
    PaginationMetadata,
    PaginationMetadataStore,
    VerificationStatus,
)
from app.schemas.anime import BrowsePageInfo
from app.services.browse_cache import CachedBrowsePage, PageEvidence
from app.services.browse_filters import BrowseFilterSet, metadata_filter_key

logger = logging.getLogger(__name__)


def _key_hash(filter_key: str) -> str:
    return sha256(filter_key.encode("utf-8")).hexdigest()[:12]


@dataclass(frozen=True)
class _ExactBoundary:
    last_page: int
    total_titles: int
    calls: int


@dataclass(frozen=True)
class _EstimatedBoundary:
    last_page: int | None
    calls: int


_Boundary = _ExactBoundary | _EstimatedBoundary


def _metadata_reference_time(metadata: PaginationMetadata) -> datetime:
    if metadata.verification_status == "estimated":
        return metadata.updated_at
    return metadata.last_verified_at or metadata.updated_at


def metadata_is_fresh(metadata: PaginationMetadata, settings: Settings, *, now: datetime | None = None) -> bool:
    checked_at = now or datetime.now(timezone.utc)
    return (
        metadata.is_exact
        and metadata.last_verified_at is not None
        and checked_at - metadata.last_verified_at
        <= timedelta(hours=settings.pagination_fresh_hours)
    )


def metadata_needs_verification(
    metadata: PaginationMetadata | None,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> bool:
    checked_at = now or datetime.now(timezone.utc)
    if metadata is None:
        return True
    if metadata.next_retry_at is not None and metadata.next_retry_at > checked_at:
        return False
    if metadata_is_fresh(metadata, settings, now=checked_at):
        return False
    if metadata.verification_status == "estimated":
        return checked_at - _metadata_reference_time(metadata) > timedelta(
            hours=settings.pagination_fresh_hours
        )
    return True


def metadata_age_state(
    metadata: PaginationMetadata | None,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> str:
    if metadata is None:
        return "missing"
    checked_at = now or datetime.now(timezone.utc)
    age = checked_at - _metadata_reference_time(metadata)
    if age <= timedelta(hours=settings.pagination_fresh_hours):
        return "fresh"
    if age <= timedelta(days=settings.pagination_very_stale_days):
        return "moderately_stale"
    return "very_stale"


def public_verification_status(
    metadata: PaginationMetadata | None,
    settings: Settings,
    *,
    now: datetime | None = None,
) -> VerificationStatus:
    checked_at = now or datetime.now(timezone.utc)
    if metadata is None:
        return "calculating"
    if metadata.is_exact:
        if metadata_is_fresh(metadata, settings, now=checked_at):
            return "verified"
        if metadata.verification_status == "failed":
            return "failed"
        return "stale"
    return metadata.verification_status


def page_info_from_metadata(
    metadata: PaginationMetadata | None,
    evidence: PageEvidence,
    settings: Settings,
) -> BrowsePageInfo:
    has_exact_value = (
        metadata is not None
        and metadata.is_exact
        and metadata.last_page is not None
        and metadata.total_titles is not None
    )
    return BrowsePageInfo(
        current_page=evidence.page,
        has_next_page=evidence.has_next_page,
        last_page=metadata.last_page if has_exact_value else None,
        per_page=evidence.per_page,
        total=metadata.total_titles if has_exact_value else None,
        is_exact=has_exact_value,
        verification_status=public_verification_status(metadata, settings),
        last_verified_at=metadata.last_verified_at if metadata is not None else None,
    )


def exact_page_info_from_evidence(evidence: PageEvidence) -> BrowsePageInfo:
    total = (evidence.page - 1) * evidence.per_page + evidence.item_count
    return BrowsePageInfo(
        current_page=evidence.page,
        has_next_page=False,
        last_page=evidence.page,
        per_page=evidence.per_page,
        total=total,
        is_exact=True,
        verification_status="verified",
        last_verified_at=datetime.now(timezone.utc),
    )


class PaginationMetadataService:
    """Persistent, single-flight exact-boundary discovery for Browse only."""

    def __init__(
        self,
        *,
        store: PaginationMetadataStore,
        client: AniListClient,
        settings: Settings,
    ) -> None:
        self.store = store
        self.client = client
        self.settings = settings
        self._tasks: dict[str, asyncio.Task[PaginationMetadata | None]] = {}
        self._task_lock = asyncio.Lock()
        self._probe_semaphore = asyncio.Semaphore(settings.pagination_max_concurrent_probes)

    @property
    def max_probe_page(self) -> int:
        return int(
            getattr(
                self.client,
                "exact_probe_max_page",
                self.settings.anilist_exact_probe_max_page,
            )
        )

    async def shutdown(self) -> None:
        async with self._task_lock:
            tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def terminal_is_exact(self, evidence: PageEvidence) -> bool:
        if evidence.has_next_page or (not evidence.is_non_empty and evidence.page != 1):
            return False
        return not (
            evidence.page >= self.max_probe_page
            and evidence.item_count >= evidence.per_page
        )

    async def read(
        self,
        filters: BrowseFilterSet,
        *,
        touch: bool,
    ) -> PaginationMetadata | None:
        filter_key = metadata_filter_key(filters)
        metadata = await self.store.get(filter_key, touch=touch)
        age = (
            (datetime.now(timezone.utc) - _metadata_reference_time(metadata)).total_seconds()
            if metadata is not None
            else None
        )
        logger.info(
            "Pagination metadata %s filter_key=%s age_seconds=%s status=%s age_state=%s",
            "hit" if metadata is not None else "miss",
            _key_hash(filter_key),
            f"{age:.0f}" if age is not None else None,
            public_verification_status(metadata, self.settings),
            metadata_age_state(metadata, self.settings),
        )
        return metadata

    def peek(self, filters: BrowseFilterSet) -> PaginationMetadata | None:
        return self.store.peek(metadata_filter_key(filters))

    async def start(
        self,
        filters: BrowseFilterSet,
        *,
        metadata: PaginationMetadata | None,
        seed_page: int | None = None,
        seed_task: asyncio.Future[CachedBrowsePage] | asyncio.Task[CachedBrowsePage] | None = None,
        force: bool = False,
    ) -> asyncio.Task[PaginationMetadata | None] | None:
        if not force and not metadata_needs_verification(metadata, self.settings):
            return None
        filter_key = metadata_filter_key(filters)
        async with self._task_lock:
            existing = self._tasks.get(filter_key)
            if existing is not None:
                logger.info("Pagination single-flight join filter_key=%s", _key_hash(filter_key))
                return existing
            task = asyncio.create_task(
                self._run(
                    filters,
                    filter_key=filter_key,
                    stored=metadata,
                    seed_page=seed_page,
                    seed_task=seed_task,
                ),
                name=f"pagination:{_key_hash(filter_key)}",
            )
            self._tasks[filter_key] = task
            return task

    async def resolve(
        self,
        filters: BrowseFilterSet,
        *,
        evidence: PageEvidence,
        seed: CachedBrowsePage | None,
    ) -> PaginationMetadata | None:
        metadata = await self.read(filters, touch=False)
        if self.terminal_is_exact(evidence):
            return await self.store.save_verified(
                metadata_filter_key(filters),
                last_page=evidence.page,
                total_titles=(evidence.page - 1) * evidence.per_page + evidence.item_count,
            )
        seed_future: asyncio.Future[CachedBrowsePage] | None = None
        if seed is not None:
            seed_future = asyncio.get_running_loop().create_future()
            seed_future.set_result(seed)
        task = await self.start(
            filters,
            metadata=metadata,
            seed_page=evidence.page,
            seed_task=seed_future,
        )
        if task is not None:
            try:
                async with asyncio.timeout(self.settings.pagination_probe_timeout_seconds):
                    resolved = await asyncio.shield(task)
                if resolved is not None:
                    return resolved
            except TimeoutError:
                logger.info(
                    "Pagination metadata endpoint wait expired filter_key=%s",
                    _key_hash(metadata_filter_key(filters)),
                )
        return await self.read(filters, touch=False)

    async def repair_contradiction(
        self,
        filters: BrowseFilterSet,
        *,
        evidence: PageEvidence,
        seed: CachedBrowsePage,
    ) -> None:
        filter_key = metadata_filter_key(filters)
        await self.store.mark_stale(
            filter_key,
            minimum_last_page=evidence.page + (1 if evidence.has_next_page else 0),
        )
        stale = await self.store.get(filter_key)
        seed_future: asyncio.Future[CachedBrowsePage] = asyncio.get_running_loop().create_future()
        seed_future.set_result(seed)
        await self.start(
            filters,
            metadata=stale,
            seed_page=evidence.page,
            seed_task=seed_future,
            force=True,
        )

    async def persist_terminal(self, filters: BrowseFilterSet, evidence: PageEvidence) -> None:
        await self.store.save_verified(
            metadata_filter_key(filters),
            last_page=evidence.page,
            total_titles=(evidence.page - 1) * evidence.per_page + evidence.item_count,
        )

    async def _run(
        self,
        filters: BrowseFilterSet,
        *,
        filter_key: str,
        stored: PaginationMetadata | None,
        seed_page: int | None,
        seed_task: asyncio.Future[CachedBrowsePage] | asyncio.Task[CachedBrowsePage] | None,
    ) -> PaginationMetadata | None:
        current = asyncio.current_task()
        started_at = monotonic()
        try:
            claimed = await self.store.try_claim(
                filter_key,
                lease_seconds=self.settings.pagination_probe_timeout_seconds,
            )
            if not claimed:
                logger.info("Pagination persistent single-flight join filter_key=%s", _key_hash(filter_key))
                return await self._wait_for_peer(filter_key)

            strategy = "boundary" if stored is not None and stored.last_page else (
                "sequential" if filters.is_narrow() else "exponential"
            )
            logger.info(
                "Pagination verification start filter_key=%s strategy=%s",
                _key_hash(filter_key),
                strategy,
            )
            try:
                async with self._probe_semaphore:
                    async with asyncio.timeout(self.settings.pagination_probe_timeout_seconds):
                        boundary = await self._discover(
                            filters,
                            stored=stored,
                            seed_page=seed_page,
                            seed_task=seed_task,
                        )
            except asyncio.CancelledError:
                raise
            except Exception as error:
                failed = await self.store.save_failure(
                    filter_key,
                    retry_backoff_seconds=self.settings.pagination_retry_backoff_seconds,
                )
                logger.warning(
                    "Pagination verification failed filter_key=%s category=%s failures=%d",
                    _key_hash(filter_key),
                    type(error).__name__,
                    failed.consecutive_failure_count,
                )
                return failed

            if isinstance(boundary, _ExactBoundary):
                result = await self.store.save_verified(
                    filter_key,
                    last_page=boundary.last_page,
                    total_titles=boundary.total_titles,
                )
                exact = True
            else:
                result = await self.store.save_estimated(
                    filter_key,
                    last_page=boundary.last_page,
                )
                exact = False
            logger.info(
                "Pagination verification complete filter_key=%s exact=%s calls=%d duration_ms=%.1f",
                _key_hash(filter_key),
                exact,
                boundary.calls,
                (monotonic() - started_at) * 1000,
            )
            return result
        finally:
            async with self._task_lock:
                if self._tasks.get(filter_key) is current:
                    self._tasks.pop(filter_key, None)

    async def _wait_for_peer(self, filter_key: str) -> PaginationMetadata | None:
        deadline = monotonic() + self.settings.pagination_probe_timeout_seconds
        while monotonic() < deadline:
            await asyncio.sleep(0.1)
            metadata = await self.store.get(filter_key)
            if metadata is not None and metadata.verification_status != "calculating":
                return metadata
        return await self.store.get(filter_key)

    async def _discover(
        self,
        filters: BrowseFilterSet,
        *,
        stored: PaginationMetadata | None,
        seed_page: int | None,
        seed_task: asyncio.Future[CachedBrowsePage] | asyncio.Task[CachedBrowsePage] | None,
    ) -> _Boundary:
        pages: dict[int, PageEvidence] = {}
        calls = 0
        seed_loaded = False

        async def load_seed() -> None:
            nonlocal seed_loaded
            if seed_loaded or seed_page is None or seed_task is None:
                return
            seed_loaded = True
            try:
                page = await asyncio.shield(seed_task)
            except Exception:
                return
            pages[seed_page] = page.evidence

        async def fetch(page: int) -> PageEvidence:
            nonlocal calls
            if page == seed_page:
                await load_seed()
            elif seed_task is not None and seed_task.done():
                await load_seed()
            cached = pages.get(page)
            if cached is not None:
                return cached
            parameters = {
                "page": page,
                "per_page": filters.per_page,
                **filters.anilist_arguments(),
            }
            operation_request = getattr(self.client, "list_media_for_operation", None)
            raw = (
                await operation_request(operation_name="pagination_probe", **parameters)
                if callable(operation_request)
                else await self.client.list_media(**parameters)
            )
            raw_info = raw.get("pageInfo")
            raw_media = raw.get("media")
            if not isinstance(raw_info, dict) or not isinstance(raw_media, list):
                raise ValueError("AniList pagination probe response was malformed")
            evidence = PageEvidence(
                page=page,
                per_page=filters.per_page,
                item_count=len(raw_media),
                has_next_page=bool(raw_info.get("hasNextPage")),
            )
            pages[page] = evidence
            calls += 1
            return evidence

        def exact(evidence: PageEvidence) -> _ExactBoundary | None:
            if not self.terminal_is_exact(evidence):
                return None
            return _ExactBoundary(
                last_page=evidence.page,
                total_titles=(evidence.page - 1) * evidence.per_page + evidence.item_count,
                calls=calls,
            )

        if seed_task is not None and seed_task.done():
            await load_seed()
        for evidence in pages.values():
            if resolved := exact(evidence):
                return resolved

        if stored is not None and stored.last_page is not None:
            boundary_page = await fetch(stored.last_page)
            if resolved := exact(boundary_page):
                return resolved
            if boundary_page.is_non_empty and boundary_page.has_next_page:
                return await self._probe_upward(fetch, exact, boundary_page.page, lambda: calls)
            if not boundary_page.is_non_empty:
                first = await fetch(1)
                if resolved := exact(first):
                    return resolved
                return await self._binary_between(
                    fetch,
                    exact,
                    lower=1,
                    upper=boundary_page.page,
                    calls=lambda: calls,
                )

        first = await fetch(1)
        if resolved := exact(first):
            return resolved
        lower = 1
        if filters.is_narrow():
            for candidate in range(2, min(4, self.max_probe_page) + 1):
                evidence = await fetch(candidate)
                if resolved := exact(evidence):
                    return resolved
                if not evidence.is_non_empty:
                    return await self._binary_between(
                        fetch,
                        exact,
                        lower=lower,
                        upper=candidate,
                        calls=lambda: calls,
                    )
                lower = candidate
        return await self._probe_upward(fetch, exact, lower, lambda: calls)

    async def _probe_upward(
        self,
        fetch: Callable[[int], Awaitable[PageEvidence]],
        exact: Callable[[PageEvidence], _ExactBoundary | None],
        lower: int,
        calls: Callable[[], int],
    ) -> _Boundary:
        maximum = self.max_probe_page
        step = 1
        while lower < maximum:
            upper = min(maximum, lower + step)
            evidence = await fetch(upper)
            if resolved := exact(evidence):
                return resolved
            if not evidence.is_non_empty:
                return await self._binary_between(
                    fetch,
                    exact,
                    lower=lower,
                    upper=upper,
                    calls=calls,
                )
            if upper == maximum:
                return _EstimatedBoundary(last_page=maximum, calls=calls())
            lower = upper
            step *= 2
        return _EstimatedBoundary(last_page=maximum, calls=calls())

    async def _binary_between(
        self,
        fetch: Callable[[int], Awaitable[PageEvidence]],
        exact: Callable[[PageEvidence], _ExactBoundary | None],
        *,
        lower: int,
        upper: int,
        calls: Callable[[], int],
    ) -> _Boundary:
        while upper - lower > 1:
            middle = (lower + upper) // 2
            evidence = await fetch(middle)
            if resolved := exact(evidence):
                return resolved
            if evidence.is_non_empty and evidence.has_next_page:
                lower = middle
            else:
                upper = middle
        terminal = await fetch(upper)
        if resolved := exact(terminal):
            return resolved
        return _EstimatedBoundary(last_page=None, calls=calls())
