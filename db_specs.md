# OlymRoad DB Specs (PostgreSQL + MinIO)

Status: authoritative single source of truth for database schema and data flow.

Date: 2026-02-17

## 1) Scope

This document defines:

1. Local and production database/storage setup.
2. Canonical PostgreSQL schema contract.
3. Canonical MinIO/S3 object storage contract.
4. End-to-end data flows between API, PostgreSQL, and object storage.
5. Migration rollout order and compatibility rules.

If any conflict exists between this file and other specs, this file wins for DB and data flow decisions.

## 2) Systems and Versions

1. Relational DB: PostgreSQL 17 (`postgres:17-alpine` image family).
2. Object storage: MinIO (`minio/minio` + `minio/mc`).
3. API runtime touching DB/storage: `apps/api` (ElysiaJS + Bun).

## 3) Environment Contract (Root `.env`)

All services must use root `.env` only.

Required keys:

1. `POSTGRES_DB`
2. `POSTGRES_USER`
3. `POSTGRES_PASSWORD`
4. `POSTGRES_PORT`
5. `DATABASE_URL`
6. `DATABASE_URL_DOCKER`
7. `STORAGE_PRESIGN_TTL_SECONDS`
8. `MINIO_ROOT_USER`
9. `MINIO_ROOT_PASSWORD`
10. `MINIO_BUCKET`
11. `MINIO_PORT`
12. `MINIO_CONSOLE_PORT`
13. `MINIO_ENDPOINT`
14. `MINIO_ACCESS_KEY`
15. `MINIO_SECRET_KEY`

Rules:

1. `DATABASE_URL` is host-facing (`localhost`) for local tools.
2. `DATABASE_URL_DOCKER` is container-facing (`postgres`) for compose jobs.
4. Secrets are never committed.

## 4) Local Dev Setup (Docker Compose)

Canonical compose services:

1. `postgres`: primary relational store.
2. `minio`: object store endpoint.
3. `minio-init`: one-shot bucket bootstrap.
4. `migrate`: one-shot SQL migration runner.

Canonical commands:

1. `bun run infra:up`
2. `bun run infra:down`
3. `bun run infra:reset`
4. `bun run db:migrate`
5. `bun run minio:init`

Startup order contract:

1. Start `postgres` and `minio`.
2. Wait for readiness.
3. Run `minio-init`.
4. Run `migrate`.

## 5) PostgreSQL Contract

## 5.1 Conventions

1. Naming: snake_case for tables, columns, indexes.
2. Primary key type: `bigserial` unless explicitly noted.
3. Timestamps: `timestamptz` in UTC.
4. Every mutable business table has `created_at` and `updated_at`.
5. Email uniqueness is case-insensitive.

## 5.2 Extensions

Baseline migration must enable:

1. `pgcrypto` (UUID helpers if needed).
2. `citext` (case-insensitive email).

## 5.3 Enums

1. `user_role`: `student`, `teacher`, `admin`
2. `olympiad_format`: `online`, `offline`, `mixed`
3. `registration_status`: `planned`, `registered`, `participated`, `result_added`
4. `prep_type`: `theory`, `problems`, `mock_exam`
5. `result_status`: `participant`, `prize_winner`, `winner`
6. `notification_type`: `deadline_soon`, `new_comment`, `result_added`, `reminder`
7. `goal_period`: `week`, `month`
8. `plan_status`: `draft`, `active`, `completed`, `cancelled`
9. `entity_status`: `draft`, `published`, `archived`
10. `file_purpose`: `prep_material`, `export`, `avatar`, `attachment`
11. `file_provider`: `minio`

## 5.4 Core Tables (Required)

`users`

1. `id bigserial primary key`
2. `name text not null`
3. `email citext not null unique`
4. `password_hash text null`
5. `role user_role not null`
6. `school text null`
7. `grade int null`
8. `locale text not null default 'ru' check (locale in ('en','ru','kz'))`
9. `is_active boolean not null default true`
10. `created_at timestamptz not null default now()`
11. `updated_at timestamptz not null default now()`

`auth_accounts` (optional auth providers)

