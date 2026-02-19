# OlymRoad Specification

OlymRoad is a student olympiad journey platform: **Roadmap/Calendar + Registration + Prep Tracking + Results + Analytics**.

Primary roles:
- **Student**
- **Teacher/Coach**
- **Admin/Organizer**

## 1) Real Project Structure (Monorepo)

This spec aligns to the actual repository layout:

- `apps/web`: SvelteKit frontend (CSR-first), Capacitor targets (`android`, `ios`)
- `apps/api`: ElysiaJS API (Bun)
- `db/migrations`: SQL migrations (source of truth for schema)
- `infra/scripts`: dev bootstrap scripts (migration runner, MinIO init)
- `docker-compose.yml`: local infra (`postgres`, `minio`, bootstrap jobs)
- root `.env` / `.env.example`: unified environment configuration for all apps/services
- root `package.json`: orchestration scripts (`dev`, `infra:up`, `db:migrate`, etc.)

## 2) Environment and Deployment Constraints

- Local dev environment must be reproducible from git via Docker Compose.
- Local infra includes **PostgreSQL + MinIO**.
- DB schema must always match latest committed SQL migrations.
- Use a **single unified root `.env`**.
- Storage target for now is local **MinIO** only.
- API provider is **OpenAI** with models:
1. `gpt-5.2`
2. `gpt-5-mini`
3. `gpt-5-nano`
- Web runtime is **CSR-first**.
- Capacitor Android/iOS builds use **local web sources** but call backend through configured **remote public API URL** (`PUBLIC_API_URL`), never localhost.

## 3) Roles and Access Rules

- Student: only own profile, registrations, prep, results, analytics.
- Teacher: own groups, students in own groups, comments/plans for assigned students.
- Admin: olympiad/stage lifecycle, dictionaries, role/access management.
- Strict RBAC and row-level ownership checks are mandatory for every protected endpoint.

## 4) Data Model

Authoritative DB schema and data-flow contract is defined in `db_specs.md`.
If any DB/storage conflict exists between files, `db_specs.md` wins.

## 4.1 Enums

- `user_role`: `student`, `teacher`, `admin`
- `olympiad_format`: `online`, `offline`, `mixed`
- `registration_status`: `planned`, `registered`, `participated`, `result_added`
- `prep_type`: `theory`, `problems`, `mock_exam`
- `result_status`: `participant`, `prize_winner`, `winner`
- `notification_type`: `deadline_soon`, `new_comment`, `result_added`, `reminder`
- `goal_period`: `week`, `month`
- `plan_status`: `draft`, `active`, `completed`, `cancelled`
- `entity_status`: `draft`, `published`, `archived`

## 4.2 Core Tables

- `users`
1. `id` PK
2. `name`, `email` (unique), `password_hash` (nullable for OAuth users)
3. `role` (`user_role`)
4. `school`, `grade` (nullable)
5. `locale` (`en`/`ru`/`kz`, default `ru`)
6. `is_active` (boolean)
7. `created_at`, `updated_at`

- `auth_accounts` (for optional Google auth)
1. `id` PK
2. `user_id` FK -> `users`
3. `provider` (`google`)
4. `provider_account_id` (unique per provider)
5. `created_at`

- `student_profiles`
1. `user_id` PK/FK -> `users`
2. `directions_json`
3. `goals_text`
4. `onboarding_completed_at` (nullable)
5. `updated_at`

- `teacher_profiles`
1. `user_id` PK/FK -> `users`
2. `subjects_json`
3. `updated_at`

- `subjects` (admin-managed dictionary)
1. `id` PK
2. `code` (unique)
3. `name_ru`, `name_kz`
4. `is_active`, `sort_order`

- `levels` (admin-managed dictionary)
1. `id` PK
2. `code` (unique)
3. `name_ru`, `name_kz`
4. `is_active`, `sort_order`

- `regions` (admin-managed dictionary)
1. `id` PK
2. `code` (unique)
3. `name_ru`, `name_kz`
4. `is_active`, `sort_order`

