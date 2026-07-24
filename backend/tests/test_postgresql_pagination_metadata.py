from __future__ import annotations

import asyncio
import os
from collections.abc import Iterator
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from app.database import normalise_database_url
from app.models import PaginationMetadataRecord
from app.repositories.pagination_metadata import PaginationMetadataStore
from scripts.import_pagination_metadata import consolidate_rows, import_rows


def test_model_compiles_to_postgresql_native_types_and_constraints() -> None:
    ddl = str(
        CreateTable(PaginationMetadataRecord.__table__).compile(
            dialect=postgresql.dialect()
        )
    )
    assert "TIMESTAMP WITH TIME ZONE" in ddl
    assert "BOOLEAN" in ddl
    assert "uq_pagination_metadata_filter_key" in ddl
    assert "ck_pagination_metadata_verification_status" in ddl
    assert PaginationMetadataRecord.__table__.c.filter_key.nullable is False
    assert PaginationMetadataRecord.__table__.c.access_count.nullable is False


def test_sqlite_import_consolidates_compatible_legacy_sort_keys() -> None:
    older = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newer = datetime(2026, 1, 2, tzinfo=timezone.utc)

    def row(sort: str, *, total: int, access_count: int, updated: datetime):
        return {
            "filter_key": (
                "format=TV|is_adult=false|per_page=20"
                f"|sort={sort}"
            ),
            "last_page": 3,
            "total_titles": total,
            "is_exact": 1,
            "verification_status": "verified",
            "last_verified_at": updated.isoformat(),
            "last_verification_attempt_at": updated.isoformat(),
            "next_retry_at": None,
            "consecutive_failure_count": 0,
            "access_count": access_count,
            "last_accessed_at": updated.isoformat(),
            "created_at": older.isoformat(),
            "updated_at": updated.isoformat(),
        }

    consolidated = consolidate_rows(
        [
            row(
                "POPULARITY_DESC",
                total=46,
                access_count=2,
                updated=older,
            ),
            row(
                "SCORE_DESC",
                total=47,
                access_count=3,
                updated=newer,
            ),
        ]
    )

    assert len(consolidated) == 1
    assert "sort=" not in consolidated[0]["filter_key"]
    assert consolidated[0]["total_titles"] == 47
    assert consolidated[0]["access_count"] == 5


@pytest.fixture(scope="module")
def postgres_url() -> Iterator[str]:
    raw_url = os.environ.get("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip(
            "Set TEST_DATABASE_URL to the local Docker PostgreSQL test database "
            "to run integration tests."
        )
    database_url = normalise_database_url(raw_url)
    previous_database_url = os.environ.get("DATABASE_URL")
    previous_environment = os.environ.get("ENVIRONMENT")
    os.environ["DATABASE_URL"] = database_url
    os.environ["ENVIRONMENT"] = "test"
    try:
        config = Config(
            str(Path(__file__).resolve().parents[1] / "alembic.ini")
        )
        command.upgrade(config, "head")
        yield database_url
    finally:
        if previous_database_url is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous_database_url
        if previous_environment is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = previous_environment