1. `id bigserial primary key`
2. `user_id bigint not null references users(id) on delete cascade`
3. `provider text not null check (provider in ('google'))`
4. `provider_account_id text not null`
5. `created_at timestamptz not null default now()`
6. `unique(provider, provider_account_id)`

`student_profiles`

1. `user_id bigint primary key references users(id) on delete cascade`
2. `directions_json jsonb not null default '[]'::jsonb`
3. `goals_text text not null default ''`
4. `onboarding_completed_at timestamptz null`
5. `updated_at timestamptz not null default now()`

`teacher_profiles`

1. `user_id bigint primary key references users(id) on delete cascade`
2. `subjects_json jsonb not null default '[]'::jsonb`
3. `updated_at timestamptz not null default now()`

`subjects`

1. `id bigserial primary key`
2. `code text not null unique`
3. `name_ru text not null`
4. `name_kz text not null`
5. `is_active boolean not null default true`
6. `sort_order int not null default 0`

`levels`

1. `id bigserial primary key`
2. `code text not null unique`
3. `name_ru text not null`
4. `name_kz text not null`
5. `is_active boolean not null default true`
6. `sort_order int not null default 0`

`regions`

1. `id bigserial primary key`
2. `code text not null unique`
3. `name_ru text not null`
4. `name_kz text not null`
5. `is_active boolean not null default true`
6. `sort_order int not null default 0`

`olympiads`

1. `id bigserial primary key`
2. `title text not null`
3. `subject_id bigint not null references subjects(id)`
4. `level_id bigint not null references levels(id)`
5. `region_id bigint null references regions(id)`
6. `format olympiad_format not null`
7. `organizer text null`
8. `rules_url text null`
9. `season text not null`
10. `status entity_status not null default 'draft'`
11. `confirmed_by bigint null references users(id)`
12. `confirmed_at timestamptz null`
13. `created_at timestamptz not null default now()`
14. `updated_at timestamptz not null default now()`

`stages`

1. `id bigserial primary key`
2. `olympiad_id bigint not null references olympiads(id) on delete cascade`
3. `name text not null`
4. `date_start date not null`
5. `date_end date null`
6. `registration_deadline date not null`
7. `location text null`
8. `online_link text null`
9. `checklist_json jsonb not null default '{}'::jsonb`
10. `status entity_status not null default 'draft'`
11. `confirmed_by bigint null references users(id)`
12. `confirmed_at timestamptz null`
13. `created_at timestamptz not null default now()`
14. `updated_at timestamptz not null default now()`

`registrations`

1. `id bigserial primary key`
2. `student_id bigint not null references users(id) on delete cascade`
3. `stage_id bigint not null references stages(id) on delete cascade`
4. `status registration_status not null`
5. `created_at timestamptz not null default now()`
6. `updated_at timestamptz not null default now()`
7. `unique(student_id, stage_id)`

`prep_activities`

1. `id bigserial primary key`
2. `student_id bigint not null references users(id) on delete cascade`
3. `stage_id bigint null references stages(id) on delete set null`
4. `date date not null`
5. `duration_minutes int not null check (duration_minutes > 0)`
6. `type prep_type not null`
7. `topic text not null`
8. `materials_url text null`
9. `material_object_id uuid null references file_objects(id) on delete set null`
10. `created_at timestamptz not null default now()`

`prep_goals`

1. `id bigserial primary key`
2. `student_id bigint not null references users(id) on delete cascade`
3. `period goal_period not null`
4. `period_start date not null`
5. `target_minutes int not null default 0`
6. `target_problems int not null default 0`
7. `target_mock_exams int not null default 0`
8. `created_at timestamptz not null default now()`
9. `updated_at timestamptz not null default now()`
10. `unique(student_id, period, period_start)`

`teacher_prep_plans`

1. `id bigserial primary key`
2. `teacher_id bigint not null references users(id) on delete cascade`
3. `student_id bigint not null references users(id) on delete cascade`
4. `subject_id bigint not null references subjects(id)`
5. `period_start date not null`
6. `period_end date not null`
7. `objective_text text not null default ''`
8. `status plan_status not null default 'draft'`
9. `created_at timestamptz not null default now()`
10. `updated_at timestamptz not null default now()`

`teacher_prep_plan_items`

