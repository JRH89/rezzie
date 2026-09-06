# SQLite operations for Rezzie

Rezzie currently runs one FastAPI container on one server. SQLite is appropriate for that shape while traffic is modest, provided the Docker volume is persistent and backups/restores are treated as production operations.

The database contains billing records, saved resume text, Career Records, and saved drafts. Backups are sensitive data. Keep them server-only, mode `0600`, encrypted at rest if copied off-host, and out of Git/cloud-sync folders.

## Back up

On the server, after each deployment and at least daily:

```bash
cd /opt/rezzie
chmod 700 scripts/backup-rezzie-sqlite.sh
scripts/backup-rezzie-sqlite.sh
```

The script uses SQLite's backup API through a temporary container, so it creates a consistent copy without stopping the API. It prints only the backup filename.

If your Compose project uses a different volume name, identify it safely and pass it explicitly:

```bash
docker volume ls | rg rezzie_api_data
REZZIE_SQLITE_VOLUME=YOUR_VOLUME_NAME scripts/backup-rezzie-sqlite.sh
```

Schedule it with a root-owned systemd timer or your server's existing backup service. Keep a local encrypted copy and a separate encrypted off-host copy. Do not use a retention/deletion command until restore testing has succeeded.

The repository includes a daily systemd timer. Install it once on the server:

```bash
cd /opt/rezzie
sudo install -m 644 scripts/rezzie-sqlite-backup.service /etc/systemd/system/rezzie-sqlite-backup.service
sudo install -m 644 scripts/rezzie-sqlite-backup.timer /etc/systemd/system/rezzie-sqlite-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now rezzie-sqlite-backup.timer
systemctl list-timers rezzie-sqlite-backup.timer
```

Run `sudo systemctl start rezzie-sqlite-backup.service` once and confirm a new mode-`0600` backup appears in `/opt/rezzie/backups/sqlite`. The backup directory itself is not encrypted by this timer: configure encrypted server storage or encrypted off-host transfer separately.

## Restore rehearsal

Do a restore rehearsal before relying on live payments. This stops only the API briefly; ClamAV and the Tunnel can remain running.

```bash
cd /opt/rezzie
docker compose -f docker-compose.production.yml stop api
docker run --rm \
  -v rezzie_rezzie_api_data:/data \
  -v "$PWD/backups/sqlite:/backup:ro" \
  alpine sh -c 'cp /backup/NAME_FROM_BACKUP.sqlite3 /data/rezzie.db'
docker compose -f docker-compose.production.yml up -d api
curl --fail https://api.rezzie.org/ready
```

Use a non-production server/volume for the first rehearsal. For a production restore, retain the current database as an additional backup before replacing it. Confirm `/ready`, one authenticated library request, and the credit balance afterwards—without printing document contents or secrets into logs.

## When to move to Postgres

Plan the Supabase/Postgres migration when Rezzie needs multiple API instances, sustained concurrent writes, managed point-in-time recovery, or a larger operational team. SQLite is not an obstacle to the Chrome extension: the extension calls the same single API, and that API owns all writes.
