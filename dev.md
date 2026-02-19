# OlymRoad Dev Environment Guide

This guide brings up the full local stack:

1. Web app (`apps/web`)
2. API (`apps/api`)
3. PostgreSQL
4. MinIO object storage

It also includes a full verification checklist.

## 1. Prerequisites

1. Install `Bun` (`1.3.9+` recommended).
2. Install and run Docker Desktop (or Docker Engine + Compose).
3. Optional for mobile:
   1. Android Studio (Android)
   2. Xcode (iOS, macOS only)

## 2. Install Dependencies

Run from repository root:

```powershell
bun install
```

## 3. Configure Environment

Create local env file:

```powershell
Copy-Item .env.example .env
```

Default `.env.example` values work for local Docker setup.

Optional OAuth frontend config:

1. `PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

If you want backend audience checks for OAuth, also set:

1. `GOOGLE_OAUTH_CLIENT_IDS`

## 4. Start Local Infrastructure

```powershell
bun run infra:up
```

This command:

1. Starts PostgreSQL
2. Starts MinIO
3. Initializes MinIO bucket
4. Runs DB migrations

Optional checks:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:3000/health
```

## 5. Start API + Web Together (Concurrently)

```powershell
bun run dev
```

`dev` now runs both services via `concurrently`:

1. `dev:api` (`@olymroad/api`)
2. `dev:web` (`@olymroad/web`)

Open:

1. Web: `http://localhost:5173`
2. API health: `http://localhost:3000/health`

## 5.1 PM2 Prod Flow

If you want a process-manager flow ("compose up, run pm2, done"):

```powershell
bun run prod
```

Use root `.env` for prod too. For this profile set:

1. Front domain: `https://olymroad.depa-team.com`
2. API domain: `https://olymroad-api.depa-team.com`
3. Front port: `5123`
4. API port: `8274`

Useful PM2 ops:

1. `bun run prod:status`
2. `bun run prod:logs`
3. `bun run prod:down`

## 6. Functional Smoke Checklist

Run through these flows in the browser:

1. Register a student account.
2. Login and complete onboarding.
3. Open roadmap and stage details.
4. Register to a stage and update status.
5. Add prep activity and goals.
6. Save a result.
7. Open analytics and notifications.
8. Login as teacher/admin accounts and check role pages.

## 7. Quality Verification Commands

Run from root:

```powershell
bun run check:web
bun run --filter @olymroad/web lint
bun run build
```

If mobile surface changed:

```powershell
bun run mobile:sync
```

## 8. Mobile Setup Notes (Android/iOS)

If running the app on emulator/device, ensure `PUBLIC_API_URL` in `.env` points to a reachable API host:

1. Android emulator: `http://10.0.2.2:3000`
2. iOS simulator: `http://localhost:3000`
3. Physical device: `http://<your-lan-ip>:3000`

Then:

```powershell
bun run mobile:sync
bun run --filter @olymroad/web cap:open:android
bun run --filter @olymroad/web cap:open:ios
```

Also update `CORS_ORIGINS` in `.env` if needed for your host/origin.

## 9. Useful Operations

```powershell
bun run infra:logs
bun run infra:down
bun run infra:reset
bun run db:migrate
bun run minio:init
```

## 10. Troubleshooting

1. Docker `500`/named pipe issues:
   1. Restart Docker Desktop.
   2. Re-run `bun run infra:up`.
2. Port conflicts (`3000`, `5173`, `5432`, `9000`, `9001`):
   1. Stop conflicting processes.
   2. Restart stack.
3. “Service unavailable” in UI:
   1. Confirm `.env` exists.
   2. Confirm API is up on `http://localhost:3000/health`.
4. Broken local data:
   1. `bun run infra:reset`
   2. `bun run infra:up`
