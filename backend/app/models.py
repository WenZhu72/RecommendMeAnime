from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class PaginationMetadataRecord(Base):
    __tablename__ = "pagination_metadata"
    __table_args__ = (
        UniqueConstraint("filter_key", name="uq_pagination_metadata_filter_key"),
        CheckConstraint(
            "verification_status IN ('verified', 'stale', 'calculating', 'estimated', 'failed')",
            name="ck_pagination_metadata_verification_status",
        ),
        CheckConstraint(
            "last_page IS NULL OR last_page > 0",
            name="ck_pagination_metadata_last_page_positive",
        ),
        CheckConstraint(
            "total_titles IS NULL OR total_titles >= 0",
            name="ck_pagination_metadata_total_titles_non_negative",
        ),
        CheckConstraint(
            "consecutive_failure_count >= 0",
            name="ck_pagination_metadata_failure_count_non_negative",
        ),
        CheckConstraint(
            "access_count >= 0",
            name="ck_pagination_metadata_access_count_non_negative",
        ),
        Index("ix_pagination_metadata_filter_key", "filter_key"),
        Index("ix_pagination_metadata_last_verified_at", "last_verified_at"),
        Index("ix_pagination_metadata_last_accessed_at", "last_accessed_at"),
        Index("ix_pagination_metadata_access_count", "access_count"),
        Index("ix_pagination_metadata_next_retry_at", "next_retry_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    filter_key: Mapped[str] = mapped_column(Text, nullable=False)
    last_page: Mapped[int | None] = mapped_column(Integer)
    total_titles: Mapped[int | None] = mapped_column(Integer)
    is_exact: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    verification_status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="calculating",
        server_default=text("'calculating'"),
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_verification_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consecutive_failure_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    access_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
