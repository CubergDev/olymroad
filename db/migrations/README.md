# Database Migrations

Put SQL migration files here. They are applied by the `migrate` service in `docker-compose.yml`.

## Naming

Use lexicographic, incrementing names:

- `0001_init.sql`
- `0002_add_registrations.sql`
- `0003_add_results.sql`

## Runner Behavior

- `infra/scripts/run-migrations.sh` creates `schema_migrations` if missing.
- SQL files are discovered under `/migrations` and applied in deterministic lexicographic order.
- Applied filenames are tracked in `schema_migrations`.
- Re-running migration commands applies only new SQL files.

## Commands

- `bun run infra:up`: starts infra and runs one-shot migration bootstrap.
- `bun run db:migrate`: starts Postgres (if needed) and runs only pending migrations.
- `bun run infra:reset`: deletes Postgres volume; all migrations re-apply from scratch on next startup.
