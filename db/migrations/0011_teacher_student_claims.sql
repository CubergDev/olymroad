CREATE TABLE IF NOT EXISTS teacher_student_claims (
  student_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  teacher_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_teacher_student_claims_updated_at'
  ) THEN
    CREATE TRIGGER trg_teacher_student_claims_updated_at
    BEFORE UPDATE ON teacher_student_claims
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_teacher_student_claims_teacher_student
  ON teacher_student_claims(teacher_id, student_id);
