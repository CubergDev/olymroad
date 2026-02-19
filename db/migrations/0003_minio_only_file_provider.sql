DO $$
DECLARE
  has_s3_label boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'file_provider'
      AND e.enumlabel = 's3'
  ) INTO has_s3_label;

  IF has_s3_label THEN
    ALTER TYPE file_provider RENAME TO file_provider_old;
    CREATE TYPE file_provider AS ENUM ('minio');

    ALTER TABLE file_objects
      ALTER COLUMN provider TYPE file_provider
      USING (CASE WHEN provider::text = 'minio' THEN 'minio' ELSE 'minio' END)::file_provider;

    DROP TYPE file_provider_old;
  END IF;
END
$$;
