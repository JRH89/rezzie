#!/usr/bin/env bash
set -Eeuo pipefail

readonly repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly compose_file="$repo_dir/docker-compose.production.yml"
readonly lock_file="/tmp/rezzie-deploy.lock"

exec 9>"$lock_file"
flock -n 9 || {
  echo "A Rezzie deployment is already running."
  exit 0
}

cd "$repo_dir"

echo "Updating Rezzie from origin/main..."
git pull --ff-only origin main

echo "Building the Rezzie API image..."
docker compose -f "$compose_file" build api

echo "Recreating only the Rezzie API service..."
docker compose -f "$compose_file" up -d --no-deps --force-recreate api

echo "Waiting for the Rezzie API health check..."
for attempt in {1..15}; do
  if curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8000/health >/dev/null; then
    echo "Rezzie API deployment complete."
    exit 0
  fi
  sleep 2
done

echo "Rezzie API did not become healthy after deployment."
exit 1
