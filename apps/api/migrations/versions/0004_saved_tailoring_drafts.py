"""create saved tailored drafts

Revision ID: 0004_saved_tailoring_drafts
Revises: 0003_saved_resumes
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_saved_tailoring_drafts"
down_revision = "0003_saved_resumes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_tailoring_drafts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("resume_id", sa.String(length=36), nullable=True),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("tailored_resume", sa.Text(), nullable=False),
        sa.Column("resume_html", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_tailoring_drafts_user_id", "saved_tailoring_drafts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_saved_tailoring_drafts_user_id", table_name="saved_tailoring_drafts")
    op.drop_table("saved_tailoring_drafts")
