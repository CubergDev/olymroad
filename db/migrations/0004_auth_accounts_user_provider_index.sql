CREATE INDEX IF NOT EXISTS idx_auth_accounts_user_provider
ON auth_accounts (user_id, provider);