- `olympiads`
1. `id` PK
2. `title`
3. `subject_id` FK -> `subjects`
4. `level_id` FK -> `levels`
5. `region_id` FK -> `regions` (nullable)
6. `format` (`olympiad_format`)
7. `organizer`, `rules_url` (nullable)
8. `season` (e.g. `2025-2026`)
9. `status` (`entity_status`)
10. `confirmed_by` FK -> `users` (nullable)
11. `confirmed_at` (nullable)
12. `created_at`, `updated_at`

- `stages`
1. `id` PK
2. `olympiad_id` FK -> `olympiads`
3. `name`
4. `date_start`, `date_end` (nullable)
5. `registration_deadline`
6. `location`, `online_link` (nullable)
7. `checklist_json` JSONB (structured checklist)
8. `status` (`entity_status`)
9. `confirmed_by` FK -> `users` (nullable)
10. `confirmed_at` (nullable)
11. `created_at`, `updated_at`

- `registrations`
1. `id` PK
2. `student_id` FK -> `users`
3. `stage_id` FK -> `stages`
4. `status` (`registration_status`)
5. `created_at`, `updated_at`
6. `UNIQUE(student_id, stage_id)`

- `prep_activities`
1. `id` PK
2. `student_id` FK -> `users`
3. `stage_id` FK -> `stages` (nullable)
4. `date`
5. `duration_minutes`
6. `type` (`prep_type`)
7. `topic`
8. `materials_url` (nullable)

- `prep_goals`
1. `id` PK
2. `student_id` FK -> `users`
3. `period` (`goal_period`) (`week`/`month`)
4. `period_start`
5. `target_minutes`
6. `target_problems`
7. `target_mock_exams`
8. `UNIQUE(student_id, period, period_start)`

- `teacher_prep_plans`
1. `id` PK
2. `teacher_id` FK -> `users`
3. `student_id` FK -> `users`
4. `subject_id` FK -> `subjects`
5. `period_start`, `period_end`
6. `objective_text`
7. `status` (`plan_status`)
8. `created_at`, `updated_at`

- `teacher_prep_plan_items`
1. `id` PK
2. `plan_id` FK -> `teacher_prep_plans`
3. `item_type` (`theory`/`problems`/`mock_exam`)
4. `topic`
5. `target_count`
6. `notes` (nullable)

- `results`
1. `id` PK
2. `student_id` FK -> `users`
3. `stage_id` FK -> `stages`
4. `score` (numeric)
5. `place` (nullable)
6. `status` (`result_status`)
7. `comment` (nullable)
8. `created_at`
9. `UNIQUE(student_id, stage_id)`

- `groups`
1. `id` PK
2. `teacher_id` FK -> `users`
3. `name`
4. `subject_id` FK -> `subjects`
5. `created_at`

- `group_students`
1. `group_id` FK -> `groups`
2. `student_id` FK -> `users`
3. `PRIMARY KEY(group_id, student_id)`

- `teacher_comments`
1. `id` PK
2. `teacher_id` FK -> `users`
3. `student_id` FK -> `users`
4. `stage_id` FK -> `stages` (nullable)
5. `text`
6. `created_at`

- `notifications`
1. `id` PK
2. `user_id` FK -> `users`
3. `type` (`notification_type`)
4. `title`, `body`
5. `is_read` (default false)
6. `created_at`

## 4.3 Optional Tables

- `badges`, `student_badges` for achievement feed/badges
- `calendar_integrations` for Google/Apple tokenized sync
- `leaderboard_snapshots` for school/group ranking views
- `export_jobs` for asynchronous PDF/XLSX exports (if needed)

## 5) API Modules (Required + Optional)

