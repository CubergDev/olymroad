re# Progress Log

## 2026-02-18 - Feature: Backend Core MVP Foundation

Completed:
- Added consolidated DB migration `db/migrations/0001_foundation.sql` aligned to `db_specs.md`:
  - all required enums,
  - core tables,
  - storage metadata tables,
  - required indexes,
  - `updated_at` trigger function and triggers.
- Implemented backend modular architecture in `apps/api/src` with:
  - config + DB client,
  - token-based auth helpers,
  - validation/parsing helpers,
  - shared HTTP error helper.
- Implemented high-priority backend endpoints:
  - Auth & profile:
    - `POST /auth/register`
    - `POST /auth/login`
    - `GET /me`
    - `PUT /me/profile`
    - `POST /me/onboarding/complete`
  - Admin user access:
    - `PATCH /admin/users/:id/role`
    - `PATCH /admin/users/:id/active`
  - Dictionaries:
    - `GET /dictionaries`
    - `POST /admin/dictionaries/subjects|levels|regions`
    - `PATCH /admin/dictionaries/subjects|levels|regions/:id`
  - Olympiads/stages admin:
    - `POST /admin/olympiads`
    - `PATCH /admin/olympiads/:id`
    - `POST /admin/olympiads/:id/confirm`
    - `POST /admin/olympiads/:id/stages`
    - `PATCH /admin/stages/:id`
    - `POST /admin/stages/:id/confirm`
  - Student roadmap + registration + results:
    - `GET /roadmap`
    - `GET /stages/:id`
    - `POST /stages/:id/register`
    - `PATCH /stages/:id/status` (strict transition validation)
    - `GET /registrations/me`
    - `POST /stages/:id/results` (atomic result upsert + registration `result_added` sync)
  - Prep tracker:
    - `POST /prep-activities`
    - `GET /prep-activities/me`
    - `PUT /prep-goals/me`
    - `GET /prep-goals/me`
- Fixed migration runner bug in `infra/scripts/run-migrations.sh` so migration version checks/inserts work reliably.
- Enabled admin bootstrap via `POST /auth/register` with `role=admin` for initial environment setup.

Validation done:
- `bun run --filter @olymroad/api build`
- `bun run db:migrate`
- `bun run build`
- `bun run check:web`

## 2026-02-18 - Feature: Backend Teacher Workspace + Analytics + Notifications

Completed:
- Implemented teacher workspace endpoints with ownership checks:
  - `POST /teacher/groups`
  - `POST /teacher/groups/:group_id/students`
  - `GET /teacher/groups/:group_id/summary`
  - `POST /teacher/students/:student_id/comments`
  - `POST /teacher/students/:student_id/plans`
  - `GET /teacher/students/:student_id/plans`
  - `PATCH /teacher/plans/:plan_id`
- Implemented analytics endpoints for student self-data:
  - `GET /analytics/me/scores`
  - `GET /analytics/me/activity`
  - `GET /analytics/me/funnel`
  - `GET /analytics/me/correlation`
  - `GET /analytics/me/forecast`
  - `GET /analytics/me/summary`
- Implemented notifications endpoints:
  - `GET /notifications`
  - `POST /notifications/:id/read`
- Extended validation/type layer with `plan_status` support for teacher prep plan lifecycle.

Validation done:
- `bun run --filter @olymroad/api build`
- `bun run build`
- `bun run check:web`

## 2026-02-18 - Fixes: Env + Timezone + Visibility + Locale Alignment

Completed:
- Refined environment configuration:
  - updated `.env.example` with API auth and timezone keys:
    - `AUTH_TOKEN_SECRET`
    - `AUTH_TOKEN_TTL_SECONDS`
    - `APP_TIMEZONE`
    - `APP_TIMEZONE_OFFSET_MINUTES`
  - set `PUBLIC_API_URL` example to local API default for local development.
  - added local `.env` (ignored by git) for developer machine defaults.
- Fixed API env-loading gap by updating API scripts to load root `.env`:
  - `apps/api/package.json`:
    - `dev`: `bun --env-file=../../.env run --watch src/index.ts`
    - `start`: `bun --env-file=../../.env run src/index.ts`
