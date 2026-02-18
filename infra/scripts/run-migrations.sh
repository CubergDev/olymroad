#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required."
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# Keep migration ordering deterministic regardless of shell behavior.
migration_files="$(find /migrations -maxdepth 1 -type f -name '*.sql' | LC_ALL=C sort)"
applied_any=0
if [ -z "$migration_files" ]; then
  echo "No migration files found in /migrations."
fi

old_ifs="$IFS"
IFS='
'
for file in $migration_files; do

  version="$(basename "$file")"
  already_applied="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 --set=version="$version" -c "SELECT 1 FROM schema_migrations WHERE version = :'version' LIMIT 1;")"

  if [ "$already_applied" = "1" ]; then
    echo "Skipping already-applied migration: $version"
    continue
  fi

  echo "Applying migration: $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --set=version="$version" -c "INSERT INTO schema_migrations(version) VALUES (:'version');"
  applied_any=1
done
IFS="$old_ifs"

if [ "$applied_any" = "0" ]; then
  echo "No new migrations to apply."
fi

echo "Migrations are up to date."
