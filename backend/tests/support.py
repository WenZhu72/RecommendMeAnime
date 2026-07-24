from __future__ import annotations

import asyncio
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from typing import Mapping

from fastapi import FastAPI

from app.core.config import Settings, get_settings
from app.main import create_app
from app.repositories.pagination_metadata import (
    PaginationMetadata,
    VerificationStatus,
)

TEST_ENV = {
    "ENVIRONMENT": "test",
    "DATABASE_URL": (
        "postgresql+psycopg://postgres:development"
        "@localhost:5432/recommend_me_anime_test"
    ),
}


def make_test_settings(overrides: Mapping[str, str] | None = None) -> Settings:
    values = {**TEST_ENV, **dict(overrides or {})}
    return get_settings(values)


def create_test_app(config: Settings | None = None) -> FastAPI:
    return create_app(
        config or make_test_settings(),
        pagination_store=InMemoryPaginationMetadataStore(),  # type: ignore[arg-type]
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


class InMemoryPaginationMetadataStore:
    """Deterministic unit-test double; PostgreSQL behavior has integration tests."""

    def __init__(self) -> None:
        self._rows: dict[str, PaginationMetadata] = {}
        self._lock = asyncio.Lock()

    async def initialise(self) -> None:
        return None

    async def close(self) -> None:
        return None

    def peek(self, filter_key: str) -> PaginationMetadata | None:
        return self._rows.get(filter_key)

    async def get(
        self,
        filter_key: str,
        *,
        touch: bool = False,
    ) -> PaginationMetadata | None:
        async with self._lock:
            metadata = self._rows.get(filter_key)
            if metadata is not None and touch:
                accessed_at = _now()
                metadata = replace(
                    metadata,
                    access_count=metadata.access_count + 1,
                    last_accessed_at=accessed_at,
                    updated_at=accessed_at,
                )
                self._rows[filter_key] = metadata
            return metadata

    async def try_claim(
        self,
        filter_key: str,
        *,
        lease_seconds: float,
        now: datetime | None = None,
    ) -> bool:
        claimed_at = now or _now()
        lease_cutoff = claimed_at - timedelta(seconds=lease_seconds)
        async with self._lock:
            current = self._rows.get(filter_key)
            if (
                current is not None
                and current.verification_status == "calculating"
                and current.last_verification_attempt_at is not None
                and current.last_verification_attempt_at > lease_cutoff
            ):
                return False
            if (
                current is not None
                and current.next_retry_at is not None
                and current.next_retry_at > claimed_at
            ):
                return False
            if current is None:
                self._rows[filter_key] = PaginationMetadata(
                    filter_key=filter_key,
                    last_page=None,
                    total_titles=None,
                    is_exact=False,
                    verification_status="calculating",
                    last_verified_at=None,
                    last_verification_attempt_at=claimed_at,
                    next_retry_at=None,
                    consecutive_failure_count=0,
                    access_count=1,
                    last_accessed_at=claimed_at,
                    created_at=claimed_at,
                    updated_at=claimed_at,
                )
            else:
                self._rows[filter_key] = replace(
                    current,
                    verification_status="calculating",
                    last_verification_attempt_at=claimed_at,
                    updated_at=claimed_at,
                )
            return True

    async def save_verified(
        self,
        filter_key: str,
        *,
        last_page: int,
        total_titles: int,
        now: datetime | None = None,
    ) -> PaginationMetadata:
        verified_at = now or _now()
        async with self._lock:
            current = self._rows.get(filter_key)
            metadata = self._new_or_replace(
                current,
                filter_key=filter_key,
                now=verified_at,
                last_page=last_page,
                total_titles=total_titles,
                is_exact=True,
                verification_status="verified",
                last_verified_at=verified_at,
                last_verification_attempt_at=verified_at,
                next_retry_at=None,
                consecutive_failure_count=0,
            )
            self._rows[filter_key] = metadata
            return metadata

    async def save_estimated(
        self,
        filter_key: str,
        *,
        last_page: int | None,
        now: datetime | None = None,
    ) -> PaginationMetadata:
        attempted_at = now or _now()
        async with self._lock:
            current = self._rows.get(filter_key)
            selected_last_page = (
                last_page
                if last_page is not None
                else current.last_page if current is not None else None
            )
            metadata = self._new_or_replace(
                current,
                filter_key=filter_key,
                now=attempted_at,
                last_page=selected_last_page,
                total_titles=None,
                is_exact=False,
                verification_status="estimated",
                last_verified_at=None,
                last_verification_attempt_at=attempted_at,
                next_retry_at=None,
                consecutive_failure_count=0,
            )
            self._rows[filter_key] = metadata
            return metadata

    async def mark_stale(
        self,
        filter_key: str,
        *,
        minimum_last_page: int | None = None,
    ) -> PaginationMetadata | None:
        marked_at = _now()
        async with self._lock:
            current = self._rows.get(filter_key)
            if current is None:
                return None
            last_page = current.last_page
            if minimum_last_page is not None and (
                last_page is None or last_page < minimum_last_page
            ):
                last_page = minimum_last_page
            metadata = replace(
                current,
                last_page=last_page,
                is_exact=False,
                verification_status="stale",
                updated_at=marked_at,
            )
            self._rows[filter_key] = metadata
            return metadata

    async def save_failure(
        self,
        filter_key: str,
        *,
        retry_backoff_seconds: tuple[int, ...],
        now: datetime | None = None,
    ) -> PaginationMetadata:
        failed_at = now or _now()
        async with self._lock:
            current = self._rows.get(filter_key)
            failure_count = (
                current.consecutive_failure_count if current is not None else 0
            ) + 1
            delay = retry_backoff_seconds[
                min(failure_count - 1, len(retry_backoff_seconds) - 1)
            ]
            metadata = self._new_or_replace(
                current,
                filter_key=filter_key,
                now=failed_at,
                is_exact=current.is_exact if current is not None else False,
                verification_status="failed",
                last_verification_attempt_at=failed_at,
                next_retry_at=failed_at + timedelta(seconds=delay),
                consecutive_failure_count=failure_count,
            )
            self._rows[filter_key] = metadata
            return metadata

    @staticmethod
    def _new_or_replace(
        current: PaginationMetadata | None,
        *,
        filter_key: str,
        now: datetime,
        verification_status: VerificationStatus,
        **changes: object,
    ) -> PaginationMetadata:
        if current is not None:
            return replace(
                current,
                verification_status=verification_status,
                updated_at=now,
                **changes,
            )
        defaults = {
            "last_page": None,
            "total_titles": None,
            "is_exact": False,
            "last_verified_at": None,
            "last_verification_attempt_at": None,
            "next_retry_at": None,
            "consecutive_failure_count": 0,
            "access_count": 0,
            "last_accessed_at": None,
        }
        defaults.update(changes)
        return PaginationMetadata(
            filter_key=filter_key,
            verification_status=verification_status,
            created_at=now,
            updated_at=now,
            **defaults,  # type: ignore[arg-type]
        )
