from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Literal, TypeVar

from sqlalchemy import DateTime, Float, and_, case, cast, func, literal, or_, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import create_database_engine
from app.models import PaginationMetadataRecord

VerificationStatus = Literal["verified", "stale", "calculating", "estimated", "failed"]
_T = TypeVar("_T")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass(frozen=True)
class PaginationMetadata:
    filter_key: str
    last_page: int | None
    total_titles: int | None
    is_exact: bool
    verification_status: VerificationStatus
    last_verified_at: datetime | None
    last_verification_attempt_at: datetime | None
    next_retry_at: datetime | None
    consecutive_failure_count: int
    access_count: int
    last_accessed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PaginationMetadataStore:
    """PostgreSQL repository for persistent Browse pagination facts."""

    def __init__(self, database_url: str, *, engine: Engine | None = None) -> None:
        self._engine = engine or create_database_engine(database_url)
        if self._engine.dialect.name != "postgresql":
            raise ValueError("PaginationMetadataStore requires PostgreSQL.")
        self._sessions = sessionmaker(
            bind=self._engine,
            class_=Session,
            expire_on_commit=False,
        )
        self._cache: dict[str, PaginationMetadata] = {}
        # This only protects the process-local read-through cache. PostgreSQL
        # transactions coordinate persistent state across threads and workers.
        self._cache_lock = RLock()

    def peek(self, filter_key: str) -> PaginationMetadata | None:
        with self._cache_lock:
            return self._cache.get(filter_key)

    def _remember(self, metadata: PaginationMetadata | None) -> PaginationMetadata | None:
        if metadata is not None:
            with self._cache_lock:
                self._cache[metadata.filter_key] = metadata
        return metadata

    @staticmethod
    def _metadata(record: PaginationMetadataRecord | None) -> PaginationMetadata | None:
        if record is None:
            return None
        return PaginationMetadata(
            filter_key=record.filter_key,
            last_page=record.last_page,
            total_titles=record.total_titles,
            is_exact=record.is_exact,
            verification_status=record.verification_status,  # type: ignore[arg-type]
            last_verified_at=_as_utc(record.last_verified_at),
            last_verification_attempt_at=_as_utc(record.last_verification_attempt_at),
            next_retry_at=_as_utc(record.next_retry_at),
            consecutive_failure_count=record.consecutive_failure_count,
            access_count=record.access_count,
            last_accessed_at=_as_utc(record.last_accessed_at),
            created_at=_as_utc(record.created_at) or utc_now(),
            updated_at=_as_utc(record.updated_at) or utc_now(),
        )

    async def _run(self, operation: object) -> _T:
        return await asyncio.to_thread(operation)  # type: ignore[arg-type,return-value]

    async def initialise(self) -> None:
        def check_connection_and_schema() -> None:
            with self._sessions() as session:
                session.execute(text("SELECT 1"))
                session.execute(select(PaginationMetadataRecord.id).limit(1))

        await self._run(check_connection_and_schema)

    async def close(self) -> None:
        await self._run(self._engine.dispose)

    async def get(self, filter_key: str, *, touch: bool = False) -> PaginationMetadata | None:
        def read() -> PaginationMetadata | None:
            with self._sessions.begin() as session:
                if touch:
                    accessed_at = utc_now()
                    statement = (
                        update(PaginationMetadataRecord)
                        .where(PaginationMetadataRecord.filter_key == filter_key)
                        .values(
                            access_count=PaginationMetadataRecord.access_count + 1,
                            last_accessed_at=accessed_at,
                            updated_at=accessed_at,
                        )
                        .returning(PaginationMetadataRecord)
                    )
                    record = session.execute(statement).scalar_one_or_none()
                else:
                    record = session.execute(
                        select(PaginationMetadataRecord).where(
                            PaginationMetadataRecord.filter_key == filter_key
                        )
                    ).scalar_one_or_none()
                return self._remember(self._metadata(record))

        return await self._run(read)

    async def try_claim(
        self,
        filter_key: str,
        *,
        lease_seconds: float,
        now: datetime | None = None,
    ) -> bool:
        claimed_at = now or utc_now()
        lease_cutoff = claimed_at - timedelta(seconds=lease_seconds)

        def claim() -> bool:
            with self._sessions.begin() as session:
                proposed = insert(PaginationMetadataRecord).values(
                    filter_key=filter_key,
                    is_exact=False,
                    verification_status="calculating",
                    last_verification_attempt_at=claimed_at,
                    access_count=1,
                    last_accessed_at=claimed_at,
                    created_at=claimed_at,
                    updated_at=claimed_at,
                )
                eligible = and_(
                    or_(
                        PaginationMetadataRecord.verification_status != "calculating",
                        PaginationMetadataRecord.last_verification_attempt_at.is_(None),
                        PaginationMetadataRecord.last_verification_attempt_at <= lease_cutoff,
                    ),
                    or_(
                        PaginationMetadataRecord.next_retry_at.is_(None),
                        PaginationMetadataRecord.next_retry_at <= claimed_at,
                    ),
                )
                statement = (
                    proposed.on_conflict_do_update(
                        index_elements=[PaginationMetadataRecord.filter_key],
                        set_={
                            "verification_status": "calculating",
                            "last_verification_attempt_at": proposed.excluded.last_verification_attempt_at,
                            "updated_at": proposed.excluded.updated_at,
                        },
                        where=eligible,
                    )
                    .returning(PaginationMetadataRecord.id)
                )
                return session.execute(statement).scalar_one_or_none() is not None

        return await self._run(claim)

    async def save_verified(
        self,
        filter_key: str,
        *,
        last_page: int,
        total_titles: int,
        now: datetime | None = None,
    ) -> PaginationMetadata:
        verified_at = now or utc_now()

        def save() -> PaginationMetadata:
            with self._sessions.begin() as session:
                proposed = insert(PaginationMetadataRecord).values(
                    filter_key=filter_key,
                    last_page=last_page,
                    total_titles=total_titles,
                    is_exact=True,
                    verification_status="verified",
                    last_verified_at=verified_at,
                    last_verification_attempt_at=verified_at,
                    consecutive_failure_count=0,
                    created_at=verified_at,
                    updated_at=verified_at,
                )
                statement = proposed.on_conflict_do_update(
                    index_elements=[PaginationMetadataRecord.filter_key],
                    set_={
                        "last_page": proposed.excluded.last_page,
                        "total_titles": proposed.excluded.total_titles,
                        "is_exact": True,
                        "verification_status": "verified",
                        "last_verified_at": proposed.excluded.last_verified_at,
                        "last_verification_attempt_at": proposed.excluded.last_verification_attempt_at,
                        "next_retry_at": None,
                        "consecutive_failure_count": 0,
                        "updated_at": proposed.excluded.updated_at,
                    },
                ).returning(PaginationMetadataRecord)
                metadata = self._remember(
                    self._metadata(session.execute(statement).scalar_one())
                )
                assert metadata is not None
                return metadata

        return await self._run(save)

    async def save_estimated(
        self,
        filter_key: str,
        *,
        last_page: int | None,
        now: datetime | None = None,
    ) -> PaginationMetadata:
        attempted_at = now or utc_now()

        def save() -> PaginationMetadata:
            with self._sessions.begin() as session:
                proposed = insert(PaginationMetadataRecord).values(
                    filter_key=filter_key,
                    last_page=last_page,
                    total_titles=None,
                    is_exact=False,
                    verification_status="estimated",
                    last_verified_at=None,
                    last_verification_attempt_at=attempted_at,
                    next_retry_at=None,
                    consecutive_failure_count=0,
                    created_at=attempted_at,
                    updated_at=attempted_at,
                )
                statement = proposed.on_conflict_do_update(
                    index_elements=[PaginationMetadataRecord.filter_key],
                    set_={
                        "last_page": func.coalesce(
                            proposed.excluded.last_page,
                            PaginationMetadataRecord.last_page,
                        ),
                        "total_titles": None,
                        "is_exact": False,
                        "verification_status": "estimated",
                        "last_verified_at": None,
                        "last_verification_attempt_at": proposed.excluded.last_verification_attempt_at,
                        "next_retry_at": None,
                        "consecutive_failure_count": 0,
                        "updated_at": proposed.excluded.updated_at,
                    },
                ).returning(PaginationMetadataRecord)
                metadata = self._remember(
                    self._metadata(session.execute(statement).scalar_one())
                )
                assert metadata is not None
                return metadata

        return await self._run(save)

    async def mark_stale(
        self,
        filter_key: str,
        *,
        minimum_last_page: int | None = None,
    ) -> PaginationMetadata | None:
        marked_at = utc_now()

        def mark() -> PaginationMetadata | None:
            with self._sessions.begin() as session:
                last_page = PaginationMetadataRecord.last_page
                if minimum_last_page is not None:
                    last_page = case(
                        (
                            or_(
                                PaginationMetadataRecord.last_page.is_(None),
                                PaginationMetadataRecord.last_page < minimum_last_page,
                            ),
                            minimum_last_page,
                        ),
                        else_=PaginationMetadataRecord.last_page,
                    )
                statement = (
                    update(PaginationMetadataRecord)
                    .where(PaginationMetadataRecord.filter_key == filter_key)
                    .values(
                        last_page=last_page,
                        is_exact=False,
                        verification_status="stale",
                        updated_at=marked_at,
                    )
                    .returning(PaginationMetadataRecord)
                )
                return self._remember(
                    self._metadata(session.execute(statement).scalar_one_or_none())
                )

        return await self._run(mark)

    async def save_failure(
        self,
        filter_key: str,
        *,
        retry_backoff_seconds: tuple[int, ...],
        now: datetime | None = None,
    ) -> PaginationMetadata:
        failed_at = now or utc_now()
        first_retry = failed_at + timedelta(seconds=retry_backoff_seconds[0])

        def save() -> PaginationMetadata:
            with self._sessions.begin() as session:
                next_failure_count = (
                    PaginationMetadataRecord.consecutive_failure_count + 1
                )
                delay_seconds = case(
                    *(
                        (next_failure_count <= index + 1, delay)
                        for index, delay in enumerate(retry_backoff_seconds)
                    ),
                    else_=retry_backoff_seconds[-1],
                )
                database_next_retry = literal(
                    failed_at,
                    type_=DateTime(timezone=True),
                ) + func.make_interval(
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    cast(delay_seconds, Float),
                )
                proposed = insert(PaginationMetadataRecord).values(
                    filter_key=filter_key,
                    is_exact=False,
                    verification_status="failed",
                    last_verification_attempt_at=failed_at,
                    next_retry_at=first_retry,
                    consecutive_failure_count=1,
                    created_at=failed_at,
                    updated_at=failed_at,
                )
                statement = proposed.on_conflict_do_update(
                    index_elements=[PaginationMetadataRecord.filter_key],
                    set_={
                        "verification_status": "failed",
                        "last_verification_attempt_at": proposed.excluded.last_verification_attempt_at,
                        "next_retry_at": database_next_retry,
                        "consecutive_failure_count": next_failure_count,
                        "updated_at": proposed.excluded.updated_at,
                    },
                ).returning(PaginationMetadataRecord)
                metadata = self._remember(
                    self._metadata(session.execute(statement).scalar_one())
                )
                assert metadata is not None
                return metadata

        return await self._run(save)
