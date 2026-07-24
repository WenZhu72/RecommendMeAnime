"""Create PostgreSQL pagination metadata storage.

Revision ID: 20260723_01
Revises:
Create Date: 2026-07-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260723_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pagination_metadata",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("filter_key", sa.Text(), nullable=False),
        sa.Column("last_page", sa.Integer(), nullable=True),
        sa.Column("total_titles", sa.Integer(), nullable=True),
        sa.Column(
            "is_exact",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "verification_status",
            sa.String(length=16),
            server_default=sa.text("'calculating'"),
            nullable=False,
        ),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_verification_attempt_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "consecutive_failure_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "access_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "access_count >= 0",
            name="ck_pagination_metadata_access_count_non_negative",
        ),
        sa.CheckConstraint(
            "consecutive_failure_count >= 0",
            name="ck_pagination_metadata_failure_count_non_negative",
        ),
        sa.CheckConstraint(
            "last_page IS NULL OR last_page > 0",
            name="ck_pagination_metadata_last_page_positive",
        ),
        sa.CheckConstraint(
            "total_titles IS NULL OR total_titles >= 0",
            name="ck_pagination_metadata_total_titles_non_negative",
        ),
        sa.CheckConstraint(
            "verification_status IN "
            "('verified', 'stale', 'calculating', 'estimated', 'failed')",
            name="ck_pagination_metadata_verification_status",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "filter_key",
            name="uq_pagination_metadata_filter_key",
        ),
    )
    op.create_index(
        "ix_pagination_metadata_access_count",
        "pagination_metadata",
        ["access_count"],
    )
    op.create_index(
        "ix_pagination_metadata_filter_key",
        "pagination_metadata",
        ["filter_key"],
    )
    op.create_index(
        "ix_pagination_metadata_last_accessed_at",
        "pagination_metadata",
        ["last_accessed_at"],
    )
    op.create_index(
        "ix_pagination_metadata_last_verified_at",
        "pagination_metadata",
        ["last_verified_at"],
    )
    op.create_index(
        "ix_pagination_metadata_next_retry_at",
        "pagination_metadata",
        ["next_retry_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_pagination_metadata_next_retry_at",
        table_name="pagination_metadata",
    )
    op.drop_index(
        "ix_pagination_metadata_last_verified_at",
        table_name="pagination_metadata",
    )
    op.drop_index(
        "ix_pagination_metadata_last_accessed_at",
        table_name="pagination_metadata",
    )
    op.drop_index(
        "ix_pagination_metadata_filter_key",
        table_name="pagination_metadata",
    )
    op.drop_index(
        "ix_pagination_metadata_access_count",
        table_name="pagination_metadata",
    )
    op.drop_table("pagination_metadata")