@pytest.fixture
def empty_metadata_table(postgres_url: str) -> None:
    engine = create_engine(postgres_url, pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            connection.execute(text("TRUNCATE TABLE pagination_metadata"))
    finally:
        engine.dispose()


def test_alembic_creates_expected_postgresql_schema(
    postgres_url: str,
    empty_metadata_table: None,
) -> None:
    del empty_metadata_table
    engine = create_engine(postgres_url, pool_pre_ping=True)
    try:
        inspector = inspect(engine)
        columns = {
            column["name"]: column
            for column in inspector.get_columns("pagination_metadata")
        }
        index_names = {
            index["name"]
            for index in inspector.get_indexes("pagination_metadata")
        }
        unique_names = {
            constraint["name"]
            for constraint in inspector.get_unique_constraints(
                "pagination_metadata"
            )
        }
    finally:
        engine.dispose()

    assert set(columns) == {
        "id",
        "filter_key",
        "last_page",
        "total_titles",
        "is_exact",
        "verification_status",
        "last_verified_at",
        "last_verification_attempt_at",
        "next_retry_at",
        "consecutive_failure_count",
        "access_count",
        "last_accessed_at",
        "created_at",
        "updated_at",
    }
    assert columns["last_verified_at"]["type"].timezone is True
    assert columns["created_at"]["type"].timezone is True
    assert "uq_pagination_metadata_filter_key" in unique_names
    assert {
        "ix_pagination_metadata_filter_key",
        "ix_pagination_metadata_last_verified_at",
        "ix_pagination_metadata_last_accessed_at",
        "ix_pagination_metadata_access_count",
        "ix_pagination_metadata_next_retry_at",
    } <= index_names


def test_lookup_insert_update_retry_and_refresh_state(
    postgres_url: str,
    empty_metadata_table: None,
) -> None:
    del empty_metadata_table
    async def scenario() -> None:
        store = PaginationMetadataStore(postgres_url)
        await store.initialise()
        assert await store.get("format=TV|per_page=20") is None

        verified = await store.save_verified(
            "format=TV|per_page=20",
            last_page=3,
            total_titles=47,
        )
        assert verified.is_exact is True
        assert verified.verification_status == "verified"

        touched = await store.get("format=TV|per_page=20", touch=True)
        assert touched is not None
        assert touched.access_count == 1
        assert touched.last_accessed_at is not None

        stale = await store.mark_stale(
            "format=TV|per_page=20",
            minimum_last_page=4,
        )
        assert stale is not None
        assert stale.verification_status == "stale"
        assert stale.last_page == 4

        failed = await store.save_failure(
            "format=TV|per_page=20",
            retry_backoff_seconds=(60, 120),
        )
        assert failed.verification_status == "failed"
        assert failed.consecutive_failure_count == 1
        assert failed.next_retry_at is not None

        refreshed = await store.save_verified(
            "format=TV|per_page=20",
            last_page=3,
            total_titles=47,
        )
        assert refreshed.consecutive_failure_count == 0
        assert refreshed.next_retry_at is None
        await store.close()

    asyncio.run(scenario())


def test_concurrent_claim_and_upsert_are_single_row_operations(
    postgres_url: str,
    empty_metadata_table: None,
) -> None:
    del empty_metadata_table
    async def scenario() -> None:
        stores = [PaginationMetadataStore(postgres_url) for _ in range(8)]
        await asyncio.gather(*(store.initialise() for store in stores))
        claimed_at = datetime.now(timezone.utc)
        claims = await asyncio.gather(
            *(
                store.try_claim(
                    "genres=ACTION|per_page=20",
                    lease_seconds=30,
                    now=claimed_at,
                )
                for store in stores
            )
        )
        assert claims.count(True) == 1

        await asyncio.gather(
            *(
                store.save_verified(
                    "genres=ACTION|per_page=20",
                    last_page=index + 1,
                    total_titles=(index + 1) * 20,
                )
                for index, store in enumerate(stores)
            )
        )

        with stores[0]._engine.connect() as connection:
            row_count = connection.execute(
                select(text("count(*)")).select_from(PaginationMetadataRecord)
            ).scalar_one()
        assert row_count == 1
        await asyncio.gather(*(store.close() for store in stores))

    asyncio.run(scenario())


def test_concurrent_failure_updates_increment_without_lost_writes(
    postgres_url: str,
    empty_metadata_table: None,
) -> None:
    del empty_metadata_table
    async def scenario() -> None:
        first = PaginationMetadataStore(postgres_url)
        second = PaginationMetadataStore(postgres_url)
        failed_at = datetime.now(timezone.utc)
        failures = await asyncio.gather(
            first.save_failure(
                "search=naruto|per_page=20",
                retry_backoff_seconds=(60, 120, 300),
                now=failed_at,
            ),
            second.save_failure(
                "search=naruto|per_page=20",
                retry_backoff_seconds=(60, 120, 300),
                now=failed_at,
            ),
        )
        stored = await first.get("search=naruto|per_page=20")
        assert stored is not None
        assert stored.consecutive_failure_count == 2
        assert stored.next_retry_at is not None
        assert int((stored.next_retry_at - failed_at).total_seconds()) == 120
        assert {failure.consecutive_failure_count for failure in failures} == {1, 2}
        await asyncio.gather(first.close(), second.close())

    asyncio.run(scenario())


def test_sqlite_import_upsert_is_safe_to_rerun(
    postgres_url: str,
    empty_metadata_table: None,
) -> None:
    del empty_metadata_table
    imported_at = datetime.now(timezone.utc)
    rows = [
        {
            "filter_key": "format=TV|per_page=20",
            "last_page": 3,
            "total_titles": 47,
            "is_exact": True,
            "verification_status": "verified",
            "last_verified_at": imported_at,
            "last_verification_attempt_at": imported_at,
            "next_retry_at": None,
            "consecutive_failure_count": 0,
            "access_count": 7,
            "last_accessed_at": imported_at,
            "created_at": imported_at,
            "updated_at": imported_at,
        }
    ]

    assert import_rows(rows, database_url=postgres_url) == 1
    assert import_rows(rows, database_url=postgres_url) == 1

    engine = create_engine(postgres_url, pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            records = connection.execute(
                select(
                    PaginationMetadataRecord.filter_key,
                    PaginationMetadataRecord.access_count,
                )
            ).all()
    finally:
        engine.dispose()
    assert records == [("format=TV|per_page=20", 7)]