## 5.1 Auth and Access

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/oauth/google` (optional)
- `PATCH /admin/users/:id/role` (admin role/access management)
- `PATCH /admin/users/:id/active` (enable/disable access)

## 5.2 Onboarding and Profile

- `GET /me`
- `PUT /me/profile`
- `POST /me/onboarding/complete`

Onboarding must capture: direction(s), goals, class/grade.

## 5.3 Admin Dictionaries

- `GET /dictionaries` (public read)
- `POST /admin/dictionaries/subjects`
- `PATCH /admin/dictionaries/subjects/:id`
- `POST /admin/dictionaries/levels`
- `PATCH /admin/dictionaries/levels/:id`
- `POST /admin/dictionaries/regions`
- `PATCH /admin/dictionaries/regions/:id`

## 5.4 Olympiads and Stages (Admin)

- `POST /admin/olympiads`
- `PATCH /admin/olympiads/:id` (edit)
- `POST /admin/olympiads/:id/confirm` (confirm data)
- `POST /admin/olympiads/:id/stages`
- `PATCH /admin/stages/:id` (edit)
- `POST /admin/stages/:id/confirm` (confirm data)

## 5.5 Roadmap / Calendar (Student/Teacher)

- `GET /roadmap`
1. Supports **yearly** and **monthly** view modes.
2. Filters: `subject`, `level`, `format`, `month`, `year`, `deadline_soon`, `registration_status`.
- `GET /stages/:id` returns stage card with structured checklist.

Structured checklist contract in stage card:
- `documents_required` (string[])
- `consent_required` (boolean)
- `fee_amount` (number | null)
- `platform_name` (string | null)
- `platform_url` (string | null)

## 5.6 Registration and Deadlines

- `POST /stages/:id/register`
- `PATCH /stages/:id/status`
- `GET /registrations/me`

Status flow is strict:
- `planned -> registered -> participated -> result_added`

When result is created for a stage, backend must auto-set registration status to `result_added`.

## 5.7 Prep Tracker and Goals

- `POST /prep-activities`
- `GET /prep-activities/me`
- `PUT /prep-goals/me` (week/month targets)
- `GET /prep-goals/me?period=week|month`

## 5.8 Teacher Workspace

- `POST /teacher/groups`
- `POST /teacher/groups/:group_id/students`
- `GET /teacher/groups/:group_id/summary`
- `POST /teacher/students/:student_id/comments`
- `POST /teacher/students/:student_id/plans` (assign prep plan)
- `GET /teacher/students/:student_id/plans`
- `PATCH /teacher/plans/:plan_id`

Optional:
- `GET /teacher/groups/:group_id/export?format=pdf|xlsx`

## 5.9 Results and Analytics

- `POST /stages/:id/results`
- `GET /analytics/me/scores`
- `GET /analytics/me/activity`
- `GET /analytics/me/funnel`
- `GET /analytics/me/correlation` (prep vs result)
- `GET /analytics/me/forecast` (basic trend forecast)
- `GET /analytics/me/summary` (recommendations)

## 5.10 Notifications

- `GET /notifications`
- `POST /notifications/:id/read`

## 5.11 Optional Integrations and Engagement

- `GET /calendar/ics` (ICS export)
- `POST /integrations/google-calendar/connect` (optional)
- `POST /integrations/apple-calendar/connect` (optional)
- `GET /achievements/me` (badges/feed)
- `GET /leaderboard/groups/:group_id` (ranking if policy allows)
- `POST /ai/study-assistant` (OpenAI-backed topic/task helper)

## 6) Frontend Screen Map

- Onboarding (direction, goals, grade)
- Roadmap (year/month calendar + list + filters)
- Stage card (dates, deadline, checklist, register)
- Prep tracker (activities + weekly/monthly goals)
- Results entry
- Analytics (scores, activity, funnel, correlation, forecast, recommendations)
- Teacher dashboard (groups, student summary, comments, assigned plans, optional export)
- Admin panel (olympiads/stages CRUD+confirm, dictionaries, roles/access)
- Notifications center

## 7) Non-Functional Requirements

- UX: max **3 clicks** to register or view stage deadline.
- Performance: dashboard open target **<= 2 seconds** on average laptop (p95).
- Security: strict RBAC + ownership checks for user/group data.
- Localization: minimum **EN + RU + KZ** UI support.
- Accessibility/mobile: responsive UI required, mobile-first safe interactions.
- Reliability: local infra and migration flow must run reproducibly from fresh clone.

## 8) Ordered Implementation Plan (Safe Delivery)

Each phase must follow this rollout order:

1. Apply additive SQL migration(s) only.
2. Deploy backend with backward-compatible reads/writes.
3. Deploy frontend using new backend fields/routes.
4. Backfill data and switch flows.
5. Only then remove deprecated columns/routes in a later phase.

### Phase 0: Infra and Contracts

- DB/Migrations:
1. Ensure migration framework exists (`schema_migrations` tracking).
2. Establish migration naming policy (`0001_*.sql`, `0002_*.sql`, ...).
- Backend:
1. Env loading from root `.env`.
2. DB and MinIO connectivity checks.
- Frontend:
1. API base URL from `PUBLIC_API_URL`.
2. EN/RU/KZ i18n bootstrap.
- Flow:
1. No feature flags needed yet.

### Phase 1: Auth, RBAC, Onboarding, Dictionaries

- DB:
1. Create `users`, `auth_accounts`, profiles, dictionary tables.
- Backend:
1. Auth endpoints.
2. RBAC middleware.
3. Admin role/access endpoints.
4. Dictionary CRUD endpoints.
- Frontend:
1. Login/register.
2. Onboarding flow.
3. Admin dictionary/role management pages.
- Flow migration:
1. Seed base dictionaries (subjects/levels/regions).

### Phase 2: Olympiads, Stages, Roadmap, Registration

- DB:
1. Create olympiad/stage tables with structured checklist.
2. Create registrations with uniqueness constraint.
- Backend:
1. Olympiad/stage create/edit/confirm endpoints.
2. Roadmap endpoint with `year` + `registration_status` filters.
3. Registration/status endpoints with transition validation.
- Frontend:
1. Year/month roadmap UI.
2. Stage card with checklist.
3. Register/status UI.
- Flow migration:
1. If legacy requirement text exists, backfill `checklist_json`.

### Phase 3: Prep Tracker + Weekly/Monthly Goals

- DB:
1. Create `prep_activities`, `prep_goals`.
- Backend:
1. Activity endpoints.
2. Goals endpoints.
- Frontend:
1. Tracker UI with goals by week/month.

### Phase 4: Teacher Groups, Comments, Assigned Plans

- DB:
1. Create `groups`, `group_students`, comments, prep plans tables.
- Backend:
1. Group management.
2. Student comments.
3. Assign/update teacher prep plans.
- Frontend:
1. Teacher dashboard core.
2. Plan assignment screens.

### Phase 5: Results + Full Analytics

- DB:
1. Create `results` with uniqueness.
2. Add required analytics indexes/materialized views if needed.
- Backend:
1. Results endpoint auto-updates registration to `result_added`.
2. Analytics endpoints: scores, activity, funnel, correlation, forecast, summary.
- Frontend:
1. Results input.
2. Analytics visualizations and recommendation blocks.
- Flow migration:
1. Backfill registration statuses for existing results.

### Phase 6: Hardening and Acceptance

- DB:
1. Constraints and indexes audit.
- Backend:
1. Authorization audit by endpoint.
2. Performance optimization for dashboard p95 target.
- Frontend:
1. EN/RU/KZ completion.
2. 3-click UX paths verified.
3. Mobile QA for web and Capacitor wrappers.

### Phase 7: Optional Features Pack

- Optional modules:
1. PDF/XLSX exports.
2. ICS export and Google/Apple calendar sync.
3. Achievement feed and badges.
4. 4-8 week personalized plan generator.
5. School/group ranking.
6. AI study assistant (OpenAI-backed).
7. Google OAuth production rollout.

## 9) Demo Data and DoD

Seed data minimum:
- 10-20 olympiads/stages across 2-3 subjects
- 1 student with prep, registrations, goals, results
- 1 teacher with group, students, comments, assigned plan
- Analytics data for at least 2 meaningful charts

Definition of Done (MVP):
- Roadmap with filters + stage card works.
- Student can register and track status/deadline.
- Student can add prep activity and set weekly/monthly goals.
- Student can add results and view analytics (scores + activity + funnel at minimum).
- Teacher sees group summary and can assign prep plan.
- Admin can edit/confirm olympiads/stages and manage dictionaries + access.
- Demo flow is presentable in 3-5 minutes.
