"""add private support tickets

Revision ID: 0006_support_tickets
Revises: 0005_trusted_sources_and_rate_limits
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_support_tickets"
down_revision = "0005_trusted_sources_and_rate_limits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("support_tickets", sa.Column("id", sa.String(length=36), nullable=False), sa.Column("user_id", sa.String(length=128), nullable=False), sa.Column("subject", sa.String(length=160), nullable=False), sa.Column("category", sa.String(length=32), nullable=False), sa.Column("status", sa.String(length=32), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])
    op.create_table("support_ticket_messages", sa.Column("id", sa.String(length=36), nullable=False), sa.Column("ticket_id", sa.String(length=36), nullable=False), sa.Column("author_id", sa.String(length=128), nullable=False), sa.Column("author_role", sa.String(length=16), nullable=False), sa.Column("body", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_support_ticket_messages_ticket_id", "support_ticket_messages", ["ticket_id"])


def downgrade() -> None:
    op.drop_index("ix_support_ticket_messages_ticket_id", table_name="support_ticket_messages")
    op.drop_table("support_ticket_messages")
    op.drop_index("ix_support_tickets_user_id", table_name="support_tickets")
    op.drop_table("support_tickets")
