"""One-time, transaction-safe migration of Rezzie's legacy SQLite data to Postgres.

Run only after Alembic has prepared an empty Postgres database. The script prints
counts only; candidate data, identifiers, and connection strings are never logged.
"""
import os
from collections.abc import Iterable

from sqlalchemy import MetaData, create_engine, func, insert, select
from sqlalchemy.engine import Engine

from .billing import Base
from .records import CareerFact, CareerRecord  # noqa: F401 - register models
from .resume_library import (  # noqa: F401 - register models
    ResumeVersion,
    SavedResume,
    SavedTailoringDraft,
)

TABLE_NAMES = (
    "billing_accounts",
    "processed_stripe_events",
    "credit_grants",
    "career_records",
    "career_facts",
    "saved_resumes",
    "resume_versions",
    "saved_tailoring_drafts",
)


def copy_legacy_data(source: Engine, target: Engine) -> dict[str, int]:
    """Copy shared tables atomically only when the target is empty."""
    source_metadata = MetaData()
    source_metadata.reflect(bind=source)
    counts: dict[str, int] = {}
    with target.begin() as target_connection:
        for table_name in TABLE_NAMES:
            target_table = Base.metadata.tables[table_name]
            existing = target_connection.scalar(select(func.count()).select_from(target_table)) or 0
            if existing:
                raise RuntimeError("Target database is not empty; refusing to merge legacy data.")
        for table_name in TABLE_NAMES:
            source_table = source_metadata.tables.get(table_name)
            if source_table is None:
                counts[table_name] = 0
                continue
            target_table = Base.metadata.tables[table_name]
            target_columns = {column.name for column in target_table.columns}
            with source.connect() as source_connection:
                rows: Iterable[dict[str, object]] = (
                    {key: value for key, value in dict(row).items() if key in target_columns}
                    for row in source_connection.execute(select(source_table)).mappings()
                )
                batch = list(rows)
            if batch:
                target_connection.execute(insert(target_table), batch)
            counts[table_name] = len(batch)
    return counts


def main() -> None:
    source_url = os.environ.get("LEGACY_SQLITE_DATABASE_URL")
    target_url = os.environ.get("DATABASE_URL")
    if not source_url or not source_url.startswith("sqlite"):
        raise RuntimeError("Set LEGACY_SQLITE_DATABASE_URL to the legacy SQLite database.")
    if not target_url or not target_url.startswith("postgresql"):
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection string.")
    counts = copy_legacy_data(create_engine(source_url), create_engine(target_url))
    print("Migrated legacy tables: " + ", ".join(f"{table}={count}" for table, count in counts.items()))


if __name__ == "__main__":
    main()