- Implemented timezone-aware date handling with Kazakhstan default UTC+5:
  - new helper module `apps/api/src/time.ts`
  - configurable offset via `APP_TIMEZONE_OFFSET_MINUTES` (default `300`).
  - replaced UTC-based comparisons in:
    - stage registration deadline check
    - roadmap `deadline_soon` window
    - teacher group summary date windows
    - analytics period windows
- Fixed roadmap/stage visibility for non-admin users:
  - `GET /roadmap` and `GET /stages/:id` now restrict non-admin reads to published olympiads/stages.
- Resolved locale mismatch with frontend:
  - added migration `db/migrations/0002_expand_user_locale_to_en.sql`
  - backend locale validation now supports `en|ru|kz`.

Validation done:
- `bun run db:migrate`
- `bun run --filter @olymroad/api build`
- `bun run build`
- `bun run check:web`

## 2026-02-18 - Backend Coverage Matrix (Mandatory vs Optional)

### Mandatory Functions (specs.md sections 5.1-5.10)

- [x] `5.1 Auth and access`
  - `POST /auth/register`
  - `POST /auth/login`
  - `PATCH /admin/users/:id/role`
  - `PATCH /admin/users/:id/active`
- [x] `5.2 Onboarding and profile`
  - `GET /me`
  - `PUT /me/profile`
  - `POST /me/onboarding/complete`
- [x] `5.3 Admin dictionaries`
  - `GET /dictionaries`
  - `POST/PATCH /admin/dictionaries/subjects*`
  - `POST/PATCH /admin/dictionaries/levels*`
  - `POST/PATCH /admin/dictionaries/regions*`
- [x] `5.4 Olympiads and stages (admin)`
  - `POST /admin/olympiads`
  - `PATCH /admin/olympiads/:id`
  - `POST /admin/olympiads/:id/confirm`
  - `POST /admin/olympiads/:id/stages`
  - `PATCH /admin/stages/:id`
  - `POST /admin/stages/:id/confirm`
- [x] `5.5 Roadmap/calendar`
  - `GET /roadmap` (year/month + filters supported)
  - `GET /stages/:id` (checklist shape returned via normalized contract)
- [x] `5.6 Registration and deadlines`
  - `POST /stages/:id/register`
  - `PATCH /stages/:id/status`
  - `GET /registrations/me`
  - strict transition validation implemented
- [x] `5.7 Prep tracker and goals`
  - `POST /prep-activities`
  - `GET /prep-activities/me`
  - `PUT /prep-goals/me`
  - `GET /prep-goals/me`
- [x] `5.8 Teacher workspace`
  - `POST /teacher/groups`
  - `POST /teacher/groups/:group_id/students`
  - `GET /teacher/groups/:group_id/summary`
  - `POST /teacher/students/:student_id/comments`
  - `POST /teacher/students/:student_id/plans`
  - `GET /teacher/students/:student_id/plans`
  - `PATCH /teacher/plans/:plan_id`
- [x] `5.9 Results and analytics`
  - `POST /stages/:id/results` (atomic `results` + `registrations.status='result_added'`)
  - `GET /analytics/me/scores`
  - `GET /analytics/me/activity`
  - `GET /analytics/me/funnel`
  - `GET /analytics/me/correlation`
  - `GET /analytics/me/forecast`
  - `GET /analytics/me/summary`
- [x] `5.10 Notifications`
  - `GET /notifications`
  - `POST /notifications/:id/read`

### Optional Functions (specs.md sections 5.1/5.8/5.11)

- [ ] `POST /auth/oauth/google`
- [ ] `GET /teacher/groups/:group_id/export?format=pdf|xlsx`
- [ ] `GET /calendar/ics`
- [ ] `POST /integrations/google-calendar/connect`
- [ ] `POST /integrations/apple-calendar/connect`
- [ ] `GET /achievements/me`
- [ ] `GET /leaderboard/groups/:group_id`
- [ ] `POST /ai/study-assistant`

### Known Conflicts / Risks (should work for MVP, but needs hardening)

- [!] `Admin bootstrap (intentionally unchanged)`: `POST /auth/register` allows creating `role=admin` directly for bootstrap.
