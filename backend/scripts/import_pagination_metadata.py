from __future__ import annotations

import argparse
import logging
import sqlite3
from collections.abc import Mapping
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import create_database_engine
from app.models import PaginationMetadataRecord
from app.services.browse_filters import legacy_metadata_filter_key

logger = logging.getLogger("pagination_metadata_import")
IMPORT_BATCH_SIZE = 500
VALID_STATUSES = frozenset(
    {"verified", "stale", "calculating", "estimated", "failed"}
)
REQUIRED_COLUMNS = frozenset(
    {
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
)


def parse_timestamp(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def migration_rank(row: Mapping[str, Any]) -> tuple[object, ...]:
    status = str(row["verification_status"])
    status_priority = {
        "verified": 5,
        "stale": 4,
        "estimated": 3,
        "calculating": 2,
        "failed": 1,
    }.get(status, 0)
    minimum = datetime.min.replace(tzinfo=timezone.utc)
    return (
        int(bool(row["is_exact"])),
        int(status not in {"calculating", "failed"}),
        status_priority,
        parse_timestamp(row["last_verified_at"]) or minimum,
        parse_timestamp(row["updated_at"]) or minimum,
        str(row["filter_key"]),
    )


def read_source(sqlite_path: Path) -> list[dict[str, Any]]:
    if not sqlite_path.is_file():
        raise FileNotFoundError(f"SQLite source does not exist: {sqlite_path}")

    source_uri = f"{sqlite_path.resolve().as_uri()}?mode=ro"
    with sqlite3.connect(source_uri, uri=True) as connection:
        connection.row_factory = sqlite3.Row
        columns = {
            str(row["name"])
            for row in connection.execute(
                "PRAGMA table_info(pagination_metadata)"
            ).fetchall()
        }
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(
                "SQLite pagination_metadata schema is missing required columns: "
                + ", ".join(sorted(missing))
            )
        rows = [
            dict(row)
            for row in connection.execute(
                "SELECT * FROM pagination_metadata"
            ).fetchall()
        ]
    return rows


def consolidate_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        target_key = legacy_metadata_filter_key(str(row["filter_key"]))
        groups.setdefault(target_key, []).append(row)

    consolidated: list[dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for target_key, candidates in groups.items():
        winner = max(candidates, key=migration_rank)
        status = str(winner["verification_status"])
        if status not in VALID_STATUSES:
            raise ValueError(
                f"SQLite row has unsupported verification status: {status}"
            )
        created_values = [
            parsed
            for row in candidates
            if (parsed := parse_timestamp(row["created_at"])) is not None
        ]
        accessed_values = [
            parsed
            for row in candidates
            if (parsed := parse_timestamp(row["last_accessed_at"])) is not None
        ]
        created_at = min(created_values) if created_values else now
        updated_at = parse_timestamp(winner["updated_at"]) or created_at
        consolidated.append(
            {
                "filter_key": target_key,
                "last_page": winner["last_page"],
                "total_titles": winner["total_titles"],
                "is_exact": bool(winner["is_exact"]),
                "verification_status": status,
                "last_verified_at": parse_timestamp(winner["last_verified_at"]),
                "last_verification_attempt_at": parse_timestamp(
                    winner["last_verification_attempt_at"]
                ),
                "next_retry_at": parse_timestamp(winner["next_retry_at"]),
                "consecutive_failure_count": int(
                    winner["consecutive_failure_count"]
                ),
                "access_count": sum(
                    int(row["access_count"]) for row in candidates
                ),
                "last_accessed_at": max(accessed_values)
                if accessed_values
                else None,
                "created_at": created_at,
                "updated_at": updated_at,
            }
        )
    return consolidated


def import_rows(
    rows: list[dict[str, Any]],
    *,
    database_url: str | None = None,
) -> int:
    if not rows:
        return 0
    engine = create_database_engine(database_url or settings.database_url)
    try:
        with Session(engine) as session, session.begin():
            for offset in range(0, len(rows), IMPORT_BATCH_SIZE):
                proposed = insert(PaginationMetadataRecord).values(
                    rows[offset : offset + IMPORT_BATCH_SIZE]
                )
                mutable_columns = (
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
                )
                statement = proposed.on_conflict_do_update(
                    index_elements=[PaginationMetadataRecord.filter_key],
                    set_={
                        column: getattr(proposed.excluded, column)
                        for column in mutable_columns
                    },
                    where=(
                        proposed.excluded.updated_at
                        >= PaginationMetadataRecord.updated_at
                    ),
                )
                session.execute(statement)
    finally:
        engine.dispose()
    return len(rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Idempotently import legacy SQLite pagination metadata into "
            "the PostgreSQL database selected by DATABASE_URL."
        )
    )
    parser.add_argument(
        "--sqlite-path",
        type=Path,
        default=Path("data/pagination_metadata.db"),
        help="Path to the legacy SQLite database (default: data/pagination_metadata.db).",
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        source_rows = read_source(args.sqlite_path)
        rows = consolidate_rows(source_rows)
        imported = import_rows(rows)
    except (FileNotFoundError, ValueError, sqlite3.Error, SQLAlchemyError) as error:
        logger.error("Import failed: %s", error)
        return 1

    logger.info(
        "Import complete: source_rows=%d destination_rows=%d",
        len(source_rows),
        imported,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
