"""create private saved resume sources

Revision ID: 0003_saved_resumes
Revises: 0002_career_records
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_saved_resumes"
down_revision = "0002_career_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "saved_resumes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_saved_resumes_user_id", "saved_resumes", ["user_id"])
    op.create_table(
        "resume_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("resume_id", sa.String(length=36), nullable=False),
        sa.Column("source_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["resume_id"], ["saved_resumes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resume_versions_resume_id", "resume_versions", ["resume_id"])


def downgrade() -> None:
    op.drop_index("ix_resume_versions_resume_id", table_name="resume_versions")
    op.drop_table("resume_versions")
    op.drop_index("ix_saved_resumes_user_id", table_name="saved_resumes")
    op.drop_table("saved_resumes")