1. `id bigserial primary key`
2. `plan_id bigint not null references teacher_prep_plans(id) on delete cascade`
3. `item_type prep_type not null`
4. `topic text not null`
5. `target_count int not null check (target_count > 0)`
6. `notes text null`

`results`

1. `id bigserial primary key`
2. `student_id bigint not null references users(id) on delete cascade`
3. `stage_id bigint not null references stages(id) on delete cascade`
4. `score numeric not null`
5. `place int null`
6. `status result_status not null`
7. `comment text null`
8. `created_at timestamptz not null default now()`
9. `unique(student_id, stage_id)`

`groups`

1. `id bigserial primary key`
2. `teacher_id bigint not null references users(id) on delete cascade`
3. `name text not null`
4. `subject_id bigint not null references subjects(id)`
5. `created_at timestamptz not null default now()`

`group_students`

1. `group_id bigint not null references groups(id) on delete cascade`
2. `student_id bigint not null references users(id) on delete cascade`
3. `primary key(group_id, student_id)`

`teacher_comments`

1. `id bigserial primary key`
2. `teacher_id bigint not null references users(id) on delete cascade`
3. `student_id bigint not null references users(id) on delete cascade`
4. `stage_id bigint null references stages(id) on delete set null`
5. `text text not null`
6. `created_at timestamptz not null default now()`

`notifications`

1. `id bigserial primary key`
2. `user_id bigint not null references users(id) on delete cascade`
3. `type notification_type not null`
4. `title text not null`
5. `body text not null`
6. `is_read boolean not null default false`
7. `created_at timestamptz not null default now()`

## 5.5 Storage Metadata Tables (Required for MinIO Data Flow)

`file_objects`

1. `id uuid primary key default gen_random_uuid()`
2. `provider file_provider not null` (`minio`)
3. `bucket text not null`
4. `object_key text not null`
5. `purpose file_purpose not null`
6. `owner_user_id bigint not null references users(id) on delete cascade`
7. `mime_type text null`
8. `size_bytes bigint null check (size_bytes is null or size_bytes >= 0)`
9. `sha256 text null`
10. `created_at timestamptz not null default now()`
11. `deleted_at timestamptz null`
12. `unique(provider, bucket, object_key)`

`export_jobs` (optional feature but schema-ready)

1. `id uuid primary key default gen_random_uuid()`
2. `requested_by bigint not null references users(id) on delete cascade`
3. `format text not null check (format in ('pdf','xlsx'))`
4. `scope_type text not null`
5. `scope_id bigint null`
6. `status text not null check (status in ('queued','processing','done','failed'))`
7. `result_object_id uuid null references file_objects(id) on delete set null`
8. `error_text text null`
9. `created_at timestamptz not null default now()`
10. `updated_at timestamptz not null default now()`

## 5.6 Index Contract (Minimum)

Create indexes:

1. `users(role)`
2. `stages(registration_deadline)`
3. `stages(date_start)`
4. `registrations(student_id, status)`
5. `registrations(stage_id, status)`
6. `prep_activities(student_id, date desc)`
7. `results(student_id, created_at desc)`
8. `teacher_comments(student_id, created_at desc)`
9. `notifications(user_id, is_read, created_at desc)`
10. `file_objects(owner_user_id, purpose, created_at desc)`

## 6) MinIO Contract

## 6.1 Bucket Rules

1. Dev bucket name from `MINIO_BUCKET` (default `olymroad-dev`).
2. Buckets are private by default.
3. API issues pre-signed URLs for upload/download.

## 6.2 Object Key Prefix Rules

Use deterministic prefixes:

1. Prep materials: `prep-materials/{student_id}/{yyyy}/{mm}/{uuid}-{safe_name}`
2. Exports: `exports/{requested_by}/{yyyy}/{mm}/{job_id}/{file_name}`
3. Avatars: `avatars/{user_id}/{uuid}.{ext}`
4. Generic attachments: `attachments/{owner_user_id}/{yyyy}/{mm}/{uuid}-{safe_name}`

## 6.3 Metadata Rules

`file_objects` row is mandatory for any object managed by the product.

Required metadata in DB:

1. provider
2. bucket
3. object_key
4. purpose
5. owner_user_id

