# OlymRoad

Monorepo with web (`apps/web`) and API (`apps/api`) plus reproducible local infrastructure via Docker Compose.

## Prerequisites

- Bun `1.3.7+`
- Docker Desktop/Engine running

## Fast Local Setup

1. Copy environment template:

```bash
cp .env.example .env
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

2. Start local infrastructure (PostgreSQL + MinIO + bootstrap jobs):

```bash
bun run infra:up
```

This starts:

- `postgres` on `localhost:5432`
- `minio` API on `localhost:9000`
- `minio` console on `localhost:9001`
- runs `minio-init` (one-shot bucket bootstrap)
- runs `migrate` (one-shot DB migration runner)

3. Start app services:

```bash
bun run dev
```

## PM2 Prod Flow

Use the root `.env` as the only env file (for both app and compose). For your teammate setup, set:

- `PUBLIC_API_URL=https://olymroad-api.depa-team.com`
- `CORS_ORIGINS=https://olymroad.depa-team.com`
- `WEBAUTHN_RP_ID=olymroad.depa-team.com`
- `WEBAUTHN_ORIGINS=https://olymroad.depa-team.com`
- `PORT=8274`
- `WEB_PORT=5123`

Then run one command:

```bash
bun run prod
```

`prod` does all required steps in one run:

- starts compose infra (`postgres`, `minio`) using `.env`
- runs `minio-init` + `migrate`
- builds API + web
- runs `pm2 startOrReload`

Useful prod commands:

- `bun run prod:status`
- `bun run prod:logs`
- `bun run prod:down`

## Infra Commands

- `bun run infra:up` start/update local infra
- `bun run infra:down` stop infra
- `bun run infra:reset` stop and delete volumes
- `bun run infra:logs` follow infra logs
- `bun run db:migrate` run DB migrations manually
- `bun run minio:init` re-run MinIO bucket init

## Storage

- Storage uses local MinIO with `MINIO_*` env keys from root `.env`.

## Database Migrations

- Add SQL files to `db/migrations` using lexicographic names, for example `0001_init.sql`, `0002_add_results.sql`.
- Migrations are applied in deterministic lexicographic order by `infra/scripts/run-migrations.sh`.
- Applied filenames are tracked in `schema_migrations`.
- `bun run infra:up` runs migrations automatically after infra services start.
- `bun run db:migrate` ensures Postgres is up, then runs only new migrations.

## Infra Feasibility Checks

Use these checks when debugging migration/bootstrap issues:

```bash
docker compose config
bun run db:migrate
```

If Docker commands fail with `request returned 500 Internal Server Error` against Docker named pipes, restart Docker Desktop and retry.
