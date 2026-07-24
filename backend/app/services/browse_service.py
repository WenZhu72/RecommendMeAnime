from __future__ import annotations

import asyncio
import logging
from collections.abc import Mapping
from time import monotonic

from app.clients.anilist import AniListClient
from app.core.config import Settings
from app.repositories.pagination_metadata import PaginationMetadata
from app.schemas.anime import BrowseAnimeListResponse, BrowsePageInfo
from app.services.anime_service import is_safe_catalogue_anime, map_anime
from app.services.browse_cache import BrowsePageCache, CachedBrowsePage, PageEvidence, cached_page
from app.services.browse_filters import BrowseFilterSet, ordered_filter_key
from app.services.pagination_metadata import (
    PaginationMetadataService,
    exact_page_info_from_evidence,
    page_info_from_metadata,
)

logger = logging.getLogger(__name__)


class BrowseService:
    """Serve Browse cards first and maintain pagination on an independent path."""

    def __init__(
        self,
        *,
        client: AniListClient,
        cache: BrowsePageCache,
        pagination: PaginationMetadataService,
        settings: Settings,
    ) -> None:
        self.client = client
        self.cache = cache
        self.pagination = pagination
        self.settings = settings

    @staticmethod
    def _contradicts(metadata: PaginationMetadata | None, evidence: PageEvidence) -> bool:
        return (
            metadata is not None
            and metadata.last_page is not None
            and (
                evidence.page > metadata.last_page
                or (evidence.page == metadata.last_page and evidence.has_next_page)
                or (
                    evidence.page < metadata.last_page
                    and not evidence.has_next_page
                    and evidence.is_non_empty
                )
                or (evidence.page == metadata.last_page and not evidence.is_non_empty)
            )
        )

    async def _fetch_page(self, filters: BrowseFilterSet, page: int) -> CachedBrowsePage:
        parameters = {
            "page": page,
            "per_page": filters.per_page,
            **filters.anilist_arguments(),
        }
        operation_request = getattr(self.client, "list_media_for_operation", None)
        raw = (
            await operation_request(operation_name="browse_page_fetch", **parameters)
            if callable(operation_request)
            else await self.client.list_media(**parameters)
        )
        raw_info = raw.get("pageInfo")
        raw_media = raw.get("media")
        if not isinstance(raw_info, Mapping) or not isinstance(raw_media, list):
            raise ValueError("AniList Browse response was malformed")
        items = [
            map_anime(item)
            for item in raw_media
            if isinstance(item, Mapping) and is_safe_catalogue_anime(item)
        ]
        return cached_page(
            items=items,
            page=int(raw_info.get("currentPage") or page),
            per_page=int(raw_info.get("perPage") or filters.per_page),
            has_next_page=bool(raw_info.get("hasNextPage")),
            item_count=len(raw_media),
        )

    async def browse(self, filters: BrowseFilterSet, *, page: int) -> BrowseAnimeListResponse:
        started_at = monotonic()
        page_filter_key = ordered_filter_key(filters)
        page_task = asyncio.create_task(
            self.cache.get_or_create(
                page_filter_key,
                page,
                filters=filters,
                creator=lambda: self._fetch_page(filters, page),
            )
        )
        metadata_task = asyncio.create_task(self.pagination.read(filters, touch=True))
        known_metadata = self.pagination.peek(filters)

        # Begin missing/stale resolution from the first Browse request. It is
        # intentionally not awaited by the catalogue response.
        async def start_and_observe() -> None:
            try:
                metadata = await metadata_task
                resolved_page = await asyncio.shield(page_task)
                self.cache.set(
                    page_filter_key,
                    page,
                    resolved_page,
                    filters=filters,
                    access_count=metadata.access_count if metadata is not None else 1,
                )
                evidence = resolved_page.evidence
                if self.pagination.terminal_is_exact(evidence):
                    await self.pagination.persist_terminal(filters, evidence)
                    return
                if self._contradicts(metadata, evidence):
                    await self.pagination.repair_contradiction(
                        filters,
                        evidence=evidence,
                        seed=resolved_page,
                    )
                    return
                await self.pagination.start(
                    filters,
                    metadata=metadata,
                    seed_page=page,
                    seed_task=page_task,
                )
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.warning(
                    "Browse metadata maintenance failed category=%s",
                    type(error).__name__,
                )

        maintenance_task = asyncio.create_task(start_and_observe())

        def observe_maintenance(task: asyncio.Task[None]) -> None:
            if not task.cancelled():
                task.exception()

        maintenance_task.add_done_callback(observe_maintenance)

        resolved_page = await page_task
        evidence = resolved_page.evidence
        metadata = (
            metadata_task.result()
            if (
                metadata_task.done()
                and not metadata_task.cancelled()
                and metadata_task.exception() is None
            )
            else known_metadata
        )
        if self.pagination.terminal_is_exact(evidence):
            page_info = exact_page_info_from_evidence(evidence)
        elif self._contradicts(metadata, evidence):
            page_info = BrowsePageInfo(
                current_page=evidence.page,
                has_next_page=evidence.has_next_page,
                last_page=None,
                per_page=evidence.per_page,
                total=None,
                is_exact=False,
                verification_status="stale",
                last_verified_at=metadata.last_verified_at if metadata is not None else None,
            )
        else:
            page_info = page_info_from_metadata(metadata, evidence, self.settings)
        logger.info(
            "Browse anime response ready duration_ms=%.1f metadata_status=%s",
            (monotonic() - started_at) * 1000,
            page_info.verification_status,
        )
        return BrowseAnimeListResponse(
            items=[item.model_copy(deep=True) for item in resolved_page.items],
            page_info=page_info,
        )

    async def page_info(self, filters: BrowseFilterSet, *, page: int):
        page_filter_key = ordered_filter_key(filters)
        cached = self.cache.get(page_filter_key, page)
        evidence = (
            cached.evidence
            if cached is not None
            else PageEvidence(
                page=page,
                per_page=filters.per_page,
                item_count=0,
                has_next_page=True,
            )
        )
        known_metadata = await self.pagination.read(filters, touch=False)
        if self._contradicts(known_metadata, evidence):
            if cached is not None:
                await self.pagination.repair_contradiction(
                    filters,
                    evidence=evidence,
                    seed=cached,
                )
        metadata = await self.pagination.resolve(
            filters,
            evidence=evidence,
            seed=cached,
        )
        return page_info_from_metadata(metadata, evidence, self.settings)