Optional metadata:

1. `mime_type`
2. `size_bytes`
3. `sha256`

## 6.4 Retention Rules

1. Exports: delete after 30 days (or configurable lifecycle policy).
2. Temp/incomplete uploads: cleanup after 7 days.
3. Prep materials: retained until user deletes or account is deleted.
4. Account deletion must soft-delete metadata then remove objects asynchronously.

## 7) Canonical Data Flows

## 7.1 Registration Flow

1. Student views roadmap (`stages` + own `registrations`).
2. Student registers to stage.
3. API transaction:
1. Validate deadline.
2. `insert ... on conflict (student_id, stage_id) do update`.
3. Set status to `registered`.
4. Student updates status via allowed transition only.

Status transitions:

1. `planned -> registered`
2. `registered -> participated`
3. `participated -> result_added`

Invalid transitions must return domain error.

## 7.2 Results Flow

1. Student posts result for stage.
2. API transaction:
1. Upsert into `results` by `(student_id, stage_id)`.
2. Upsert/patch matching `registrations` row and set `status='result_added'`.
3. Commit atomically.

## 7.3 Prep Activity + File Flow

1. Client requests upload intent from API (`purpose=prep_material`).
2. API creates `file_objects` row and returns pre-signed upload URL.
3. Client uploads directly to MinIO.
4. Client submits prep activity with `material_object_id`.
5. API verifies file ownership and links it in `prep_activities`.

`materials_url` is legacy-compatible only. `material_object_id` is canonical.

## 7.4 Teacher Export Flow (Optional)

1. Teacher requests export (PDF/XLSX).
2. API creates `export_jobs` row (`queued`).
3. Worker generates file and uploads to object storage.
4. Worker creates/links `file_objects`, updates job to `done`.
5. API returns signed download URL.

## 8) Migration and Compatibility Rules

## 8.1 Migration Runner Rules

Current runner behavior:

1. Reads `db/migrations/*.sql`.
2. Applies files in lexicographic order.
3. Tracks applied files in `schema_migrations(version, applied_at)`.
4. Re-running is safe and applies only new files.

File naming policy:

1. `0001_foundation.sql`
2. `0002_roadmap_registration.sql`
3. `0003_prep_teacher.sql`
4. `0004_results_analytics.sql`
5. `0005_storage_objects.sql`
6. `0006_optionals.sql`

## 8.2 Simplified Rollout Plan

Phase A: Foundation

1. Users, profiles, dictionaries, olympiads/stages.
2. Enums, extensions, base indexes.

Phase B: Core Student Journey

1. Registrations, prep activities, results.
2. Registration/result status flow enforcement.

Phase C: Teacher and Analytics

1. Groups, group membership, comments, prep goals/plans.
2. Analytics-support indexes/views.

Phase D: Storage and Optionals

1. `file_objects`, `export_jobs`.
2. Optional integration tables (calendar sync, badges, leaderboard snapshots).

## 8.3 Backward Compatibility Rules

For any breaking change:

1. Add new column/table first.
2. Dual-write in API.
3. Backfill data.
4. Switch reads to new field.
5. Remove old field in a later migration only.

No destructive migration is allowed in same release as read/write switch.

## 9) Seed and Demo Data Rules

Seed must create:

1. 2-3 subjects and related levels/regions.
2. 10-20 olympiads/stages over one season.
3. 1 student with registrations, prep, goals, results.
4. 1 teacher with group, students, comments, and at least one prep plan.
5. Notifications and analytics-ready data.

## 10) Security and Access Policy

PostgreSQL roles:

1. `app_rw`: app runtime read/write.
2. `app_ro`: read-only jobs.
3. `migrator`: migration job only.

Rules:

1. API must not use superuser credentials.
2. Secrets rotate per environment.
3. MinIO keys are server-side only.
4. Clients never receive raw root keys.

## 11) Reliability and Operations

1. Health checks for postgres/minio are mandatory.
2. Migration job must fail fast on SQL error (`ON_ERROR_STOP=1`).
3. Daily backups in production for PostgreSQL.
4. Object storage lifecycle policies configured by environment.
5. Restore drill required at least once per quarter in production.
