"""add trusted sources and persistent rate limits

Revision ID: 0005_trusted_sources_and_rate_limits
Revises: 0004_saved_tailoring_drafts
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_trusted_sources_and_rate_limits"
down_revision = "0004_saved_tailoring_drafts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "external_sources",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("url", sa.String(length=2000), nullable=False),
        sa.Column("source_type", sa.String(length=32), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_external_sources_user_id", "external_sources", ["user_id"])
    op.create_table(
        "rate_limit_windows",
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("scope", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.Integer(), nullable=False),
        sa.Column("requests", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("key", "scope", "window_start"),
    )


def downgrade() -> None:
    op.drop_table("rate_limit_windows")
    op.drop_index("ix_external_sources_user_id", table_name="external_sources")
    op.drop_table("external_sources")
