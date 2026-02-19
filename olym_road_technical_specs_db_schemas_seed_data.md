# OlymRoad — Technical Specification

**Purpose:** single source of truth for **data model**, **DB schemas**, and **seed data** for the OlymRoad MVP.

**Version:** 0.1  
**Last updated:** 2026-02-19  

**Primary sources used to build seed (referenced by ID inside seed YAML):**
- `adilet_v1100007355` — official list of republic/international olympiads & contests (Order №514 / V1100007355)
- `calendar_2024_aeo_nis` — internal calendar “Calendar 2024 AEO NIS” (events provided as month-level timeline)

---

## Table of contents

- [1. Product scope (MVP)](#1-product-scope-mvp)
- [2. Core concepts](#2-core-concepts)
- [3. Data model (logical)](#3-data-model-logical)
- [4. PostgreSQL schema (DDL)](#4-postgresql-schema-ddl)
- [5. Firestore mapping (optional)](#5-firestore-mapping-optional)
- [6. Seed data (YAML)](#6-seed-data-yaml)
- [7. Import & operational notes](#7-import--operational-notes)

---

## 1. Product scope (MVP)

OlymRoad provides:

- **Roadmap / calendar** of olympiad events (stage instances) with filters.
- **Stage enrollment tracking:** planned → registered → participated → result entered.
- **Preparation tracker:** logs by time + topics + materials.
- **Results:** score/place/status per stage.
- **Analytics (basic):** progress over time, prep activity, funnel by pipeline.
- **Teacher dashboard:** group roster + near deadlines + activity and results.

---

## 2. Core concepts

### 2.1 Competition Series vs Season Edition
- **Competition Series (`competition_series`)**: a repeating “line” of events (e.g., IOI, IZhO, Presidential Olympiad, RKNP).
- **Season Edition (`season_editions`)**: a specific year/season of a series (e.g., `2024-2025`).

### 2.2 Pipeline template vs Stage template vs Stage instance
- **Pipeline template**: ordered chain of stages for a series.
- **Stage template**: a reusable stage definition (School stage, Regional stage, Finals, Training camp, Project defense, etc.).
- **Stage instance**: an actual event occurrence tied to a season (with dates or at least a month).

### 2.3 Registration & checklist
A stage has:
- `registration_method` (invitation / nomination / open form / school internal)
- `registration_deadline` (optional)
- `checklist` template (docs/fees/consents/platform steps)

### 2.4 Date precision
Roadmap must support partial dates:
- `DAY` — exact date
- `RANGE` — start/end
- `MONTH` — only month known (store starts_on as the first day of the month; ends_on optional)
- `UNKNOWN`

---

## 3. Data model (logical)

### 3.1 Dictionaries
- `subjects`: canonical subject codes + localized labels.
- `enums`: event types, levels, stage types, registration methods, doc types, statuses.

### 3.2 Admin data
- `competition_series` → has many `season_editions`
- `competition_series` → has many subjects (M:N)
- `competition_series` → uses one `pipeline_template`
- `pipeline_template` → has ordered `pipeline_stage_templates` → references `stage_templates`
- `season_editions` → has many `stage_instances`
- `competition_series` / `stage_instances` → attach `documents`
- `topic_frameworks` → tree of `topics`
- `competition_series` → supports many `topic_frameworks` (M:N)

### 3.3 User data
- `app_users` + `user_roles`
- `student_profiles`, `teacher_profiles`
- `teacher_groups` + `group_members`
- `student_stage_plans` (status tracking for stage instances)
- `prep_logs` + `prep_log_topics`
- `results`
- `teacher_comments`

---

## 4. PostgreSQL schema (DDL)

> Notes:
> - Uses `pgcrypto` for UUIDs.
> - Names are RU-first for MVP, with optional KZ fields.
> - URLs are stored as plain text.

```sql
-- =====================
-- Extensions
-- =====================
create extension if not exists pgcrypto;

-- =====================
-- Enums
-- =====================
create type event_type_enum as enum (
  'olympiad',
  'research_projects',
  'contest_game',
  'hackathon',
  'camp',
  'other'
);

create type competition_level_enum as enum (
  'international',
  'republican',
  'specialized',
  'university',
  'school_internal'
);

create type stage_type_enum as enum (
  'selection',
  'regional',
  'final',
  'submission',
  'defense',
  'training'
);

create type registration_method_enum as enum (
  'INVITATION_NATIONAL_TEAM',
  'NOMINATION_BY_SCHOOL',
  'OPEN_FORM',
  'SCHOOL_INTERNAL'
);

create type doc_type_enum as enum (
  'official_list',
  'regulations',
  'rules',
  'syllabus',
  'schedule',
  'results',
  'archive',
  'consent'
);

create type student_stage_status_enum as enum (
  'PLANNED',
  'REGISTERED',
  'PARTICIPATED',
  'RESULT_ENTERED',
  'MISSED',
  'CANCELLED'
);

create type prep_log_type_enum as enum (
  'problems',
  'theory',
  'mock',
  'contest',
  'project',
  'other'
);

create type result_status_enum as enum (
  'participant',
  'prize_winner',
  'winner',
  'disqualified',
  'dns'
);

create type date_precision_enum as enum (
  'DAY',
  'RANGE',
  'MONTH',
  'UNKNOWN'
);

create type stage_format_enum as enum (
  'online',
  'offline',
  'hybrid'
);

create type user_role_enum as enum (
  'student',
  'teacher',
  'admin'
);

-- =====================
-- Dictionaries
-- =====================
create table if not exists subjects (
  code text primary key,
  name_ru text not null,
  name_kz text,
  name_en text
);

-- =====================
-- Admin model
-- =====================
create table if not exists pipeline_templates (
  id text primary key,
  name_ru text not null,
  name_kz text,
  created_at timestamptz not null default now()
);

create table if not exists checklist_templates (
  id text primary key,
  name_ru text not null,
  items jsonb not null default '[]'::jsonb
);

create table if not exists stage_templates (
  id text primary key,
  name_ru text not null,
  name_kz text,
  stage_type stage_type_enum not null,
  default_registration_method registration_method_enum not null,
  checklist_template_id text references checklist_templates(id),
  created_at timestamptz not null default now()
);

create table if not exists pipeline_stage_templates (
  pipeline_template_id text not null references pipeline_templates(id) on delete cascade,
  stage_template_id text not null references stage_templates(id),
  stage_order integer not null,
  override_name_ru text,
  override_stage_type stage_type_enum,
  override_registration_method registration_method_enum,
  primary key (pipeline_template_id, stage_order),
  unique (pipeline_template_id, stage_template_id)
);

create table if not exists competition_series (
  id text primary key,
  name_ru text not null,
  name_kz text,
  abbr text,
  event_type event_type_enum not null,
  level competition_level_enum not null,
  grade_min smallint,
  grade_max smallint,
  grade_note text,
  pipeline_template_id text references pipeline_templates(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists series_subjects (
  series_id text not null references competition_series(id) on delete cascade,
  subject_code text not null references subjects(code),
  primary key (series_id, subject_code)
);

create table if not exists season_editions (
  id uuid primary key default gen_random_uuid(),
  series_id text not null references competition_series(id) on delete cascade,
  season_label text not null,
  year_start integer,
  year_end integer,
  notes text,
  created_at timestamptz not null default now(),
  unique(series_id, season_label)
);

create table if not exists stage_instances (
  id uuid primary key default gen_random_uuid(),
  series_id text not null references competition_series(id) on delete cascade,
  season_id uuid references season_editions(id) on delete set null,
  stage_template_id text not null references stage_templates(id),
  label text,

  date_precision date_precision_enum not null default 'DAY',
  starts_on date,
  ends_on date,
  registration_deadline date,

  location_text text,
  format stage_format_enum not null default 'offline',

  source_ref text,
  is_seed boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (date_precision in ('DAY','RANGE','MONTH') and starts_on is not null)
    or (date_precision = 'UNKNOWN')
  ),

  check (
    (date_precision != 'RANGE')
    or (date_precision = 'RANGE' and ends_on is not null and ends_on >= starts_on)
  )
);

create index if not exists idx_stage_instances_series_starts on stage_instances(series_id, starts_on);
create index if not exists idx_stage_instances_deadline on stage_instances(registration_deadline);

create table if not exists documents (
  id text primary key,
  doc_type doc_type_enum not null,
  title_ru text not null,
  title_kz text,
  lang text not null default 'ru',
  url text not null,

  series_id text references competition_series(id) on delete cascade,
  stage_instance_id uuid references stage_instances(id) on delete cascade,

  note text,
  created_at timestamptz not null default now(),

  check (
    (series_id is not null and stage_instance_id is null)
    or (series_id is null and stage_instance_id is not null)
  )
);

create table if not exists topic_frameworks (
  id text primary key,
  subject_code text not null references subjects(code),
  name_ru text not null,
  name_kz text,
  description text
);

create table if not exists topics (
  id text primary key,
  framework_id text not null references topic_frameworks(id) on delete cascade,
  parent_id text references topics(id) on delete set null,
  name_ru text not null,
  name_kz text,
  tags text[] not null default '{}',
  sort_order integer not null default 0
);

create table if not exists series_topic_frameworks (
  series_id text not null references competition_series(id) on delete cascade,
  framework_id text not null references topic_frameworks(id) on delete cascade,
  primary key(series_id, framework_id)
);

-- =====================
-- User model + RBAC
-- =====================
create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists user_roles (
  user_id uuid not null references app_users(id) on delete cascade,
  role user_role_enum not null,
  primary key(user_id, role)
);

create table if not exists student_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  grade smallint,
  school_name text,
  region text,
  goals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists teacher_profiles (
  user_id uuid primary key references app_users(id) on delete cascade,
  organization text,
  created_at timestamptz not null default now()
);

create table if not exists teacher_groups (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references app_users(id) on delete cascade,
  name text not null,
  subject_code text references subjects(code),
  grade_min smallint,
  grade_max smallint,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references teacher_groups(id) on delete cascade,
  student_user_id uuid not null references app_users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(group_id, student_user_id)
);

-- =====================
-- Student tracking
-- =====================
create table if not exists student_stage_plans (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references app_users(id) on delete cascade,
  stage_instance_id uuid not null references stage_instances(id) on delete cascade,

  status student_stage_status_enum not null default 'PLANNED',
  planned_at timestamptz not null default now(),
  registered_at timestamptz,

  external_registration_url text,
  checklist_state jsonb not null default '{}'::jsonb,
  notes text,

  unique(student_user_id, stage_instance_id)
);

create index if not exists idx_student_stage_plans_student_status on student_stage_plans(student_user_id, status);

create table if not exists prep_logs (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references app_users(id) on delete cascade,
  happened_on date not null,
  minutes integer not null check (minutes >= 0),
  log_type prep_log_type_enum not null,
  note text,
  resource_url text,
  stage_instance_id uuid references stage_instances(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_prep_logs_student_date on prep_logs(student_user_id, happened_on);

create table if not exists prep_log_topics (
  prep_log_id uuid not null references prep_logs(id) on delete cascade,
  topic_id text not null references topics(id),
  primary key(prep_log_id, topic_id)
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references app_users(id) on delete cascade,
  stage_instance_id uuid not null references stage_instances(id) on delete cascade,

  result_status result_status_enum not null default 'participant',
  score numeric,
  place_text text,
  comment text,
  created_at timestamptz not null default now(),

  unique(student_user_id, stage_instance_id)
);

create index if not exists idx_results_student on results(student_user_id);
create index if not exists idx_results_stage on results(stage_instance_id);

create table if not exists teacher_comments (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references app_users(id) on delete cascade,
  student_user_id uuid not null references app_users(id) on delete cascade,
  stage_instance_id uuid references stage_instances(id) on delete set null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_comments_student on teacher_comments(student_user_id);

-- =====================
-- Optional analytics views (MVP-friendly)
-- =====================
create or replace view v_student_activity_month as
select
  student_user_id,
  date_trunc('month', happened_on)::date as month,
  sum(minutes) as total_minutes,
  count(*) as logs_count
from prep_logs
group by student_user_id, date_trunc('month', happened_on);

create or replace view v_student_scores_timeline as
select
  r.student_user_id,
  si.series_id,
  si.stage_template_id,
  si.starts_on,
  r.score,
  r.result_status
from results r
join stage_instances si on si.id = r.stage_instance_id;
```

---

## 5. Firestore mapping (optional)

If you prefer Firestore for hackathon speed, map tables → collections like this:

- `subjects/{code}`
- `pipelines/{pipelineId}`
- `stageTemplates/{stageTemplateId}`
- `series/{seriesId}`
  - `series/{seriesId}/seasons/{seasonId}`
  - `series/{seriesId}/stageInstances/{stageInstanceId}` (or top-level `stageInstances` with `seriesId` index)
  - `series/{seriesId}/documents/{docId}` (or top-level `documents`)
- `topicFrameworks/{frameworkId}`
  - `topicFrameworks/{frameworkId}/topics/{topicId}`
- `users/{userId}`
  - `users/{userId}/roles/{roleId}`
  - `users/{userId}/prepLogs/{logId}`
  - `users/{userId}/results/{resultId}`
  - `users/{userId}/stagePlans/{planId}`
- `groups/{groupId}`
  - `groups/{groupId}/members/{userId}`

**Indexes you’ll want in Firestore (typical):**
- `stageInstances` by `(seriesId, starts_on)`
- `stagePlans` by `(studentId, status)`
- `prepLogs` by `(studentId, happened_on)`

---

## 6. Seed data (YAML)

### 6.1 Seed format

- Designed to be importable into either Postgres (via ETL script) or Firestore.
- IDs are stable strings (slugs) for dictionaries and admin data.
- Calendar stage instances are **month-level** (precision `MONTH`) unless exact dates are later added.

### 6.2 `seed_olymroad.yaml`

```yaml
seed:
  version: 0.1
  generated_at: "2026-02-19"

  sources:
    - id: adilet_v1100007355
      type: official_list
      title_ru: "Перечень республиканских и международных олимпиад и конкурсов... (V1100007355)"
      url: "https://adilet.zan.kz/rus/docs/V1100007355"

    - id: calendar_2024_aeo_nis
      type: calendar
      title_ru: "Calendar 2024 AEO NIS"
      url: "https://docs.google.com/spreadsheets/d/1QDc6aAePfBM6w-t8wEkq-EFTD4z7VvNV/edit?gid=1930206971"

  subjects:
    - code: general_subjects
      name_ru: "Общеобразовательные предметы"
    - code: math
      name_ru: "Математика"
    - code: physics
      name_ru: "Физика"
    - code: chemistry
      name_ru: "Химия"
    - code: biology
      name_ru: "Биология"
    - code: geography
      name_ru: "География"
    - code: informatics
      name_ru: "Информатика"
    - code: linguistics
      name_ru: "Лингвистика"
    - code: astronomy
      name_ru: "Астрономия/астрофизика"
    - code: economics
      name_ru: "Экономика"
    - code: finance
      name_ru: "Финансы"
    - code: ecology
      name_ru: "Экология"
    - code: kazakh_language
      name_ru: "Казахский язык"
    - code: kazakh_literature
      name_ru: "Казахская литература"
    - code: history
      name_ru: "История"
    - code: law
      name_ru: "Право"
    - code: electronics_smart
      name_ru: "Электроника и смарт-технологии"
    - code: science_integrated
      name_ru: "Естественные науки (интегр.)"
    - code: research_projects
      name_ru: "Научные проекты"

  documents:
    - id: doc_adilet_v1100007355
      doc_type: official_list
      title_ru: "Приказ / Перечень (V1100007355)"
      lang: ru
      url: "https://adilet.zan.kz/rus/docs/V1100007355"
      note: "Seed anchor: official list"

    - id: doc_calendar_2024_aeo_nis
      doc_type: schedule
      title_ru: "Calendar 2024 AEO NIS (Google Sheet)"
      lang: ru
      url: "https://docs.google.com/spreadsheets/d/1QDc6aAePfBM6w-t8wEkq-EFTD4z7VvNV/edit?gid=1930206971"
      note: "Month-level events timeline"

  checklist_templates:
    - id: cl_basic_registration
      name_ru: "Базовая регистрация"
      items:
        - id: doc_consent
          title_ru: "Согласие/разрешение родителей (если нужно)"
          required: false
        - id: id_docs
          title_ru: "Документы (удостоверение/школьная справка)"
          required: false
        - id: platform_account
          title_ru: "Аккаунт/доступ на платформе"
          required: false
        - id: fee
          title_ru: "Взнос (если предусмотрен)"
          required: false

    - id: cl_team_invite
      name_ru: "Национальная команда / приглашение"
      items:
        - id: nomination
          title_ru: "Номинация/приглашение"
          required: true
        - id: travel
          title_ru: "Проезд/логистика (если оффлайн)"
          required: false

    - id: cl_project_submission
      name_ru: "Подача проекта"
      items:
        - id: topic
          title_ru: "Тема/цель проекта"
          required: true
        - id: report
          title_ru: "Текст/отчет/тезисы"
          required: true
        - id: presentation
          title_ru: "Презентация"
          required: false
        - id: supervisor
          title_ru: "Научный руководитель (если требуется)"
          required: false

  stage_templates:
    - id: st_school
      name_ru: "Школьный этап"
      stage_type: selection
      default_registration_method: SCHOOL_INTERNAL
      checklist_template_id: cl_basic_registration

    - id: st_district
      name_ru: "Районный/городской этап"
      stage_type: selection
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_basic_registration

    - id: st_region
      name_ru: "Областной этап"
      stage_type: regional
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_basic_registration

    - id: st_republic_final
      name_ru: "Республиканский финал"
      stage_type: final
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_team_invite

    - id: st_intl_selection
      name_ru: "Отборочный этап (нац.)"
      stage_type: selection
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_basic_registration

    - id: st_training_camp
      name_ru: "УТС / тренировочные сборы"
      stage_type: training
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_team_invite

    - id: st_intl_selection_final
      name_ru: "Заключительный этап отбора / формирование команды"
      stage_type: final
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_team_invite

    - id: st_international_final
      name_ru: "Международный финал"
      stage_type: final
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_team_invite

    - id: st_pres_regional
      name_ru: "Президентская: региональный этап"
      stage_type: regional
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_basic_registration

    - id: st_pres_selection
      name_ru: "Президентская: отборочный этап"
      stage_type: selection
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_basic_registration

    - id: st_pres_final
      name_ru: "Президентская: республиканский этап (финал)"
      stage_type: final
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_team_invite

    - id: st_proj_school
      name_ru: "Проекты: I этап (школьный)"
      stage_type: selection
      default_registration_method: SCHOOL_INTERNAL
      checklist_template_id: cl_project_submission

    - id: st_proj_region
      name_ru: "Проекты: II этап (областной)"
      stage_type: regional
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_project_submission

    - id: st_proj_selection
      name_ru: "Проекты: III этап (отборочный)"
      stage_type: selection
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_project_submission

    - id: st_proj_final_defense
      name_ru: "Проекты: IV этап (республиканский, защита)"
      stage_type: defense
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_project_submission

    - id: st_zerde_school
      name_ru: "Зерде: I этап (школьный)"
      stage_type: selection
      default_registration_method: SCHOOL_INTERNAL
      checklist_template_id: cl_project_submission

    - id: st_zerde_district
      name_ru: "Зерде: II этап (район/город)"
      stage_type: selection
      default_registration_method: NOMINATION_BY_SCHOOL
      checklist_template_id: cl_project_submission

    - id: st_zerde_final
      name_ru: "Зерде: III этап (область/республика)"
      stage_type: final
      default_registration_method: INVITATION_NATIONAL_TEAM
      checklist_template_id: cl_project_submission

    - id: st_open_registration
      name_ru: "Регистрация"
      stage_type: selection
      default_registration_method: OPEN_FORM
      checklist_template_id: cl_basic_registration

    - id: st_open_participation
      name_ru: "Участие"
      stage_type: final
      default_registration_method: OPEN_FORM
      checklist_template_id: cl_basic_registration

    - id: st_open_results
      name_ru: "Результаты"
      stage_type: final
      default_registration_method: OPEN_FORM
      checklist_template_id: cl_basic_registration

  pipeline_templates:
    - id: pipeline_intl_team_selection
      name_ru: "Международная олимпиада: отбор → УТС → финал/команда → международный финал"
      stages:
        - stage_template_id: st_intl_selection
          order: 1
        - stage_template_id: st_training_camp
          order: 2
        - stage_template_id: st_intl_selection_final
          order: 3
        - stage_template_id: st_international_final
          order: 4

    - id: pipeline_republican_olymp
      name_ru: "Республиканская олимпиада: школа → район → область → финал"
      stages:
        - stage_template_id: st_school
          order: 1
        - stage_template_id: st_district
          order: 2
        - stage_template_id: st_region
          order: 3
        - stage_template_id: st_republic_final
          order: 4

    - id: pipeline_presidential_3stage
      name_ru: "Президентская: региональный → отборочный → республиканский"
      stages:
        - stage_template_id: st_pres_regional
          order: 1
        - stage_template_id: st_pres_selection
          order: 2
        - stage_template_id: st_pres_final
          order: 3

    - id: pipeline_project_rknp_4stage
      name_ru: "РКНП: школьный → областной → отборочный → республиканский (защита)"
      stages:
        - stage_template_id: st_proj_school
          order: 1
        - stage_template_id: st_proj_region
          order: 2
        - stage_template_id: st_proj_selection
          order: 3
        - stage_template_id: st_proj_final_defense
          order: 4

    - id: pipeline_project_zerde_3stage
      name_ru: "Зерде: школьный → район/город → область/республика"
      stages:
        - stage_template_id: st_zerde_school
          order: 1
        - stage_template_id: st_zerde_district
          order: 2
        - stage_template_id: st_zerde_final
          order: 3

    - id: pipeline_open_contest_1day
      name_ru: "Открытый конкурс: регистрация → участие → результат"
      stages:
        - stage_template_id: st_open_registration
          order: 1
        - stage_template_id: st_open_participation
          order: 2
        - stage_template_id: st_open_results
          order: 3

  topic_frameworks:
    - id: tf_math_olymp
      subject: math
      name_ru: "Олимп. математика — карта тем"
      topics:
        - id: t_math_algebra
          name_ru: "Алгебра"
        - id: t_math_geometry
          name_ru: "Геометрия"
        - id: t_math_number_theory
          name_ru: "Теория чисел"
        - id: t_math_combinatorics
          name_ru: "Комбинаторика"
        - id: t_math_inequalities
          name_ru: "Неравенства"

    - id: tf_physics_olymp
      subject: physics
      name_ru: "Олимп. физика — карта тем"
      topics:
        - id: t_phys_mechanics
          name_ru: "Механика"
        - id: t_phys_thermo
          name_ru: "Термодинамика"
        - id: t_phys_em
          name_ru: "Электричество и магнетизм"
        - id: t_phys_optics
          name_ru: "Оптика"
        - id: t_phys_modern
          name_ru: "Современная физика"

    - id: tf_informatics_olymp
      subject: informatics
      name_ru: "Олимп. информатика — карта тем"
      topics:
        - id: t_inf_ds
          name_ru: "Структуры данных"
        - id: t_inf_graphs
          name_ru: "Графы"
        - id: t_inf_dp
          name_ru: "ДП"
        - id: t_inf_strings
          name_ru: "Строки"
        - id: t_inf_greedy
          name_ru: "Жадные алгоритмы"

    - id: tf_chem_olymp
      subject: chemistry
      name_ru: "Олимп. химия — карта тем"
      topics:
        - id: t_chem_general
          name_ru: "Общая химия"
        - id: t_chem_inorganic
          name_ru: "Неорганическая"
        - id: t_chem_organic
          name_ru: "Органическая"
        - id: t_chem_physical
          name_ru: "Физхимия"
        - id: t_chem_lab
          name_ru: "Лабораторные навыки"

    - id: tf_bio_olymp
      subject: biology
      name_ru: "Олимп. биология — карта тем"
      topics:
        - id: t_bio_cell
          name_ru: "Клетка"
        - id: t_bio_genetics
          name_ru: "Генетика"
        - id: t_bio_ecology
          name_ru: "Экология"
        - id: t_bio_physio
          name_ru: "Физиология"
        - id: t_bio_evolution
          name_ru: "Эволюция"

    - id: tf_geography_olymp
      subject: geography
      name_ru: "Олимп. география — карта тем"
      topics:
        - id: t_geo_physical
          name_ru: "Физическая география"
        - id: t_geo_human
          name_ru: "Соц-экон география"
        - id: t_geo_maps
          name_ru: "Картография/GIS"
        - id: t_geo_field
          name_ru: "Полевые задания"
        - id: t_geo_environment
          name_ru: "Окружающая среда"

    - id: tf_linguistics_olymp
      subject: linguistics
      name_ru: "Олимп. лингвистика — карта тем"
      topics:
        - id: t_ling_phonetics
          name_ru: "Фонетика"
        - id: t_ling_morphology
          name_ru: "Морфология"
        - id: t_ling_syntax
          name_ru: "Синтаксис"
        - id: t_ling_semantics
          name_ru: "Семантика"
        - id: t_ling_scripts
          name_ru: "Письменности"

    - id: tf_economics_olymp
      subject: economics
      name_ru: "Олимп. экономика — карта тем"
      topics:
        - id: t_econ_micro
          name_ru: "Микро"
        - id: t_econ_macro
          name_ru: "Макро"
        - id: t_econ_finance
          name_ru: "Финансы"
        - id: t_econ_stats
          name_ru: "Статистика"
        - id: t_econ_case
          name_ru: "Кейсы"

    - id: tf_research_projects
      subject: research_projects
      name_ru: "Научные проекты — карта прогресса"
      topics:
        - id: t_rp_topic
          name_ru: "Тема и цель"
        - id: t_rp_method
          name_ru: "Методология/эксперимент"
        - id: t_rp_lit
          name_ru: "Обзор литературы"
        - id: t_rp_report
          name_ru: "Оформление/текст"
        - id: t_rp_defense
          name_ru: "Презентация и защита"

  # =====================
  # Series catalog
  # =====================
  competition_series:

    # --- International olympiads (official list) ---
    - id: intl_imo
      name_ru: "Международная олимпиада по математике"
      abbr: "IMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ipho
      name_ru: "Международная олимпиада по физике"
      abbr: "IPhO"
      event_type: olympiad
      level: international
      subjects: [physics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_physics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_icho
      name_ru: "Международная олимпиада по химии"
      abbr: "IChO"
      event_type: olympiad
      level: international
      subjects: [chemistry]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_chem_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ibo
      name_ru: "Международная олимпиада по биологии"
      abbr: "IBO"
      event_type: olympiad
      level: international
      subjects: [biology]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_bio_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_igeo
      name_ru: "Международная олимпиада по географии"
      abbr: "IGeO"
      event_type: olympiad
      level: international
      subjects: [geography]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_geography_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ioi
      name_ru: "Международная олимпиада по информатике"
      abbr: "IOI"
      event_type: olympiad
      level: international
      subjects: [informatics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_iol
      name_ru: "Международная олимпиада по лингвистике"
      abbr: "IOL"
      event_type: olympiad
      level: international
      subjects: [linguistics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_linguistics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ioaa
      name_ru: "Международная олимпиада по астрономии и астрофизике"
      abbr: "IOAA"
      event_type: olympiad
      level: international
      subjects: [astronomy]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: intl_iao
      name_ru: "Международная олимпиада по астрономии"
      abbr: "IAO"
      event_type: olympiad
      level: international
      subjects: [astronomy]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ipo
      name_ru: "Международная олимпиада по физике в области природных и технических наук"
      abbr: "IPO"
      event_type: olympiad
      level: international
      subjects: [physics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_physics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ieo
      name_ru: "Международная олимпиада по экономике"
      abbr: "IEO"
      event_type: olympiad
      level: international
      subjects: [economics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_economics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_bmo
      name_ru: "Балканская математическая олимпиада"
      abbr: "BMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_jbmo
      name_ru: "Юниорская Балканская математическая олимпиада"
      abbr: "JBMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 7, max: 10}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_west_china_mo
      name_ru: "Западно-Китайская математическая олимпиада"
      abbr: "WCMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_apmo_distance
      name_ru: "Международная дистанционная Азиатско-Тихоокеанская математическая олимпиада"
      abbr: "APMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 9, max: 12, note: "в Перечне: 9-11(12)"}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_silk_road_mo
      name_ru: "Международная математическая олимпиада 'Шелковый путь'"
      abbr: "SilkRoadMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 9, max: 12, note: "в Перечне: 9-11(12)"}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_izho
      name_ru: "Международная О. Жаутыковская олимпиада (мат/физ/инф)"
      abbr: "IZhO"
      event_type: olympiad
      level: international
      subjects: [math, physics, informatics]
      grade_range: {min: 8, max: 12, note: "для учащихся специализированных школ"}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp, tf_physics_olymp, tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ijso
      name_ru: "Международная естественно-научная олимпиада среди юниоров"
      abbr: "IJSO"
      event_type: olympiad
      level: international
      subjects: [science_integrated]
      grade_range: {min: 7, max: 10}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_physics_olymp, tf_chem_olymp, tf_bio_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_mendeleev
      name_ru: "Международная Менделеевская олимпиада по химии"
      abbr: "Mendeleev"
      event_type: olympiad
      level: international
      subjects: [chemistry]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_chem_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_kazakh_diaspora_langlit
      name_ru: "Олимпиада по казахскому языку и литературе для детей казахской диаспоры"
      abbr: "KZ-Diaspora"
      event_type: olympiad
      level: international
      subjects: [kazakh_language, kazakh_literature]
      grade_range: {min: 9, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: intl_tuimaada
      name_ru: "Международная олимпиада школьников 'Туймаада'"
      abbr: "Tuimaada"
      event_type: olympiad
      level: international
      subjects: [math, physics, chemistry, informatics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp, tf_physics_olymp, tf_chem_olymp, tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_apho
      name_ru: "Азиатская олимпиада по физике"
      abbr: "APhO"
      event_type: olympiad
      level: international
      subjects: [physics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_physics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_lab_talent_prep
      name_ru: "Олимпиада 'Лаборатория подготовки талантов' (физика/химия/математика)"
      abbr: "LabTalents"
      event_type: olympiad
      level: international
      subjects: [math, physics, chemistry]
      grade_range: {min: 7, max: 8}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_math_olymp, tf_physics_olymp, tf_chem_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_egeo
      name_ru: "Европейская олимпиада по географии"
      abbr: "EGeo"
      event_type: olympiad
      level: international
      subjects: [geography]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_geography_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_abo
      name_ru: "Олимпиада по биологии имени Авиценны"
      abbr: "ABO"
      event_type: olympiad
      level: international
      subjects: [biology]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_bio_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_egmo
      name_ru: "Европейская математическая олимпиада для девочек"
      abbr: "EGMO"
      event_type: olympiad
      level: international
      subjects: [math]
      grade_range: {min: 8, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_eupho
      name_ru: "Европейская физическая олимпиада"
      abbr: "EuPhO"
      event_type: olympiad
      level: international
      subjects: [physics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_physics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ceoi
      name_ru: "Центрально-Европейская олимпиада по информатике"
      abbr: "CEOI"
      event_type: olympiad
      level: international
      subjects: [informatics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_ejoi
      name_ru: "Европейская юниорская олимпиада по информатике"
      abbr: "EJOI"
      event_type: olympiad
      level: international
      subjects: [informatics]
      grade_range: {min: 7, max: 10}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: intl_eurasian_io
      name_ru: "Евразийская олимпиада по информатике (ШОС)"
      abbr: "EurasianIO"
      event_type: olympiad
      level: international
      subjects: [informatics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_intl_team_selection
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    # --- Republican olympiads (official list) ---
    - id: rk_olymp_2_4
      name_ru: "Республиканская олимпиада для учащихся 2-4 классов"
      abbr: "RO-2-4"
      event_type: olympiad
      level: republican
      subjects: [general_subjects]
      grade_range: {min: 2, max: 4}
      pipeline_template_id: pipeline_republican_olymp
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: rk_olymp_5_6
      name_ru: "Республиканская олимпиада для учащихся 5-6 классов"
      abbr: "RO-5-6"
      event_type: olympiad
      level: republican
      subjects: [general_subjects]
      grade_range: {min: 5, max: 6}
      pipeline_template_id: pipeline_republican_olymp
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: rk_olymp_7_8
      name_ru: "Республиканская олимпиада для учащихся 7-8 классов"
      abbr: "RO-7-8"
      event_type: olympiad
      level: republican
      subjects: [general_subjects]
      grade_range: {min: 7, max: 8}
      pipeline_template_id: pipeline_republican_olymp
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: rk_olymp_9_11
      name_ru: "Республиканская олимпиада для учащихся 9-11(12) классов"
      abbr: "RO-9-11"
      event_type: olympiad
      level: republican
      subjects: [general_subjects]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_republican_olymp
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: rk_presidential
      name_ru: "Президентская олимпиада (ест.-мат. цикл)"
      abbr: "President"
      event_type: olympiad
      level: republican
      subjects: [math, physics, chemistry, biology, informatics]
      grade_range: {min: 11, max: 12, note: "часто 11 класс"}
      pipeline_template_id: pipeline_presidential_3stage
      topic_framework_ids: [tf_math_olymp, tf_physics_olymp, tf_chem_olymp, tf_bio_olymp, tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    # --- Specialized olympiads (official list) ---
    - id: spec_myn_bala
      name_ru: "Национальная интеллектуальная олимпиада для сельских школ 'Мың бала'"
      abbr: "MyngBala"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 6, max: 6}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_bitibaeva
      name_ru: "Олимпиада по казахскому языку и литературе им. К. Битибаевой"
      abbr: "Bitibaeva"
      event_type: olympiad
      level: specialized
      subjects: [kazakh_language, kazakh_literature]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_sardar
      name_ru: "Комплексная олимпиада 'Сардар' (11 класс)"
      abbr: "Sardar"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 11, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_satpayev_chem
      name_ru: "Олимпиада по химии им. К. Сатпаева (9 класс)"
      abbr: "SatpayevChem"
      event_type: olympiad
      level: specialized
      subjects: [chemistry]
      grade_range: {min: 9, max: 9}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_chem_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: spec_bastau
      name_ru: "Математическая олимпиада 'Бастау' (2-4 классы)"
      abbr: "Bastau"
      event_type: olympiad
      level: specialized
      subjects: [math]
      grade_range: {min: 2, max: 4}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_math_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: spec_zharkynbolashak
      name_ru: "Олимпиада по казахскому языку 'Жарқынболашақ' (7-11)"
      abbr: "Zharkyn"
      event_type: olympiad
      level: specialized
      subjects: [kazakh_language]
      grade_range: {min: 7, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_bekturov_chem
      name_ru: "Профильная олимпиада по химии им. А. Бектурова"
      abbr: "BekturovChem"
      event_type: olympiad
      level: specialized
      subjects: [chemistry]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_chem_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: spec_tarihata
      name_ru: "Олимпиада 'Тарихата' (5-9)"
      abbr: "Tarihata"
      event_type: olympiad
      level: specialized
      subjects: [history]
      grade_range: {min: 5, max: 9}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_til_taue
      name_ru: "Олимпиада по казахскому языку 'Тіл – тәуелсіздіктұғыры'"
      abbr: "Til-Tauelsizdik"
      event_type: olympiad
      level: specialized
      subjects: [kazakh_language]
      grade_range: {min: 9, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_finance_econ
      name_ru: "Олимпиада по финансам и экономике (9–10(11))"
      abbr: "FinEcon"
      event_type: olympiad
      level: specialized
      subjects: [finance, economics]
      grade_range: {min: 9, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_economics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: spec_ecology
      name_ru: "Олимпиада по экологии (9-11(12))"
      abbr: "EcoOlym"
      event_type: olympiad
      level: specialized
      subjects: [ecology]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_geography_olymp, tf_bio_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: spec_abaitanу
      name_ru: "Олимпиада по казахскому языку и литературе 'Абайтану'"
      abbr: "Abaitanу"
      event_type: olympiad
      level: specialized
      subjects: [kazakh_language, kazakh_literature]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_kazbilim
      name_ru: "Олимпиада 'Қазақстанбілімолимпиадасы' (в т.ч. НИШ)"
      abbr: "KazBilim"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 10, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_electronics_smart
      name_ru: "Олимпиада по электронике и смарт-технологиям (7–11)"
      abbr: "SmartTech"
      event_type: olympiad
      level: specialized
      subjects: [electronics_smart]
      grade_range: {min: 7, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_iqanat
      name_ru: "Олимпиада 'IQanat'"
      abbr: "IQanat"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 7, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_youngchallenger
      name_ru: "Олимпиада 'Youngchallenger' (частные/международные школы)"
      abbr: "YoungChallenger"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 7, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: spec_akbota
      name_ru: "Интеллектуальная олимпиада 'Ақбота'"
      abbr: "Akbota"
      event_type: olympiad
      level: specialized
      subjects: [general_subjects]
      grade_range: {min: 2, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    # --- University olympiads (official list) ---
    - id: uni_alfarabi
      name_ru: "Международная олимпиада 'Аль-Фараби' (11 класс)"
      abbr: "Al-Farabi"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 11, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_kbtu
      name_ru: "Предметная олимпиада КБТУ (10-12)"
      abbr: "KBTU"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_sdu_spt
      name_ru: "Олимпиада 'SPT' (SDU)"
      abbr: "SPT"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 11, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_abay_syi
      name_ru: "Олимпиада 'Абай сыйы' (КазНПУ)"
      abbr: "AbaySyi"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 11, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_yasaui
      name_ru: "Олимпиада 'Yasaui' (МКТУ)"
      abbr: "Yasaui"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 11, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_buketov_physics
      name_ru: "Международная олимпиада по физике (Караганда, ун-т им. Е.А.Букетова)"
      abbr: "Buketov-Phys"
      event_type: olympiad
      level: university
      subjects: [physics]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_physics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: uni_kaznwpu_natsci
      name_ru: "Традиционная олимпиада по естествознанию (9-10)"
      abbr: "NatSci"
      event_type: olympiad
      level: university
      subjects: [science_integrated]
      grade_range: {min: 9, max: 10}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_physics_olymp, tf_chem_olymp, tf_bio_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: uni_bilim_shyny
      name_ru: "Олимпиада 'Білім шыңы' (физ/мат/инф)"
      abbr: "BilimShyny"
      event_type: olympiad
      level: university
      subjects: [physics, math, informatics]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_physics_olymp, tf_math_olymp, tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: uni_enu_general
      name_ru: "Олимпиада по общеобразовательным предметам ЕНУ"
      abbr: "ENU"
      event_type: olympiad
      level: university
      subjects: [general_subjects]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_tugan_el
      name_ru: "Олимпиада 'Туған ел. Туған жер. Туған глобал.'"
      abbr: "TuganEl"
      event_type: olympiad
      level: university
      subjects: [history]
      grade_range: {min: 10, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: uni_aitu_icode
      name_ru: "AITUicode"
      abbr: "AITUicode"
      event_type: olympiad
      level: university
      subjects: [informatics]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    # --- Research & contests referenced by calendar ---
    - id: proj_rknp
      name_ru: "Республиканский конкурс научных проектов (РКНП)"
      abbr: "RKNP"
      event_type: research_projects
      level: republican
      subjects: [research_projects]
      grade_range: {min: 8, max: 12}
      pipeline_template_id: pipeline_project_rknp_4stage
      topic_framework_ids: [tf_research_projects]
      document_ids: [doc_adilet_v1100007355]

    - id: proj_zerde
      name_ru: "Республиканский конкурс научных проектов 'Зерде'"
      abbr: "Zerde"
      event_type: research_projects
      level: republican
      subjects: [research_projects]
      grade_range: {min: 2, max: 7}
      pipeline_template_id: pipeline_project_zerde_3stage
      topic_framework_ids: [tf_research_projects]
      document_ids: [doc_adilet_v1100007355]

    - id: proj_open_world_science
      name_ru: "Конкурс 'Открываем мир науки'"
      abbr: "OpenScience"
      event_type: research_projects
      level: republican
      subjects: [research_projects]
      grade_range: {min: 6, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_research_projects]
      document_ids: [doc_adilet_v1100007355]

    - id: proj_proeco
      name_ru: "Конкурс экологических проектов 'ProEco'"
      abbr: "ProEco"
      event_type: research_projects
      level: specialized
      subjects: [ecology, research_projects]
      grade_range: {min: 9, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_research_projects]
      document_ids: [doc_adilet_v1100007355]

    - id: proj_dzholdasbekov
      name_ru: "Конкурс им. У. Джолдасбекова (мат/мех/инф)"
      abbr: "Dzholdasbekov"
      event_type: research_projects
      level: international
      subjects: [math, physics, informatics]
      grade_range: {min: 8, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_research_projects, tf_math_olymp, tf_informatics_olymp]
      document_ids: [doc_adilet_v1100007355]

    - id: contest_bebras
      name_ru: "Игра-конкурс 'Bebras'"
      abbr: "Bebras"
      event_type: contest_game
      level: specialized
      subjects: [informatics]
      grade_range: {min: 2, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    - id: contest_kenguru
      name_ru: "Игра-конкурс 'Кенгуру'"
      abbr: "Kenguru"
      event_type: contest_game
      level: specialized
      subjects: [math]
      grade_range: {min: 2, max: 11}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: []
      document_ids: [doc_adilet_v1100007355]

    # --- Calendar-only (internal) ---
    - id: calendar_only_nis_hackathon
      name_ru: "NIS Hackathon"
      abbr: "NIS-Hack"
      event_type: hackathon
      level: school_internal
      subjects: [informatics]
      grade_range: {min: 7, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_informatics_olymp]
      document_ids: [doc_calendar_2024_aeo_nis]

    - id: calendar_only_kazakhstan_smart_space
      name_ru: "KazakhstanSmartSpace"
      abbr: "KSS"
      event_type: research_projects
      level: specialized
      subjects: [research_projects]
      grade_range: {min: 7, max: 12}
      pipeline_template_id: pipeline_open_contest_1day
      topic_framework_ids: [tf_research_projects]
      document_ids: [doc_calendar_2024_aeo_nis]

  # =====================
  # Calendar stage instances (2024, month-level)
  # =====================
  stage_instances:
    - year: 2024
      month: 1
      items:
        - series_id: rk_olymp_9_11
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Сетевой этап РО"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_izho
          stage_template_id: st_international_final
          date_precision: MONTH
          label: "Международная Жаутыковская Олимпиада"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_rknp
          stage_template_id: st_proj_selection
          date_precision: MONTH
          label: "Дедлайн экспертизы по РКНП"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_zerde
          stage_template_id: st_zerde_school
          date_precision: MONTH
          label: "1-ый поток Зерде"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 2
      items:
        - series_id: intl_imo
          stage_template_id: st_training_camp
          date_precision: MONTH
          label: "УТС olympic reserve"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_zerde
          stage_template_id: st_zerde_school
          date_precision: MONTH
          label: "1-ый поток Зерде"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_egmo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап EGMO - 2024"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_rknp
          stage_template_id: st_proj_final_defense
          date_precision: MONTH
          label: "Финальный этап РКНП"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 3
      items:
        - series_id: proj_dzholdasbekov
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Международный конкурс им. У. Джолдасбекова"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_apmo_distance
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "АТМО и МОШП"
          source_ref: calendar_2024_aeo_nis
        - series_id: calendar_only_nis_hackathon
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "NIS Hackathon 2024"
          source_ref: calendar_2024_aeo_nis
        - series_id: contest_kenguru
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Кенгуру"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 4
      items:
        - series_id: spec_finance_econ
          stage_template_id: st_school
          date_precision: MONTH
          label: "Школьный этап Олимпиады по экономике"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по физике и математике"
          source_ref: calendar_2024_aeo_nis
        - series_id: spec_bastau
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Бастау"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_zerde
          stage_template_id: st_zerde_district
          date_precision: MONTH
          label: "2-ой поток Зерде"
          source_ref: calendar_2024_aeo_nis
        - series_id: calendar_only_kazakhstan_smart_space
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "KazakhstanSmartSpace-2024"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 5
      items:
        - series_id: rk_presidential
          stage_template_id: st_pres_final
          date_precision: MONTH
          label: "Заключительный этап Президентской олимпиады"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по информатике"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по химии, биологии и географии"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ijso
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IJSO"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_open_world_science
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Открываем мир науки"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 6
      items:
        - series_id: proj_proeco
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "ProEco"
          source_ref: calendar_2024_aeo_nis
        - series_id: spec_til_taue
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Тил - тауесиздик тугыры"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_mendeleev
          stage_template_id: st_international_final
          date_precision: MONTH
          label: "Mendeleev - 2024"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_tuimaada
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап Tuimaada"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_icho
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IChO"
          source_ref: calendar_2024_aeo_nis
        - series_id: spec_finance_econ
          stage_template_id: st_republic_final
          date_precision: MONTH
          label: "Заключительный этап Олимпиады по экономике"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 7
      items:
        - series_id: intl_apho
          stage_template_id: st_international_final
          date_precision: MONTH
          label: "APhO-2024"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_icho
          stage_template_id: st_intl_selection_final
          date_precision: MONTH
          label: "Заключительный этап IChO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_iol
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IOL"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_igeo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IGeO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_imo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IMO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ibo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IBO"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 8
      items:
        - series_id: spec_myn_bala
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Мың бала"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_school
          date_precision: MONTH
          label: "Республиканская олимпиада по общеобразовательным предметам"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 9
      items:
        - series_id: intl_iao
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IAO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ipho
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IPhO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ioi
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IOI"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_igeo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IGeO"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ejoi
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап EJOI"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по праву"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 10
      items:
        - series_id: contest_bebras
          stage_template_id: st_open_participation
          date_precision: MONTH
          label: "Bebras"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_eupho
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап EuPho"
          source_ref: calendar_2024_aeo_nis
        - series_id: intl_ieo
          stage_template_id: st_intl_selection
          date_precision: MONTH
          label: "Отборочный этап IEO"
          source_ref: calendar_2024_aeo_nis
        - series_id: proj_zerde
          stage_template_id: st_zerde_school
          date_precision: MONTH
          label: "1-ый поток Зерде"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по экономике"
          source_ref: calendar_2024_aeo_nis

    - year: 2024
      month: 11
      items:
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по лингвистике"
          source_ref: calendar_2024_aeo_nis
        - series_id: rk_olymp_9_11
          stage_template_id: st_region
          date_precision: MONTH
          label: "РО по математике"
          source_ref: calendar_2024_aeo_nis
```

---

## 7. Import & operational notes

### 7.1 How to store month-only events

When importing `date_precision: MONTH` stage instances into Postgres:

- `starts_on` = first day of the month (e.g., `2024-09-01`)
- `ends_on` = optional last day of the month (or `NULL`)
- Keep `date_precision = 'MONTH'` for UI rendering (“Sep 2024” instead of an exact date).

### 7.2 How to map seed YAML into Postgres tables

Typical import pipeline:

1) Insert `subjects`.
2) Insert `documents` (global docs).
3) Insert `checklist_templates`.
4) Insert `stage_templates`.
5) Insert `pipeline_templates` + `pipeline_stage_templates`.
6) Insert `competition_series` + `series_subjects` + `series_topic_frameworks`.
7) Insert `season_editions` as needed (e.g., create one per series for `2024-2025`), then stage instances.

### 7.3 Status logic for Roadmap

- `student_stage_plans.status` is derived from user actions.
- Teacher dashboards aggregate by stage date/deadline.

### 7.4 What’s intentionally simplified in seed (hackathon reality)

- Many events are month-level (no exact deadlines). Replace with exact dates when available.
- Many series use generic pipelines (“open contest”) because official stage structure is not embedded in the legal list.
- Document packs are minimal (official list + calendar). Add per-series regulations later.

