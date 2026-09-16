"""track completed Stripe webhook handling

Revision ID: 0007_stripe_event_handling
Revises: 0006_support_tickets
Create Date: 2026-09-15
"""

import sqlalchemy as sa
from alembic import op


revision = "0007_stripe_event_handling"
down_revision = "0006_support_tickets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "processed_stripe_events",
        sa.Column("handled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("processed_stripe_events", "handled")
