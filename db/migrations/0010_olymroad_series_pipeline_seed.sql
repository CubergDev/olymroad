-- 0010_olymroad_series_pipeline_seed.sql
-- generated from olym_road_technical_specs_db_schemas_seed_data.md

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
    CREATE TYPE event_type_enum AS ENUM (
      'olympiad',
      'research_projects',
      'contest_game',
      'hackathon',
      'camp',
      'other'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_level_enum') THEN
    CREATE TYPE competition_level_enum AS ENUM (
      'international',
      'republican',
      'specialized',
      'university',
      'school_internal'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_type_enum') THEN
    CREATE TYPE stage_type_enum AS ENUM (
      'selection',
      'regional',
      'final',
      'submission',
      'defense',
      'training'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_method_enum') THEN
    CREATE TYPE registration_method_enum AS ENUM (
      'INVITATION_NATIONAL_TEAM',
      'NOMINATION_BY_SCHOOL',
      'OPEN_FORM',
      'SCHOOL_INTERNAL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type_enum') THEN
    CREATE TYPE doc_type_enum AS ENUM (
      'official_list',
      'regulations',
      'rules',
      'syllabus',
      'schedule',
      'results',
      'archive',
      'consent'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_stage_status_enum') THEN
    CREATE TYPE student_stage_status_enum AS ENUM (
      'PLANNED',
      'REGISTERED',
      'PARTICIPATED',
      'RESULT_ENTERED',
      'MISSED',
      'CANCELLED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prep_log_type_enum') THEN
    CREATE TYPE prep_log_type_enum AS ENUM (
      'problems',
      'theory',
      'mock',
      'contest',
      'project',
      'other'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'date_precision_enum') THEN
    CREATE TYPE date_precision_enum AS ENUM (
      'DAY',
      'RANGE',
      'MONTH',
      'UNKNOWN'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_format_enum') THEN
    CREATE TYPE stage_format_enum AS ENUM (
      'online',
      'offline',
      'hybrid'
    );
  END IF;
END
$$;

ALTER TABLE olympiads ADD COLUMN IF NOT EXISTS series_id TEXT;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS stage_instance_id UUID;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS season_id UUID;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS stage_template_id TEXT;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS date_precision date_precision_enum NOT NULL DEFAULT 'DAY';
ALTER TABLE stages ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE stages ADD COLUMN IF NOT EXISTS is_seed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS planned_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS external_registration_url TEXT;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS goals JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE results ADD COLUMN IF NOT EXISTS stage_instance_id UUID;
ALTER TABLE results ADD COLUMN IF NOT EXISTS place_text TEXT;

DROP INDEX IF EXISTS uq_olympiads_series_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_olympiads_series_id ON olympiads(series_id);
DROP INDEX IF EXISTS uq_stages_stage_instance_id;
CREATE UNIQUE INDEX IF NOT EXISTS uq_stages_stage_instance_id ON stages(stage_instance_id);

CREATE TABLE IF NOT EXISTS pipeline_templates (
  id TEXT PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_kz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  id TEXT PRIMARY KEY,
  name_ru TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS stage_templates (
  id TEXT PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_kz TEXT,
  stage_type stage_type_enum NOT NULL,
  default_registration_method registration_method_enum NOT NULL,
  checklist_template_id TEXT REFERENCES checklist_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_stage_templates (
  pipeline_template_id TEXT NOT NULL REFERENCES pipeline_templates(id) ON DELETE CASCADE,
  stage_template_id TEXT NOT NULL REFERENCES stage_templates(id),
  stage_order INTEGER NOT NULL,
  override_name_ru TEXT,
  override_stage_type stage_type_enum,
  override_registration_method registration_method_enum,
  PRIMARY KEY (pipeline_template_id, stage_order),
  UNIQUE (pipeline_template_id, stage_template_id)
);

CREATE TABLE IF NOT EXISTS competition_series (
  id TEXT PRIMARY KEY,
  name_ru TEXT NOT NULL,
  name_kz TEXT,
  abbr TEXT,
  event_type event_type_enum NOT NULL,
  level competition_level_enum NOT NULL,
  grade_min SMALLINT,
  grade_max SMALLINT,
  grade_note TEXT,
  pipeline_template_id TEXT REFERENCES pipeline_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series_subjects (
  series_id TEXT NOT NULL REFERENCES competition_series(id) ON DELETE CASCADE,
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  PRIMARY KEY (series_id, subject_code)
);

CREATE TABLE IF NOT EXISTS season_editions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id TEXT NOT NULL REFERENCES competition_series(id) ON DELETE CASCADE,
  season_label TEXT NOT NULL,
  year_start INTEGER,
  year_end INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, season_label)
);

CREATE TABLE IF NOT EXISTS stage_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id TEXT NOT NULL REFERENCES competition_series(id) ON DELETE CASCADE,
  season_id UUID REFERENCES season_editions(id) ON DELETE SET NULL,
  stage_template_id TEXT NOT NULL REFERENCES stage_templates(id),
  label TEXT,
  date_precision date_precision_enum NOT NULL DEFAULT 'DAY',
  starts_on DATE,
  ends_on DATE,
  registration_deadline DATE,
  location_text TEXT,
  format stage_format_enum NOT NULL DEFAULT 'offline',
  source_ref TEXT,
  is_seed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (date_precision in ('DAY','RANGE','MONTH') and starts_on is not null)
    or (date_precision = 'UNKNOWN')
  ),
  CHECK (
    (date_precision != 'RANGE')
    or (date_precision = 'RANGE' and ends_on is not null and ends_on >= starts_on)
  )
);

CREATE INDEX IF NOT EXISTS idx_stage_instances_series_starts ON stage_instances(series_id, starts_on);
CREATE INDEX IF NOT EXISTS idx_stage_instances_deadline ON stage_instances(registration_deadline);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stage_instances_seed_dedupe
  ON stage_instances(series_id, stage_template_id, starts_on, COALESCE(label,''), COALESCE(source_ref,''));

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  doc_type doc_type_enum NOT NULL,
  title_ru TEXT NOT NULL,
  title_kz TEXT,
  lang TEXT NOT NULL DEFAULT 'ru',
  url TEXT NOT NULL,
  series_id TEXT REFERENCES competition_series(id) ON DELETE CASCADE,
  stage_instance_id UUID REFERENCES stage_instances(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (series_id IS NOT NULL AND stage_instance_id IS NULL)
    OR (series_id IS NULL AND stage_instance_id IS NOT NULL)
    OR (series_id IS NULL AND stage_instance_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS series_documents (
  series_id TEXT NOT NULL REFERENCES competition_series(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY(series_id, document_id)
);

CREATE TABLE IF NOT EXISTS topic_frameworks (
  id TEXT PRIMARY KEY,
  subject_code TEXT NOT NULL REFERENCES subjects(code),
  name_ru TEXT NOT NULL,
  name_kz TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL REFERENCES topic_frameworks(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
  name_ru TEXT NOT NULL,
  name_kz TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS series_topic_frameworks (
  series_id TEXT NOT NULL REFERENCES competition_series(id) ON DELETE CASCADE,
  framework_id TEXT NOT NULL REFERENCES topic_frameworks(id) ON DELETE CASCADE,
  PRIMARY KEY(series_id, framework_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  PRIMARY KEY(user_id, role)
);

CREATE TABLE IF NOT EXISTS teacher_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_code TEXT REFERENCES subjects(code),
  grade_min SMALLINT,
  grade_max SMALLINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES teacher_groups(id) ON DELETE CASCADE,
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id, student_user_id)
);

CREATE TABLE IF NOT EXISTS student_stage_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_instance_id UUID NOT NULL REFERENCES stage_instances(id) ON DELETE CASCADE,
  status student_stage_status_enum NOT NULL DEFAULT 'PLANNED',
  planned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registered_at TIMESTAMPTZ,
  external_registration_url TEXT,
  checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  UNIQUE(student_user_id, stage_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_student_stage_plans_student_status
  ON student_stage_plans(student_user_id, status);

CREATE TABLE IF NOT EXISTS prep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  happened_on DATE NOT NULL,
  minutes INTEGER NOT NULL CHECK (minutes >= 0),
  log_type prep_log_type_enum NOT NULL,
  note TEXT,
  resource_url TEXT,
  stage_instance_id UUID REFERENCES stage_instances(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prep_logs_student_date
  ON prep_logs(student_user_id, happened_on);

CREATE TABLE IF NOT EXISTS prep_log_topics (
  prep_log_id UUID NOT NULL REFERENCES prep_logs(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id),
  PRIMARY KEY(prep_log_id, topic_id)
);

CREATE TABLE IF NOT EXISTS stage_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_instance_id UUID NOT NULL REFERENCES stage_instances(id) ON DELETE CASCADE,
  result_status result_status NOT NULL DEFAULT 'participant',
  score NUMERIC,
  place_text TEXT,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_user_id, stage_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_results_student ON stage_results(student_user_id);
CREATE INDEX IF NOT EXISTS idx_stage_results_stage ON stage_results(stage_instance_id);

CREATE TABLE IF NOT EXISTS teacher_comments_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_instance_id UUID REFERENCES stage_instances(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_comments_v2_student ON teacher_comments_v2(student_user_id);

INSERT INTO subjects (code, name_ru, name_kz, is_active, sort_order) VALUES
('general_subjects', 'Общеобразовательные предметы', 'Общеобразовательные предметы', TRUE, 1),
('math', 'Математика', 'Математика', TRUE, 2),
('physics', 'Физика', 'Физика', TRUE, 3),
('chemistry', 'Химия', 'Химия', TRUE, 4),
('biology', 'Биология', 'Биология', TRUE, 5),
('geography', 'География', 'География', TRUE, 6),
('informatics', 'Информатика', 'Информатика', TRUE, 7),
('linguistics', 'Лингвистика', 'Лингвистика', TRUE, 8),
('astronomy', 'Астрономия/астрофизика', 'Астрономия/астрофизика', TRUE, 9),
('economics', 'Экономика', 'Экономика', TRUE, 10),
('finance', 'Финансы', 'Финансы', TRUE, 11),
('ecology', 'Экология', 'Экология', TRUE, 12),
('kazakh_language', 'Казахский язык', 'Казахский язык', TRUE, 13),
('kazakh_literature', 'Казахская литература', 'Казахская литература', TRUE, 14),
('history', 'История', 'История', TRUE, 15),
('law', 'Право', 'Право', TRUE, 16),
('electronics_smart', 'Электроника и смарт-технологии', 'Электроника и смарт-технологии', TRUE, 17),
('science_integrated', 'Естественные науки (интегр.)', 'Естественные науки (интегр.)', TRUE, 18),
('research_projects', 'Научные проекты', 'Научные проекты', TRUE, 19)
ON CONFLICT (code) DO UPDATE SET name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz, is_active = TRUE;

INSERT INTO levels (code, name_ru, name_kz, is_active, sort_order) VALUES
('international', 'Международный', 'Халықаралық', TRUE, 10),
('republican', 'Республиканский', 'Республикалық', TRUE, 20),
('specialized', 'Специализированный', 'Мамандандырылған', TRUE, 30),
('university', 'Вузовский', 'Университеттік', TRUE, 40),
('school_internal', 'Школьный', 'Мектепішілік', TRUE, 50)
ON CONFLICT (code) DO UPDATE SET name_ru = EXCLUDED.name_ru, name_kz = EXCLUDED.name_kz, is_active = TRUE;

INSERT INTO checklist_templates (id, name_ru, items) VALUES ('cl_basic_registration', 'Базовая регистрация', '[{"id": "doc_consent", "title_ru": "Согласие/разрешение родителей (если нужно)", "required": false}, {"id": "id_docs", "title_ru": "Документы (удостоверение/школьная справка)", "required": false}, {"id": "platform_account", "title_ru": "Аккаунт/доступ на платформе", "required": false}, {"id": "fee", "title_ru": "Взнос (если предусмотрен)", "required": false}]'::jsonb) ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, items = EXCLUDED.items;
INSERT INTO checklist_templates (id, name_ru, items) VALUES ('cl_team_invite', 'Национальная команда / приглашение', '[{"id": "nomination", "title_ru": "Номинация/приглашение", "required": true}, {"id": "travel", "title_ru": "Проезд/логистика (если оффлайн)", "required": false}]'::jsonb) ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, items = EXCLUDED.items;
INSERT INTO checklist_templates (id, name_ru, items) VALUES ('cl_project_submission', 'Подача проекта', '[{"id": "topic", "title_ru": "Тема/цель проекта", "required": true}, {"id": "report", "title_ru": "Текст/отчет/тезисы", "required": true}, {"id": "presentation", "title_ru": "Презентация", "required": false}, {"id": "supervisor", "title_ru": "Научный руководитель (если требуется)", "required": false}]'::jsonb) ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, items = EXCLUDED.items;

INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_school', 'Школьный этап', 'selection'::stage_type_enum, 'SCHOOL_INTERNAL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_district', 'Районный/городской этап', 'selection'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_region', 'Областной этап', 'regional'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_republic_final', 'Республиканский финал', 'final'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_team_invite') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_intl_selection', 'Отборочный этап (нац.)', 'selection'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_training_camp', 'УТС / тренировочные сборы', 'training'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_team_invite') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_intl_selection_final', 'Заключительный этап отбора / формирование команды', 'final'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_team_invite') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_international_final', 'Международный финал', 'final'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_team_invite') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_pres_regional', 'Президентская: региональный этап', 'regional'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_pres_selection', 'Президентская: отборочный этап', 'selection'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_pres_final', 'Президентская: республиканский этап (финал)', 'final'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_team_invite') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_proj_school', 'Проекты: I этап (школьный)', 'selection'::stage_type_enum, 'SCHOOL_INTERNAL'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_proj_region', 'Проекты: II этап (областной)', 'regional'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_proj_selection', 'Проекты: III этап (отборочный)', 'selection'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_proj_final_defense', 'Проекты: IV этап (республиканский, защита)', 'defense'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_zerde_school', 'Зерде: I этап (школьный)', 'selection'::stage_type_enum, 'SCHOOL_INTERNAL'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_zerde_district', 'Зерде: II этап (район/город)', 'selection'::stage_type_enum, 'NOMINATION_BY_SCHOOL'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_zerde_final', 'Зерде: III этап (область/республика)', 'final'::stage_type_enum, 'INVITATION_NATIONAL_TEAM'::registration_method_enum, 'cl_project_submission') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_open_registration', 'Регистрация', 'selection'::stage_type_enum, 'OPEN_FORM'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_open_participation', 'Участие', 'final'::stage_type_enum, 'OPEN_FORM'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;
INSERT INTO stage_templates (id, name_ru, stage_type, default_registration_method, checklist_template_id) VALUES ('st_open_results', 'Результаты', 'final'::stage_type_enum, 'OPEN_FORM'::registration_method_enum, 'cl_basic_registration') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, stage_type = EXCLUDED.stage_type, default_registration_method = EXCLUDED.default_registration_method, checklist_template_id = EXCLUDED.checklist_template_id;

INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_intl_team_selection', 'Международная олимпиада: отбор → УТС → финал/команда → международный финал') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;
INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_republican_olymp', 'Республиканская олимпиада: школа → район → область → финал') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;
INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_presidential_3stage', 'Президентская: региональный → отборочный → республиканский') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;
INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_project_rknp_4stage', 'РКНП: школьный → областной → отборочный → республиканский (защита)') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;
INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_project_zerde_3stage', 'Зерде: школьный → район/город → область/республика') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;
INSERT INTO pipeline_templates (id, name_ru) VALUES ('pipeline_open_contest_1day', 'Открытый конкурс: регистрация → участие → результат') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru;

INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_intl_team_selection', 'st_intl_selection', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_intl_team_selection', 'st_training_camp', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_intl_team_selection', 'st_intl_selection_final', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_intl_team_selection', 'st_international_final', 4) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_republican_olymp', 'st_school', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_republican_olymp', 'st_district', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_republican_olymp', 'st_region', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_republican_olymp', 'st_republic_final', 4) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_presidential_3stage', 'st_pres_regional', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_presidential_3stage', 'st_pres_selection', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_presidential_3stage', 'st_pres_final', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_rknp_4stage', 'st_proj_school', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_rknp_4stage', 'st_proj_region', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_rknp_4stage', 'st_proj_selection', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_rknp_4stage', 'st_proj_final_defense', 4) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_zerde_3stage', 'st_zerde_school', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_zerde_3stage', 'st_zerde_district', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_project_zerde_3stage', 'st_zerde_final', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_open_contest_1day', 'st_open_registration', 1) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_open_contest_1day', 'st_open_participation', 2) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;
INSERT INTO pipeline_stage_templates (pipeline_template_id, stage_template_id, stage_order) VALUES ('pipeline_open_contest_1day', 'st_open_results', 3) ON CONFLICT (pipeline_template_id, stage_order) DO UPDATE SET stage_template_id = EXCLUDED.stage_template_id;

INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_math_olymp', 'math', 'Олимп. математика — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_physics_olymp', 'physics', 'Олимп. физика — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_informatics_olymp', 'informatics', 'Олимп. информатика — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_chem_olymp', 'chemistry', 'Олимп. химия — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_bio_olymp', 'biology', 'Олимп. биология — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_geography_olymp', 'geography', 'Олимп. география — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_linguistics_olymp', 'linguistics', 'Олимп. лингвистика — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_economics_olymp', 'economics', 'Олимп. экономика — карта тем') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;
INSERT INTO topic_frameworks (id, subject_code, name_ru) VALUES ('tf_research_projects', 'research_projects', 'Научные проекты — карта прогресса') ON CONFLICT (id) DO UPDATE SET subject_code = EXCLUDED.subject_code, name_ru = EXCLUDED.name_ru;

INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_math_algebra', 'tf_math_olymp', NULL, 'Алгебра', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_math_geometry', 'tf_math_olymp', NULL, 'Геометрия', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_math_number_theory', 'tf_math_olymp', NULL, 'Теория чисел', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_math_combinatorics', 'tf_math_olymp', NULL, 'Комбинаторика', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_math_inequalities', 'tf_math_olymp', NULL, 'Неравенства', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_phys_mechanics', 'tf_physics_olymp', NULL, 'Механика', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_phys_thermo', 'tf_physics_olymp', NULL, 'Термодинамика', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_phys_em', 'tf_physics_olymp', NULL, 'Электричество и магнетизм', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_phys_optics', 'tf_physics_olymp', NULL, 'Оптика', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_phys_modern', 'tf_physics_olymp', NULL, 'Современная физика', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_inf_ds', 'tf_informatics_olymp', NULL, 'Структуры данных', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_inf_graphs', 'tf_informatics_olymp', NULL, 'Графы', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_inf_dp', 'tf_informatics_olymp', NULL, 'ДП', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_inf_strings', 'tf_informatics_olymp', NULL, 'Строки', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_inf_greedy', 'tf_informatics_olymp', NULL, 'Жадные алгоритмы', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_chem_general', 'tf_chem_olymp', NULL, 'Общая химия', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_chem_inorganic', 'tf_chem_olymp', NULL, 'Неорганическая', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_chem_organic', 'tf_chem_olymp', NULL, 'Органическая', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_chem_physical', 'tf_chem_olymp', NULL, 'Физхимия', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_chem_lab', 'tf_chem_olymp', NULL, 'Лабораторные навыки', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_bio_cell', 'tf_bio_olymp', NULL, 'Клетка', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_bio_genetics', 'tf_bio_olymp', NULL, 'Генетика', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_bio_ecology', 'tf_bio_olymp', NULL, 'Экология', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_bio_physio', 'tf_bio_olymp', NULL, 'Физиология', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_bio_evolution', 'tf_bio_olymp', NULL, 'Эволюция', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_geo_physical', 'tf_geography_olymp', NULL, 'Физическая география', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_geo_human', 'tf_geography_olymp', NULL, 'Соц-экон география', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_geo_maps', 'tf_geography_olymp', NULL, 'Картография/GIS', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_geo_field', 'tf_geography_olymp', NULL, 'Полевые задания', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_geo_environment', 'tf_geography_olymp', NULL, 'Окружающая среда', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_ling_phonetics', 'tf_linguistics_olymp', NULL, 'Фонетика', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_ling_morphology', 'tf_linguistics_olymp', NULL, 'Морфология', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_ling_syntax', 'tf_linguistics_olymp', NULL, 'Синтаксис', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_ling_semantics', 'tf_linguistics_olymp', NULL, 'Семантика', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_ling_scripts', 'tf_linguistics_olymp', NULL, 'Письменности', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_econ_micro', 'tf_economics_olymp', NULL, 'Микро', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_econ_macro', 'tf_economics_olymp', NULL, 'Макро', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_econ_finance', 'tf_economics_olymp', NULL, 'Финансы', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_econ_stats', 'tf_economics_olymp', NULL, 'Статистика', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_econ_case', 'tf_economics_olymp', NULL, 'Кейсы', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_rp_topic', 'tf_research_projects', NULL, 'Тема и цель', 1) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_rp_method', 'tf_research_projects', NULL, 'Методология/эксперимент', 2) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_rp_lit', 'tf_research_projects', NULL, 'Обзор литературы', 3) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_rp_report', 'tf_research_projects', NULL, 'Оформление/текст', 4) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;
INSERT INTO topics (id, framework_id, parent_id, name_ru, sort_order) VALUES ('t_rp_defense', 'tf_research_projects', NULL, 'Презентация и защита', 5) ON CONFLICT (id) DO UPDATE SET framework_id = EXCLUDED.framework_id, parent_id = EXCLUDED.parent_id, name_ru = EXCLUDED.name_ru, sort_order = EXCLUDED.sort_order;

INSERT INTO documents (id, doc_type, title_ru, lang, url, note) VALUES ('doc_adilet_v1100007355', 'official_list'::doc_type_enum, 'Приказ / Перечень (V1100007355)', 'ru', 'https://adilet.zan.kz/rus/docs/V1100007355', 'Seed anchor: official list') ON CONFLICT (id) DO UPDATE SET doc_type = EXCLUDED.doc_type, title_ru = EXCLUDED.title_ru, lang = EXCLUDED.lang, url = EXCLUDED.url, note = EXCLUDED.note;
INSERT INTO documents (id, doc_type, title_ru, lang, url, note) VALUES ('doc_calendar_2024_aeo_nis', 'schedule'::doc_type_enum, 'Calendar 2024 AEO NIS (Google Sheet)', 'ru', 'https://docs.google.com/spreadsheets/d/1QDc6aAePfBM6w-t8wEkq-EFTD4z7VvNV/edit?gid=1930206971', 'Month-level events timeline') ON CONFLICT (id) DO UPDATE SET doc_type = EXCLUDED.doc_type, title_ru = EXCLUDED.title_ru, lang = EXCLUDED.lang, url = EXCLUDED.url, note = EXCLUDED.note;

INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_imo', 'Международная олимпиада по математике', 'IMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ipho', 'Международная олимпиада по физике', 'IPhO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_icho', 'Международная олимпиада по химии', 'IChO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ibo', 'Международная олимпиада по биологии', 'IBO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_igeo', 'Международная олимпиада по географии', 'IGeO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ioi', 'Международная олимпиада по информатике', 'IOI', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_iol', 'Международная олимпиада по лингвистике', 'IOL', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ioaa', 'Международная олимпиада по астрономии и астрофизике', 'IOAA', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_iao', 'Международная олимпиада по астрономии', 'IAO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ipo', 'Международная олимпиада по физике в области природных и технических наук', 'IPO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ieo', 'Международная олимпиада по экономике', 'IEO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_bmo', 'Балканская математическая олимпиада', 'BMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_jbmo', 'Юниорская Балканская математическая олимпиада', 'JBMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 7, 10, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_west_china_mo', 'Западно-Китайская математическая олимпиада', 'WCMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_apmo_distance', 'Международная дистанционная Азиатско-Тихоокеанская математическая олимпиада', 'APMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_silk_road_mo', 'Международная математическая олимпиада ''Шелковый путь''', 'SilkRoadMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_izho', 'Международная О. Жаутыковская олимпиада (мат/физ/инф)', 'IZhO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 8, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ijso', 'Международная естественно-научная олимпиада среди юниоров', 'IJSO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 7, 10, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_mendeleev', 'Международная Менделеевская олимпиада по химии', 'Mendeleev', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_kazakh_diaspora_langlit', 'Олимпиада по казахскому языку и литературе для детей казахской диаспоры', 'KZ-Diaspora', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_tuimaada', 'Международная олимпиада школьников ''Туймаада''', 'Tuimaada', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_apho', 'Азиатская олимпиада по физике', 'APhO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_lab_talent_prep', 'Олимпиада ''Лаборатория подготовки талантов'' (физика/химия/математика)', 'LabTalents', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 7, 8, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_egeo', 'Европейская олимпиада по географии', 'EGeo', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_abo', 'Олимпиада по биологии имени Авиценны', 'ABO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_egmo', 'Европейская математическая олимпиада для девочек', 'EGMO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 8, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_eupho', 'Европейская физическая олимпиада', 'EuPhO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ceoi', 'Центрально-Европейская олимпиада по информатике', 'CEOI', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_ejoi', 'Европейская юниорская олимпиада по информатике', 'EJOI', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 7, 10, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('intl_eurasian_io', 'Евразийская олимпиада по информатике (ШОС)', 'EurasianIO', 'olympiad'::event_type_enum, 'international'::competition_level_enum, 9, 12, 'pipeline_intl_team_selection') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('rk_olymp_2_4', 'Республиканская олимпиада для учащихся 2-4 классов', 'RO-2-4', 'olympiad'::event_type_enum, 'republican'::competition_level_enum, 2, 4, 'pipeline_republican_olymp') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('rk_olymp_5_6', 'Республиканская олимпиада для учащихся 5-6 классов', 'RO-5-6', 'olympiad'::event_type_enum, 'republican'::competition_level_enum, 5, 6, 'pipeline_republican_olymp') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('rk_olymp_7_8', 'Республиканская олимпиада для учащихся 7-8 классов', 'RO-7-8', 'olympiad'::event_type_enum, 'republican'::competition_level_enum, 7, 8, 'pipeline_republican_olymp') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('rk_olymp_9_11', 'Республиканская олимпиада для учащихся 9-11(12) классов', 'RO-9-11', 'olympiad'::event_type_enum, 'republican'::competition_level_enum, 9, 12, 'pipeline_republican_olymp') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('rk_presidential', 'Президентская олимпиада (ест.-мат. цикл)', 'President', 'olympiad'::event_type_enum, 'republican'::competition_level_enum, 11, 12, 'pipeline_presidential_3stage') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_myn_bala', 'Национальная интеллектуальная олимпиада для сельских школ ''Мың бала''', 'MyngBala', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 6, 6, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_bitibaeva', 'Олимпиада по казахскому языку и литературе им. К. Битибаевой', 'Bitibaeva', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_sardar', 'Комплексная олимпиада ''Сардар'' (11 класс)', 'Sardar', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 11, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_satpayev_chem', 'Олимпиада по химии им. К. Сатпаева (9 класс)', 'SatpayevChem', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 9, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_bastau', 'Математическая олимпиада ''Бастау'' (2-4 классы)', 'Bastau', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 2, 4, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_zharkynbolashak', 'Олимпиада по казахскому языку ''Жарқынболашақ'' (7-11)', 'Zharkyn', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 7, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_bekturov_chem', 'Профильная олимпиада по химии им. А. Бектурова', 'BekturovChem', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_tarihata', 'Олимпиада ''Тарихата'' (5-9)', 'Tarihata', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 5, 9, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_til_taue', 'Олимпиада по казахскому языку ''Тіл – тәуелсіздіктұғыры''', 'Til-Tauelsizdik', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_finance_econ', 'Олимпиада по финансам и экономике (9–10(11))', 'FinEcon', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_ecology', 'Олимпиада по экологии (9-11(12))', 'EcoOlym', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_abaitanу', 'Олимпиада по казахскому языку и литературе ''Абайтану''', 'Abaitanу', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 9, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_kazbilim', 'Олимпиада ''Қазақстанбілімолимпиадасы'' (в т.ч. НИШ)', 'KazBilim', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 10, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_electronics_smart', 'Олимпиада по электронике и смарт-технологиям (7–11)', 'SmartTech', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 7, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_iqanat', 'Олимпиада ''IQanat''', 'IQanat', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 7, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_youngchallenger', 'Олимпиада ''Youngchallenger'' (частные/международные школы)', 'YoungChallenger', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 7, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('spec_akbota', 'Интеллектуальная олимпиада ''Ақбота''', 'Akbota', 'olympiad'::event_type_enum, 'specialized'::competition_level_enum, 2, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_alfarabi', 'Международная олимпиада ''Аль-Фараби'' (11 класс)', 'Al-Farabi', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 11, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_kbtu', 'Предметная олимпиада КБТУ (10-12)', 'KBTU', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_sdu_spt', 'Олимпиада ''SPT'' (SDU)', 'SPT', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 11, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_abay_syi', 'Олимпиада ''Абай сыйы'' (КазНПУ)', 'AbaySyi', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 11, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_yasaui', 'Олимпиада ''Yasaui'' (МКТУ)', 'Yasaui', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 11, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_buketov_physics', 'Международная олимпиада по физике (Караганда, ун-т им. Е.А.Букетова)', 'Buketov-Phys', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_kaznwpu_natsci', 'Традиционная олимпиада по естествознанию (9-10)', 'NatSci', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 9, 10, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_bilim_shyny', 'Олимпиада ''Білім шыңы'' (физ/мат/инф)', 'BilimShyny', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_enu_general', 'Олимпиада по общеобразовательным предметам ЕНУ', 'ENU', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_tugan_el', 'Олимпиада ''Туған ел. Туған жер. Туған глобал.''', 'TuganEl', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 10, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('uni_aitu_icode', 'AITUicode', 'AITUicode', 'olympiad'::event_type_enum, 'university'::competition_level_enum, 9, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('proj_rknp', 'Республиканский конкурс научных проектов (РКНП)', 'RKNP', 'research_projects'::event_type_enum, 'republican'::competition_level_enum, 8, 12, 'pipeline_project_rknp_4stage') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('proj_zerde', 'Республиканский конкурс научных проектов ''Зерде''', 'Zerde', 'research_projects'::event_type_enum, 'republican'::competition_level_enum, 2, 7, 'pipeline_project_zerde_3stage') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('proj_open_world_science', 'Конкурс ''Открываем мир науки''', 'OpenScience', 'research_projects'::event_type_enum, 'republican'::competition_level_enum, 6, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('proj_proeco', 'Конкурс экологических проектов ''ProEco''', 'ProEco', 'research_projects'::event_type_enum, 'specialized'::competition_level_enum, 9, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('proj_dzholdasbekov', 'Конкурс им. У. Джолдасбекова (мат/мех/инф)', 'Dzholdasbekov', 'research_projects'::event_type_enum, 'international'::competition_level_enum, 8, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('contest_bebras', 'Игра-конкурс ''Bebras''', 'Bebras', 'contest_game'::event_type_enum, 'specialized'::competition_level_enum, 2, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('contest_kenguru', 'Игра-конкурс ''Кенгуру''', 'Kenguru', 'contest_game'::event_type_enum, 'specialized'::competition_level_enum, 2, 11, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('calendar_only_nis_hackathon', 'NIS Hackathon', 'NIS-Hack', 'hackathon'::event_type_enum, 'school_internal'::competition_level_enum, 7, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();
INSERT INTO competition_series (id, name_ru, abbr, event_type, level, grade_min, grade_max, pipeline_template_id) VALUES ('calendar_only_kazakhstan_smart_space', 'KazakhstanSmartSpace', 'KSS', 'research_projects'::event_type_enum, 'specialized'::competition_level_enum, 7, 12, 'pipeline_open_contest_1day') ON CONFLICT (id) DO UPDATE SET name_ru = EXCLUDED.name_ru, abbr = EXCLUDED.abbr, event_type = EXCLUDED.event_type, level = EXCLUDED.level, grade_min = EXCLUDED.grade_min, grade_max = EXCLUDED.grade_max, pipeline_template_id = EXCLUDED.pipeline_template_id, updated_at = now();

INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_imo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_imo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_imo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ipho', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ipho', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ipho', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_icho', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_icho', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_icho', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ibo', 'biology') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ibo', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ibo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_igeo', 'geography') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_igeo', 'tf_geography_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_igeo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ioi', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ioi', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ioi', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_iol', 'linguistics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_iol', 'tf_linguistics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_iol', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ioaa', 'astronomy') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ioaa', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_iao', 'astronomy') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_iao', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ipo', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ipo', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ipo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ieo', 'economics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ieo', 'tf_economics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ieo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_bmo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_bmo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_bmo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_jbmo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_jbmo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_jbmo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_west_china_mo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_west_china_mo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_west_china_mo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_apmo_distance', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_apmo_distance', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_apmo_distance', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_silk_road_mo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_silk_road_mo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_silk_road_mo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_izho', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_izho', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_izho', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_izho', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_izho', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_izho', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_izho', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ijso', 'science_integrated') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ijso', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ijso', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ijso', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ijso', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_mendeleev', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_mendeleev', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_mendeleev', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_kazakh_diaspora_langlit', 'kazakh_language') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_kazakh_diaspora_langlit', 'kazakh_literature') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_kazakh_diaspora_langlit', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_tuimaada', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_tuimaada', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_tuimaada', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_tuimaada', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_tuimaada', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_tuimaada', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_tuimaada', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_tuimaada', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_tuimaada', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_apho', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_apho', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_apho', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_lab_talent_prep', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_lab_talent_prep', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_lab_talent_prep', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_lab_talent_prep', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_lab_talent_prep', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_lab_talent_prep', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_lab_talent_prep', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_egeo', 'geography') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_egeo', 'tf_geography_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_egeo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_abo', 'biology') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_abo', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_abo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_egmo', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_egmo', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_egmo', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_eupho', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_eupho', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_eupho', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ceoi', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ceoi', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ceoi', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_ejoi', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_ejoi', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_ejoi', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('intl_eurasian_io', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('intl_eurasian_io', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('intl_eurasian_io', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_olymp_2_4', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('rk_olymp_2_4', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_olymp_5_6', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('rk_olymp_5_6', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_olymp_7_8', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('rk_olymp_7_8', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_olymp_9_11', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('rk_olymp_9_11', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_presidential', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_presidential', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_presidential', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_presidential', 'biology') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('rk_presidential', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('rk_presidential', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('rk_presidential', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('rk_presidential', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('rk_presidential', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('rk_presidential', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('rk_presidential', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_myn_bala', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_myn_bala', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_bitibaeva', 'kazakh_language') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_bitibaeva', 'kazakh_literature') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_bitibaeva', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_sardar', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_sardar', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_satpayev_chem', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_satpayev_chem', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_satpayev_chem', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_bastau', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_bastau', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_bastau', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_zharkynbolashak', 'kazakh_language') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_zharkynbolashak', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_bekturov_chem', 'chemistry') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_bekturov_chem', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_bekturov_chem', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_tarihata', 'history') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_tarihata', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_til_taue', 'kazakh_language') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_til_taue', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_finance_econ', 'finance') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_finance_econ', 'economics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_finance_econ', 'tf_economics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_finance_econ', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_ecology', 'ecology') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_ecology', 'tf_geography_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('spec_ecology', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_ecology', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_abaitanу', 'kazakh_language') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_abaitanу', 'kazakh_literature') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_abaitanу', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_kazbilim', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_kazbilim', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_electronics_smart', 'electronics_smart') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_electronics_smart', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_iqanat', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_iqanat', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_youngchallenger', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_youngchallenger', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('spec_akbota', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('spec_akbota', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_alfarabi', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_alfarabi', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_kbtu', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_kbtu', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_sdu_spt', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_sdu_spt', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_abay_syi', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_abay_syi', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_yasaui', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_yasaui', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_buketov_physics', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_buketov_physics', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_buketov_physics', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_kaznwpu_natsci', 'science_integrated') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_kaznwpu_natsci', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_kaznwpu_natsci', 'tf_chem_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_kaznwpu_natsci', 'tf_bio_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_kaznwpu_natsci', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_bilim_shyny', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_bilim_shyny', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_bilim_shyny', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_bilim_shyny', 'tf_physics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_bilim_shyny', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_bilim_shyny', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_bilim_shyny', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_enu_general', 'general_subjects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_enu_general', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_tugan_el', 'history') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_tugan_el', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('uni_aitu_icode', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('uni_aitu_icode', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('uni_aitu_icode', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_rknp', 'research_projects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_rknp', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('proj_rknp', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_zerde', 'research_projects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_zerde', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('proj_zerde', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_open_world_science', 'research_projects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_open_world_science', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('proj_open_world_science', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_proeco', 'ecology') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_proeco', 'research_projects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_proeco', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('proj_proeco', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_dzholdasbekov', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_dzholdasbekov', 'physics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('proj_dzholdasbekov', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_dzholdasbekov', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_dzholdasbekov', 'tf_math_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('proj_dzholdasbekov', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('proj_dzholdasbekov', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('contest_bebras', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('contest_bebras', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('contest_kenguru', 'math') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('contest_kenguru', 'doc_adilet_v1100007355') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('calendar_only_nis_hackathon', 'informatics') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('calendar_only_nis_hackathon', 'tf_informatics_olymp') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('calendar_only_nis_hackathon', 'doc_calendar_2024_aeo_nis') ON CONFLICT (series_id, document_id) DO NOTHING;
INSERT INTO series_subjects (series_id, subject_code) VALUES ('calendar_only_kazakhstan_smart_space', 'research_projects') ON CONFLICT (series_id, subject_code) DO NOTHING;
INSERT INTO series_topic_frameworks (series_id, framework_id) VALUES ('calendar_only_kazakhstan_smart_space', 'tf_research_projects') ON CONFLICT (series_id, framework_id) DO NOTHING;
INSERT INTO series_documents (series_id, document_id) VALUES ('calendar_only_kazakhstan_smart_space', 'doc_calendar_2024_aeo_nis') ON CONFLICT (series_id, document_id) DO NOTHING;

INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_imo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ipho', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_icho', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ibo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_igeo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ioi', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_iol', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ioaa', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_iao', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ipo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ieo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_bmo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_jbmo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_west_china_mo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_apmo_distance', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_silk_road_mo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_izho', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ijso', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_mendeleev', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_kazakh_diaspora_langlit', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_tuimaada', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_apho', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_lab_talent_prep', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_egeo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_abo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_egmo', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_eupho', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ceoi', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_ejoi', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('intl_eurasian_io', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('rk_olymp_2_4', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('rk_olymp_5_6', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('rk_olymp_7_8', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('rk_olymp_9_11', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('rk_presidential', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_myn_bala', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_bitibaeva', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_sardar', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_satpayev_chem', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_bastau', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_zharkynbolashak', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_bekturov_chem', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_tarihata', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_til_taue', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_finance_econ', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_ecology', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_abaitanу', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_kazbilim', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_electronics_smart', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_iqanat', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_youngchallenger', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('spec_akbota', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_alfarabi', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_kbtu', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_sdu_spt', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_abay_syi', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_yasaui', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_buketov_physics', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_kaznwpu_natsci', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_bilim_shyny', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_enu_general', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_tugan_el', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('uni_aitu_icode', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('proj_rknp', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('proj_zerde', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('proj_open_world_science', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('proj_proeco', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('proj_dzholdasbekov', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('contest_bebras', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('contest_kenguru', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('calendar_only_nis_hackathon', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;
INSERT INTO season_editions (series_id, season_label, year_start, year_end) VALUES ('calendar_only_kazakhstan_smart_space', '2024-2025', 2024, 2025) ON CONFLICT (series_id, season_label) DO NOTHING;

INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Сетевой этап РО', 'MONTH'::date_precision_enum, '2024-01-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_izho', (SELECT id FROM season_editions WHERE series_id = 'intl_izho' AND season_label = '2024-2025' LIMIT 1), 'st_international_final', 'Международная Жаутыковская Олимпиада', 'MONTH'::date_precision_enum, '2024-01-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_rknp', (SELECT id FROM season_editions WHERE series_id = 'proj_rknp' AND season_label = '2024-2025' LIMIT 1), 'st_proj_selection', 'Дедлайн экспертизы по РКНП', 'MONTH'::date_precision_enum, '2024-01-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_zerde', (SELECT id FROM season_editions WHERE series_id = 'proj_zerde' AND season_label = '2024-2025' LIMIT 1), 'st_zerde_school', '1-ый поток Зерде', 'MONTH'::date_precision_enum, '2024-01-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_imo', (SELECT id FROM season_editions WHERE series_id = 'intl_imo' AND season_label = '2024-2025' LIMIT 1), 'st_training_camp', 'УТС olympic reserve', 'MONTH'::date_precision_enum, '2024-02-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_zerde', (SELECT id FROM season_editions WHERE series_id = 'proj_zerde' AND season_label = '2024-2025' LIMIT 1), 'st_zerde_school', '1-ый поток Зерде', 'MONTH'::date_precision_enum, '2024-02-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_egmo', (SELECT id FROM season_editions WHERE series_id = 'intl_egmo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап EGMO - 2024', 'MONTH'::date_precision_enum, '2024-02-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_rknp', (SELECT id FROM season_editions WHERE series_id = 'proj_rknp' AND season_label = '2024-2025' LIMIT 1), 'st_proj_final_defense', 'Финальный этап РКНП', 'MONTH'::date_precision_enum, '2024-02-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_dzholdasbekov', (SELECT id FROM season_editions WHERE series_id = 'proj_dzholdasbekov' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Международный конкурс им. У. Джолдасбекова', 'MONTH'::date_precision_enum, '2024-03-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_apmo_distance', (SELECT id FROM season_editions WHERE series_id = 'intl_apmo_distance' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'АТМО и МОШП', 'MONTH'::date_precision_enum, '2024-03-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('calendar_only_nis_hackathon', (SELECT id FROM season_editions WHERE series_id = 'calendar_only_nis_hackathon' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'NIS Hackathon 2024', 'MONTH'::date_precision_enum, '2024-03-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('contest_kenguru', (SELECT id FROM season_editions WHERE series_id = 'contest_kenguru' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Кенгуру', 'MONTH'::date_precision_enum, '2024-03-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('spec_finance_econ', (SELECT id FROM season_editions WHERE series_id = 'spec_finance_econ' AND season_label = '2024-2025' LIMIT 1), 'st_school', 'Школьный этап Олимпиады по экономике', 'MONTH'::date_precision_enum, '2024-04-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по физике и математике', 'MONTH'::date_precision_enum, '2024-04-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('spec_bastau', (SELECT id FROM season_editions WHERE series_id = 'spec_bastau' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Бастау', 'MONTH'::date_precision_enum, '2024-04-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_zerde', (SELECT id FROM season_editions WHERE series_id = 'proj_zerde' AND season_label = '2024-2025' LIMIT 1), 'st_zerde_district', '2-ой поток Зерде', 'MONTH'::date_precision_enum, '2024-04-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('calendar_only_kazakhstan_smart_space', (SELECT id FROM season_editions WHERE series_id = 'calendar_only_kazakhstan_smart_space' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'KazakhstanSmartSpace-2024', 'MONTH'::date_precision_enum, '2024-04-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_presidential', (SELECT id FROM season_editions WHERE series_id = 'rk_presidential' AND season_label = '2024-2025' LIMIT 1), 'st_pres_final', 'Заключительный этап Президентской олимпиады', 'MONTH'::date_precision_enum, '2024-05-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по информатике', 'MONTH'::date_precision_enum, '2024-05-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по химии, биологии и географии', 'MONTH'::date_precision_enum, '2024-05-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ijso', (SELECT id FROM season_editions WHERE series_id = 'intl_ijso' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IJSO', 'MONTH'::date_precision_enum, '2024-05-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_open_world_science', (SELECT id FROM season_editions WHERE series_id = 'proj_open_world_science' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Открываем мир науки', 'MONTH'::date_precision_enum, '2024-05-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_proeco', (SELECT id FROM season_editions WHERE series_id = 'proj_proeco' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'ProEco', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('spec_til_taue', (SELECT id FROM season_editions WHERE series_id = 'spec_til_taue' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Тил - тауесиздик тугыры', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_mendeleev', (SELECT id FROM season_editions WHERE series_id = 'intl_mendeleev' AND season_label = '2024-2025' LIMIT 1), 'st_international_final', 'Mendeleev - 2024', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_tuimaada', (SELECT id FROM season_editions WHERE series_id = 'intl_tuimaada' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап Tuimaada', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_icho', (SELECT id FROM season_editions WHERE series_id = 'intl_icho' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IChO', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('spec_finance_econ', (SELECT id FROM season_editions WHERE series_id = 'spec_finance_econ' AND season_label = '2024-2025' LIMIT 1), 'st_republic_final', 'Заключительный этап Олимпиады по экономике', 'MONTH'::date_precision_enum, '2024-06-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_apho', (SELECT id FROM season_editions WHERE series_id = 'intl_apho' AND season_label = '2024-2025' LIMIT 1), 'st_international_final', 'APhO-2024', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_icho', (SELECT id FROM season_editions WHERE series_id = 'intl_icho' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection_final', 'Заключительный этап IChO', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_iol', (SELECT id FROM season_editions WHERE series_id = 'intl_iol' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IOL', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_igeo', (SELECT id FROM season_editions WHERE series_id = 'intl_igeo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IGeO', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_imo', (SELECT id FROM season_editions WHERE series_id = 'intl_imo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IMO', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ibo', (SELECT id FROM season_editions WHERE series_id = 'intl_ibo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IBO', 'MONTH'::date_precision_enum, '2024-07-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('spec_myn_bala', (SELECT id FROM season_editions WHERE series_id = 'spec_myn_bala' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Мың бала', 'MONTH'::date_precision_enum, '2024-08-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_school', 'Республиканская олимпиада по общеобразовательным предметам', 'MONTH'::date_precision_enum, '2024-08-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_iao', (SELECT id FROM season_editions WHERE series_id = 'intl_iao' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IAO', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ipho', (SELECT id FROM season_editions WHERE series_id = 'intl_ipho' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IPhO', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ioi', (SELECT id FROM season_editions WHERE series_id = 'intl_ioi' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IOI', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_igeo', (SELECT id FROM season_editions WHERE series_id = 'intl_igeo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IGeO', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ejoi', (SELECT id FROM season_editions WHERE series_id = 'intl_ejoi' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап EJOI', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по праву', 'MONTH'::date_precision_enum, '2024-09-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('contest_bebras', (SELECT id FROM season_editions WHERE series_id = 'contest_bebras' AND season_label = '2024-2025' LIMIT 1), 'st_open_participation', 'Bebras', 'MONTH'::date_precision_enum, '2024-10-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_eupho', (SELECT id FROM season_editions WHERE series_id = 'intl_eupho' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап EuPho', 'MONTH'::date_precision_enum, '2024-10-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('intl_ieo', (SELECT id FROM season_editions WHERE series_id = 'intl_ieo' AND season_label = '2024-2025' LIMIT 1), 'st_intl_selection', 'Отборочный этап IEO', 'MONTH'::date_precision_enum, '2024-10-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('proj_zerde', (SELECT id FROM season_editions WHERE series_id = 'proj_zerde' AND season_label = '2024-2025' LIMIT 1), 'st_zerde_school', '1-ый поток Зерде', 'MONTH'::date_precision_enum, '2024-10-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по экономике', 'MONTH'::date_precision_enum, '2024-10-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по лингвистике', 'MONTH'::date_precision_enum, '2024-11-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;
INSERT INTO stage_instances (series_id, season_id, stage_template_id, label, date_precision, starts_on, ends_on, registration_deadline, format, source_ref, is_seed) VALUES ('rk_olymp_9_11', (SELECT id FROM season_editions WHERE series_id = 'rk_olymp_9_11' AND season_label = '2024-2025' LIMIT 1), 'st_region', 'РО по математике', 'MONTH'::date_precision_enum, '2024-11-01', NULL, NULL, 'offline'::stage_format_enum, 'calendar_2024_aeo_nis', TRUE) ON CONFLICT DO NOTHING;

-- Legacy compatibility: materialize competition_series into olympiads
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по математике', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_imo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по физике', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ipho') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по химии', (SELECT id FROM subjects WHERE code = 'chemistry' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_icho') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по биологии', (SELECT id FROM subjects WHERE code = 'biology' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ibo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по географии', (SELECT id FROM subjects WHERE code = 'geography' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_igeo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по информатике', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ioi') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по лингвистике', (SELECT id FROM subjects WHERE code = 'linguistics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_iol') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по астрономии и астрофизике', (SELECT id FROM subjects WHERE code = 'astronomy' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ioaa') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по астрономии', (SELECT id FROM subjects WHERE code = 'astronomy' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_iao') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по физике в области природных и технических наук', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ipo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по экономике', (SELECT id FROM subjects WHERE code = 'economics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ieo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Балканская математическая олимпиада', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_bmo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Юниорская Балканская математическая олимпиада', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_jbmo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Западно-Китайская математическая олимпиада', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_west_china_mo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная дистанционная Азиатско-Тихоокеанская математическая олимпиада', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_apmo_distance') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная математическая олимпиада ''Шелковый путь''', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_silk_road_mo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная О. Жаутыковская олимпиада (мат/физ/инф)', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_izho') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная естественно-научная олимпиада среди юниоров', (SELECT id FROM subjects WHERE code = 'science_integrated' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ijso') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная Менделеевская олимпиада по химии', (SELECT id FROM subjects WHERE code = 'chemistry' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_mendeleev') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по казахскому языку и литературе для детей казахской диаспоры', (SELECT id FROM subjects WHERE code = 'kazakh_language' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_kazakh_diaspora_langlit') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада школьников ''Туймаада''', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_tuimaada') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Азиатская олимпиада по физике', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_apho') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Лаборатория подготовки талантов'' (физика/химия/математика)', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_lab_talent_prep') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Европейская олимпиада по географии', (SELECT id FROM subjects WHERE code = 'geography' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_egeo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по биологии имени Авиценны', (SELECT id FROM subjects WHERE code = 'biology' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_abo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Европейская математическая олимпиада для девочек', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_egmo') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Европейская физическая олимпиада', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_eupho') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Центрально-Европейская олимпиада по информатике', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ceoi') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Европейская юниорская олимпиада по информатике', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_ejoi') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Евразийская олимпиада по информатике (ШОС)', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'intl_eurasian_io') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканская олимпиада для учащихся 2-4 классов', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'rk_olymp_2_4') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканская олимпиада для учащихся 5-6 классов', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'rk_olymp_5_6') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканская олимпиада для учащихся 7-8 классов', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'rk_olymp_7_8') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканская олимпиада для учащихся 9-11(12) классов', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'rk_olymp_9_11') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Президентская олимпиада (ест.-мат. цикл)', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'rk_presidential') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Национальная интеллектуальная олимпиада для сельских школ ''Мың бала''', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_myn_bala') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по казахскому языку и литературе им. К. Битибаевой', (SELECT id FROM subjects WHERE code = 'kazakh_language' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_bitibaeva') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Комплексная олимпиада ''Сардар'' (11 класс)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_sardar') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по химии им. К. Сатпаева (9 класс)', (SELECT id FROM subjects WHERE code = 'chemistry' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_satpayev_chem') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Математическая олимпиада ''Бастау'' (2-4 классы)', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_bastau') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по казахскому языку ''Жарқынболашақ'' (7-11)', (SELECT id FROM subjects WHERE code = 'kazakh_language' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_zharkynbolashak') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Профильная олимпиада по химии им. А. Бектурова', (SELECT id FROM subjects WHERE code = 'chemistry' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_bekturov_chem') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Тарихата'' (5-9)', (SELECT id FROM subjects WHERE code = 'history' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_tarihata') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по казахскому языку ''Тіл – тәуелсіздіктұғыры''', (SELECT id FROM subjects WHERE code = 'kazakh_language' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_til_taue') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по финансам и экономике (9–10(11))', (SELECT id FROM subjects WHERE code = 'finance' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_finance_econ') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по экологии (9-11(12))', (SELECT id FROM subjects WHERE code = 'ecology' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_ecology') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по казахскому языку и литературе ''Абайтану''', (SELECT id FROM subjects WHERE code = 'kazakh_language' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_abaitanу') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Қазақстанбілімолимпиадасы'' (в т.ч. НИШ)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_kazbilim') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по электронике и смарт-технологиям (7–11)', (SELECT id FROM subjects WHERE code = 'electronics_smart' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_electronics_smart') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''IQanat''', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_iqanat') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Youngchallenger'' (частные/международные школы)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_youngchallenger') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Интеллектуальная олимпиада ''Ақбота''', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'spec_akbota') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада ''Аль-Фараби'' (11 класс)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_alfarabi') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Предметная олимпиада КБТУ (10-12)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_kbtu') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''SPT'' (SDU)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_sdu_spt') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Абай сыйы'' (КазНПУ)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_abay_syi') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Yasaui'' (МКТУ)', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_yasaui') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Международная олимпиада по физике (Караганда, ун-т им. Е.А.Букетова)', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_buketov_physics') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Традиционная олимпиада по естествознанию (9-10)', (SELECT id FROM subjects WHERE code = 'science_integrated' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_kaznwpu_natsci') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Білім шыңы'' (физ/мат/инф)', (SELECT id FROM subjects WHERE code = 'physics' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_bilim_shyny') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада по общеобразовательным предметам ЕНУ', (SELECT id FROM subjects WHERE code = 'general_subjects' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_enu_general') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Олимпиада ''Туған ел. Туған жер. Туған глобал.''', (SELECT id FROM subjects WHERE code = 'history' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_tugan_el') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('AITUicode', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'university' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'uni_aitu_icode') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканский конкурс научных проектов (РКНП)', (SELECT id FROM subjects WHERE code = 'research_projects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'proj_rknp') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Республиканский конкурс научных проектов ''Зерде''', (SELECT id FROM subjects WHERE code = 'research_projects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'proj_zerde') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Конкурс ''Открываем мир науки''', (SELECT id FROM subjects WHERE code = 'research_projects' LIMIT 1), (SELECT id FROM levels WHERE code = 'republican' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'proj_open_world_science') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Конкурс экологических проектов ''ProEco''', (SELECT id FROM subjects WHERE code = 'ecology' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'proj_proeco') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Конкурс им. У. Джолдасбекова (мат/мех/инф)', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'international' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'proj_dzholdasbekov') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Игра-конкурс ''Bebras''', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'contest_bebras') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('Игра-конкурс ''Кенгуру''', (SELECT id FROM subjects WHERE code = 'math' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_adilet_v1100007355' LIMIT 1), '2024-2025', 'published'::entity_status, 'contest_kenguru') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('NIS Hackathon', (SELECT id FROM subjects WHERE code = 'informatics' LIMIT 1), (SELECT id FROM levels WHERE code = 'school_internal' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_calendar_2024_aeo_nis' LIMIT 1), '2024-2025', 'published'::entity_status, 'calendar_only_nis_hackathon') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;
INSERT INTO olympiads (title, subject_id, level_id, region_id, format, organizer, rules_url, season, status, series_id) VALUES ('KazakhstanSmartSpace', (SELECT id FROM subjects WHERE code = 'research_projects' LIMIT 1), (SELECT id FROM levels WHERE code = 'specialized' LIMIT 1), NULL, 'offline'::olympiad_format, NULL, (SELECT url FROM documents WHERE id = 'doc_calendar_2024_aeo_nis' LIMIT 1), '2024-2025', 'published'::entity_status, 'calendar_only_kazakhstan_smart_space') ON CONFLICT (series_id) DO UPDATE SET title = EXCLUDED.title, subject_id = EXCLUDED.subject_id, level_id = EXCLUDED.level_id, format = EXCLUDED.format, rules_url = EXCLUDED.rules_url, season = EXCLUDED.season, status = EXCLUDED.status;

-- Legacy compatibility: materialize stage_instances into stages
INSERT INTO stages (
  olympiad_id,
  name,
  date_start,
  date_end,
  registration_deadline,
  location,
  online_link,
  checklist_json,
  status,
  stage_instance_id,
  season_id,
  stage_template_id,
  date_precision,
  source_ref,
  is_seed
)
SELECT
  o.id AS olympiad_id,
  COALESCE(si.label, st.name_ru) AS name,
  si.starts_on AS date_start,
  si.ends_on AS date_end,
  COALESCE(si.registration_deadline, si.starts_on) AS registration_deadline,
  si.location_text,
  NULL AS online_link,
  jsonb_build_object(
    'documents_required', COALESCE((
      SELECT jsonb_agg(item->>'title_ru')
      FROM jsonb_array_elements(COALESCE(ct.items, '[]'::jsonb)) item
      WHERE item ? 'title_ru'
    ), '[]'::jsonb),
    'consent_required', COALESCE((
      SELECT bool_or(COALESCE((item->>'required')::boolean, FALSE))
      FROM jsonb_array_elements(COALESCE(ct.items, '[]'::jsonb)) item
      WHERE COALESCE(item->>'id','') ILIKE '%consent%'
    ), FALSE),
    'fee_amount', NULL,
    'platform_name', NULL,
    'platform_url', NULL
  ) AS checklist_json,
  'published'::entity_status,
  si.id AS stage_instance_id,
  si.season_id,
  si.stage_template_id,
  si.date_precision,
  si.source_ref,
  TRUE
FROM stage_instances si
JOIN competition_series cs ON cs.id = si.series_id
JOIN olympiads o ON o.series_id = cs.id
JOIN stage_templates st ON st.id = si.stage_template_id
LEFT JOIN checklist_templates ct ON ct.id = st.checklist_template_id
WHERE si.starts_on IS NOT NULL
ON CONFLICT (stage_instance_id) DO UPDATE SET
  olympiad_id = EXCLUDED.olympiad_id,
  name = EXCLUDED.name,
  date_start = EXCLUDED.date_start,
  date_end = EXCLUDED.date_end,
  registration_deadline = EXCLUDED.registration_deadline,
  location = EXCLUDED.location,
  checklist_json = EXCLUDED.checklist_json,
  status = EXCLUDED.status,
  season_id = EXCLUDED.season_id,
  stage_template_id = EXCLUDED.stage_template_id,
  date_precision = EXCLUDED.date_precision,
  source_ref = EXCLUDED.source_ref,
  is_seed = EXCLUDED.is_seed;

-- Backfill v2 tracking tables from legacy data (when available)
INSERT INTO student_stage_plans (student_user_id, stage_instance_id, status, planned_at, registered_at, external_registration_url, checklist_state, notes)
SELECT
  r.student_id,
  s.stage_instance_id,
  CASE r.status
    WHEN 'planned' THEN 'PLANNED'::student_stage_status_enum
    WHEN 'registered' THEN 'REGISTERED'::student_stage_status_enum
    WHEN 'participated' THEN 'PARTICIPATED'::student_stage_status_enum
    WHEN 'result_added' THEN 'RESULT_ENTERED'::student_stage_status_enum
    ELSE 'PLANNED'::student_stage_status_enum
  END,
  COALESCE(r.planned_at, r.created_at),
  COALESCE(r.registered_at, CASE WHEN r.status IN ('registered', 'participated', 'result_added') THEN r.updated_at ELSE NULL END),
  r.external_registration_url,
  COALESCE(r.checklist_state, '{}'::jsonb),
  r.notes
FROM registrations r
JOIN stages s ON s.id = r.stage_id
WHERE s.stage_instance_id IS NOT NULL
ON CONFLICT (student_user_id, stage_instance_id) DO UPDATE SET
  status = EXCLUDED.status,
  registered_at = EXCLUDED.registered_at,
  external_registration_url = EXCLUDED.external_registration_url,
  checklist_state = EXCLUDED.checklist_state,
  notes = EXCLUDED.notes;

INSERT INTO prep_logs (student_user_id, happened_on, minutes, log_type, note, resource_url, stage_instance_id, created_at)
SELECT
  pa.student_id,
  pa.date,
  pa.duration_minutes,
  CASE pa.type
    WHEN 'theory' THEN 'theory'::prep_log_type_enum
    WHEN 'problems' THEN 'problems'::prep_log_type_enum
    WHEN 'mock_exam' THEN 'mock'::prep_log_type_enum
    ELSE 'other'::prep_log_type_enum
  END,
  pa.topic,
  pa.materials_url,
  s.stage_instance_id,
  pa.created_at
FROM prep_activities pa
LEFT JOIN stages s ON s.id = pa.stage_id
ON CONFLICT DO NOTHING;

INSERT INTO stage_results (student_user_id, stage_instance_id, result_status, score, place_text, comment, created_at)
SELECT
  r.student_id,
  COALESCE(r.stage_instance_id, s.stage_instance_id),
  r.status,
  r.score,
  COALESCE(r.place_text, CASE WHEN r.place IS NULL THEN NULL ELSE r.place::text END),
  r.comment,
  r.created_at
FROM results r
LEFT JOIN stages s ON s.id = r.stage_id
WHERE COALESCE(r.stage_instance_id, s.stage_instance_id) IS NOT NULL
ON CONFLICT (student_user_id, stage_instance_id) DO UPDATE SET
  result_status = EXCLUDED.result_status,
  score = EXCLUDED.score,
  place_text = EXCLUDED.place_text,
  comment = EXCLUDED.comment;

INSERT INTO teacher_groups (teacher_user_id, name, subject_code, created_at)
SELECT
  g.teacher_id,
  g.name,
  s.code,
  g.created_at
FROM groups g
LEFT JOIN subjects s ON s.id = g.subject_id
ON CONFLICT DO NOTHING;

INSERT INTO group_members (group_id, student_user_id, joined_at)
SELECT
  tg.id,
  gs.student_id,
  now()
FROM group_students gs
JOIN groups g ON g.id = gs.group_id
JOIN teacher_groups tg
  ON tg.teacher_user_id = g.teacher_id
 AND tg.name = g.name
ON CONFLICT (group_id, student_user_id) DO NOTHING;

INSERT INTO teacher_comments_v2 (teacher_user_id, student_user_id, stage_instance_id, comment, created_at)
SELECT
  tc.teacher_id,
  tc.student_id,
  s.stage_instance_id,
  tc.text,
  tc.created_at
FROM teacher_comments tc
LEFT JOIN stages s ON s.id = tc.stage_id
ON CONFLICT DO NOTHING;

CREATE OR REPLACE VIEW v_student_activity_month AS
SELECT
  student_user_id,
  date_trunc('month', happened_on)::date AS month,
  sum(minutes) AS total_minutes,
  count(*) AS logs_count
FROM prep_logs
GROUP BY student_user_id, date_trunc('month', happened_on);

CREATE OR REPLACE VIEW v_student_scores_timeline AS
SELECT
  r.student_user_id,
  si.series_id,
  si.stage_template_id,
  si.starts_on,
  r.score,
  r.result_status
FROM stage_results r
JOIN stage_instances si ON si.id = r.stage_instance_id;
