ALTER TABLE auth_accounts
DROP CONSTRAINT IF EXISTS auth_accounts_provider_check;

ALTER TABLE auth_accounts
ADD CONSTRAINT auth_accounts_provider_check CHECK (provider IN ('google', 'microsoft'));

CREATE TABLE auth_passkey_challenges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
    flow TEXT NOT NULL CHECK (flow IN ('register', 'authenticate')),
    challenge TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (flow, challenge)
);

CREATE TABLE auth_passkeys (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    credential_public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0 CHECK (counter >= 0),
    transports TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    device_type TEXT NULL,
    backed_up BOOLEAN NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_auth_passkey_challenges_user_flow_expires
ON auth_passkey_challenges (user_id, flow, expires_at DESC);

CREATE INDEX idx_auth_passkey_challenges_expires
ON auth_passkey_challenges (expires_at);

CREATE INDEX idx_auth_passkeys_user_created
ON auth_passkeys (user_id, created_at DESC);
