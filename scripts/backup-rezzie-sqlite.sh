#!/usr/bin/env bash
# Create a consistent, private SQLite backup without printing candidate data.
set -euo pipefail

APP_DIRECTORY="${1:-/opt/rezzie}"
VOLUME_NAME="${REZZIE_SQLITE_VOLUME:-rezzie_rezzie_api_data}"
BACKUP_DIRECTORY="${APP_DIRECTORY}/backups/sqlite"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_NAME="rezzie-${STAMP}.sqlite3"

umask 077
mkdir -p "${BACKUP_DIRECTORY}"

docker run --rm \
  -e BACKUP_NAME="${BACKUP_NAME}" \
  -v "${VOLUME_NAME}:/source:ro" \
  -v "${BACKUP_DIRECTORY}:/backup" \
  python:3.12-slim \
  python -c 'import os, sqlite3; source = sqlite3.connect("file:/source/rezzie.db?mode=ro", uri=True); target = sqlite3.connect("/backup/" + os.environ["BACKUP_NAME"]); source.backup(target); target.close(); source.close()'

test -s "${BACKUP_DIRECTORY}/${BACKUP_NAME}"
chmod 600 "${BACKUP_DIRECTORY}/${BACKUP_NAME}"
printf 'Created SQLite backup: %s\n' "${BACKUP_DIRECTORY}/${BACKUP_NAME}"
