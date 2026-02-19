CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
CREATE TYPE olympiad_format AS ENUM ('online', 'offline', 'mixed');
CREATE TYPE registration_status AS ENUM ('planned', 'registered', 'participated', 'result_added');
CREATE TYPE prep_type AS ENUM ('theory', 'problems', 'mock_exam');
CREATE TYPE result_status AS ENUM ('participant', 'prize_winner', 'winner');
CREATE TYPE notification_type AS ENUM ('deadline_soon', 'new_comment', 'result_added', 'reminder');
CREATE TYPE goal_period AS ENUM ('week', 'month');
CREATE TYPE plan_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE entity_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE file_purpose AS ENUM ('prep_material', 'export', 'avatar', 'attachment');
CREATE TYPE file_provider AS ENUM ('minio');

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT NULL,
    role user_role NOT NULL,
    school TEXT NULL,
    grade INT NULL,
    locale TEXT NOT NULL DEFAULT 'ru' CHECK (locale IN ('en', 'ru', 'kz')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google')),
    provider_account_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_account_id)
);

CREATE TABLE student_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    directions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    goals_text TEXT NOT NULL DEFAULT '',
    onboarding_completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teacher_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    subjects_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subjects (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_kz TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE levels (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_kz TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE regions (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name_ru TEXT NOT NULL,
    name_kz TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE olympiads (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    subject_id BIGINT NOT NULL REFERENCES subjects(id),
    level_id BIGINT NOT NULL REFERENCES levels(id),
    region_id BIGINT NULL REFERENCES regions(id),
    format olympiad_format NOT NULL,
    organizer TEXT NULL,
    rules_url TEXT NULL,
    season TEXT NOT NULL,
    status entity_status NOT NULL DEFAULT 'draft',
    confirmed_by BIGINT NULL REFERENCES users(id),
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stages (
    id BIGSERIAL PRIMARY KEY,
    olympiad_id BIGINT NOT NULL REFERENCES olympiads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    date_start DATE NOT NULL,
    date_end DATE NULL,
    registration_deadline DATE NOT NULL,
    location TEXT NULL,
    online_link TEXT NULL,
    checklist_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status entity_status NOT NULL DEFAULT 'draft',
    confirmed_by BIGINT NULL REFERENCES users(id),
    confirmed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE registrations (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id BIGINT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    status registration_status NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, stage_id)
);

CREATE TABLE file_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider file_provider NOT NULL,
    bucket TEXT NOT NULL,
    object_key TEXT NOT NULL,
    purpose file_purpose NOT NULL,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mime_type TEXT NULL,
    size_bytes BIGINT NULL CHECK (size_bytes IS NULL OR size_bytes >= 0),
    sha256 TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE (provider, bucket, object_key)
);

CREATE TABLE prep_activities (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id BIGINT NULL REFERENCES stages(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    type prep_type NOT NULL,
    topic TEXT NOT NULL,
    materials_url TEXT NULL,
    material_object_id UUID NULL REFERENCES file_objects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prep_goals (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period goal_period NOT NULL,
    period_start DATE NOT NULL,
    target_minutes INT NOT NULL DEFAULT 0,
    target_problems INT NOT NULL DEFAULT 0,
    target_mock_exams INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, period, period_start)
);

CREATE TABLE teacher_prep_plans (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id BIGINT NOT NULL REFERENCES subjects(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    objective_text TEXT NOT NULL DEFAULT '',
    status plan_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teacher_prep_plan_items (
    id BIGSERIAL PRIMARY KEY,
    plan_id BIGINT NOT NULL REFERENCES teacher_prep_plans(id) ON DELETE CASCADE,
    item_type prep_type NOT NULL,
    topic TEXT NOT NULL,
    target_count INT NOT NULL CHECK (target_count > 0),
    notes TEXT NULL
);

CREATE TABLE results (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id BIGINT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL,
    place INT NULL,
    status result_status NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, stage_id)
);

CREATE TABLE groups (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject_id BIGINT NOT NULL REFERENCES subjects(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE group_students (
    group_id BIGINT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, student_id)
);

CREATE TABLE teacher_comments (
    id BIGSERIAL PRIMARY KEY,
    teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_id BIGINT NULL REFERENCES stages(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('pdf', 'xlsx')),
    scope_type TEXT NOT NULL,
    scope_id BIGINT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'done', 'failed')),
    result_object_id UUID NULL REFERENCES file_objects(id) ON DELETE SET NULL,
    error_text TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_student_profiles_updated_at
BEFORE UPDATE ON student_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teacher_profiles_updated_at
BEFORE UPDATE ON teacher_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_olympiads_updated_at
BEFORE UPDATE ON olympiads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stages_updated_at
BEFORE UPDATE ON stages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_registrations_updated_at
BEFORE UPDATE ON registrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_prep_goals_updated_at
BEFORE UPDATE ON prep_goals
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teacher_prep_plans_updated_at
BEFORE UPDATE ON teacher_prep_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_export_jobs_updated_at
BEFORE UPDATE ON export_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_stages_registration_deadline ON stages(registration_deadline);
CREATE INDEX idx_stages_date_start ON stages(date_start);
CREATE INDEX idx_registrations_student_status ON registrations(student_id, status);
CREATE INDEX idx_registrations_stage_status ON registrations(stage_id, status);
CREATE INDEX idx_prep_activities_student_date_desc ON prep_activities(student_id, date DESC);
CREATE INDEX idx_results_student_created_desc ON results(student_id, created_at DESC);
CREATE INDEX idx_teacher_comments_student_created_desc ON teacher_comments(student_id, created_at DESC);
CREATE INDEX idx_notifications_user_read_created_desc ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_file_objects_owner_purpose_created_desc ON file_objects(owner_user_id, purpose, created_at DESC);
