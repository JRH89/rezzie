"""create billing ledger

Revision ID: 0001_billing_ledger
Revises:
Create Date: 2026-09-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_billing_ledger"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("billing_accounts", sa.Column("user_id", sa.String(length=128), nullable=False), sa.Column("stripe_customer_id", sa.String(length=255), nullable=True), sa.Column("subscription_status", sa.String(length=32), nullable=False), sa.Column("subscription_credits", sa.Integer(), nullable=False), sa.Column("subscription_used", sa.Integer(), nullable=False), sa.Column("purchased_credits", sa.Integer(), nullable=False), sa.PrimaryKeyConstraint("user_id"), sa.UniqueConstraint("stripe_customer_id"))
    op.create_table("processed_stripe_events", sa.Column("event_id", sa.String(length=255), nullable=False), sa.Column("received_at", sa.DateTime(), nullable=False), sa.PrimaryKeyConstraint("event_id"))
    op.create_table("credit_grants", sa.Column("reference", sa.String(length=255), nullable=False), sa.Column("user_id", sa.String(length=128), nullable=False), sa.Column("credits", sa.Integer(), nullable=False), sa.PrimaryKeyConstraint("reference"))


def downgrade() -> None:
    op.drop_table("credit_grants")
    op.drop_table("processed_stripe_events")
    op.drop_table("billing_accounts")
