from pydantic import ValidationError
from sqlalchemy import create_engine, text

from rezzie.billing import Base
from rezzie.config import Settings
from rezzie.sqlite_migration import copy_legacy_data


def test_production_configuration_rejects_sqlite() -> None:
    try:
        Settings(environment="production", database_url="sqlite:///rezzie.db")
    except ValidationError as error:
        assert "managed PostgreSQL" in str(error)
    else:
        raise AssertionError("Production must reject SQLite.")


def test_copy_legacy_data_preserves_known_rows_without_merging() -> None:
    source = create_engine("sqlite://")
    target = create_engine("sqlite://")
    Base.metadata.create_all(source)
    Base.metadata.create_all(target)
    with source.begin() as connection:
        connection.execute(text("INSERT INTO billing_accounts (user_id, stripe_customer_id, subscription_status, subscription_credits, subscription_used, purchased_credits) VALUES ('user-1', NULL, 'none', 0, 0, 4)"))

    counts = copy_legacy_data(source, target)
    assert counts["billing_accounts"] == 1
    with target.connect() as connection:
        assert connection.scalar(text("SELECT purchased_credits FROM billing_accounts WHERE user_id = 'user-1'")) == 4

    try:
        copy_legacy_data(source, target)
    except RuntimeError as error:
        assert "not empty" in str(error)
    else:
        raise AssertionError("A non-empty target must not be merged.")
