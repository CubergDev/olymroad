ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_locale_check;

ALTER TABLE users
ADD CONSTRAINT users_locale_check
CHECK (locale IN ('en', 'ru', 'kz'));
