CREATE TABLE calendar_integrations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google')),
    provider_account_id TEXT NOT NULL,
    provider_email CITEXT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NULL,
    token_expires_at TIMESTAMPTZ NULL,
    scope TEXT NULL,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    last_sync_at TIMESTAMPTZ NULL,
    last_sync_direction TEXT NULL CHECK (last_sync_direction IN ('import', 'export', 'both')),
    last_sync_status TEXT NULL CHECK (last_sync_status IN ('ok', 'failed')),
    last_sync_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider),
    UNIQUE (provider, provider_account_id)
);

CREATE TABLE calendar_sync_events (
    id BIGSERIAL PRIMARY KEY,
    integration_id BIGINT NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    stage_id BIGINT NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
    google_calendar_id TEXT NOT NULL DEFAULT 'primary',
    google_event_id TEXT NOT NULL,
    synced_hash TEXT NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, stage_id),
    UNIQUE (integration_id, google_calendar_id, google_event_id)
);

CREATE TABLE calendar_import_events (
    id BIGSERIAL PRIMARY KEY,
    integration_id BIGINT NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    provider_event_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    summary TEXT NULL,
    description TEXT NULL,
    location TEXT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NULL,
    all_day BOOLEAN NOT NULL DEFAULT FALSE,
    html_link TEXT NULL,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, calendar_id, provider_event_id)
);

CREATE TRIGGER trg_calendar_integrations_updated_at
BEFORE UPDATE ON calendar_integrations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_calendar_import_events_updated_at
BEFORE UPDATE ON calendar_import_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_calendar_integrations_user_provider
ON calendar_integrations (user_id, provider);

CREATE INDEX idx_calendar_integrations_last_sync
ON calendar_integrations (last_sync_at DESC);

CREATE INDEX idx_calendar_sync_events_integration_synced
ON calendar_sync_events (integration_id, synced_at DESC);

CREATE INDEX idx_calendar_import_events_integration_starts
ON calendar_import_events (integration_id, starts_at DESC);
