"""create private career records

Revision ID: 0002_career_records
Revises: 0001_billing_ledger
Create Date: 2026-09-05
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_career_records"
down_revision = "0001_billing_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "career_records",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_career_records_user_id", "career_records", ["user_id"])
    op.create_table(
        "career_facts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("record_id", sa.String(length=36), nullable=False),
        sa.Column("fact_type", sa.String(length=32), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("source_excerpt", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("evidence_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["record_id"], ["career_records.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_career_facts_record_id", "career_facts", ["record_id"])


def downgrade() -> None:
    op.drop_index("ix_career_facts_record_id", table_name="career_facts")
    op.drop_table("career_facts")
    op.drop_index("ix_career_records_user_id", table_name="career_records")
    op.drop_table("career_records")
