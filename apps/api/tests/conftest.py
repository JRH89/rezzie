"""Keep API tests isolated from a developer's local production-like .env file."""
import os
import tempfile
from pathlib import Path

os.environ["ENVIRONMENT"] = "development"
descriptor, database_path = tempfile.mkstemp(prefix="rezzie-tests-", suffix=".sqlite3")
os.close(descriptor)
test_database = Path(database_path).as_posix()
os.environ["DATABASE_URL"] = f"sqlite:///{test_database}"
os.environ["ANTHROPIC_API_KEY"] = ""
