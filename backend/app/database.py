from __future__ import annotations

from sqlalchemy import Engine, create_engine


def normalise_database_url(database_url: str) -> str:
    """Select Psycopg 3 without dropping provider-specific query parameters."""

    if database_url.startswith("postgres://"):
        return f"postgresql+psycopg://{database_url.removeprefix('postgres://')}"
    if database_url.startswith("postgresql://"):
        return f"postgresql+psycopg://{database_url.removeprefix('postgresql://')}"
    return database_url


def create_database_engine(database_url: str) -> Engine:
    DATABASE_URL = normalise_database_url(database_url)
    return create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
