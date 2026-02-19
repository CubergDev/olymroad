# @olymroad/api

API service built with Elysia + Bun.

## Run

```bash
bun run --filter @olymroad/api dev
```

The API loads configuration from root `.env`.

## Storage Configuration (MinIO only)

Storage endpoints (`/storage/upload-intent`, `/storage/objects/:id/download-url`) use MinIO.

Required env keys:

1. `MINIO_ENDPOINT`
2. `MINIO_BUCKET`
3. `MINIO_ACCESS_KEY`
4. `MINIO_SECRET_KEY`

Optional:

1. `STORAGE_PRESIGN_TTL_SECONDS` (default `900`)

## OAuth Configuration

OAuth endpoints:

1. `POST /auth/oauth/google`
2. `POST /me/security/oauth/google/link`
3. `DELETE /me/security/oauth/:provider`

Payload notes:

1. Google endpoint expects `id_token`

Required env keys:

1. `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated client IDs)

## Account Security + Passkeys

Security endpoints:

1. `GET /me/security`
2. `POST /me/security/password/change`
3. `POST /me/security/passkeys/register/options`
4. `POST /me/security/passkeys/register/verify`
5. `DELETE /me/security/passkeys/:id`
6. `POST /auth/passkeys/authenticate/options`
7. `POST /auth/passkeys/authenticate/verify`

Required env keys:

1. `WEBAUTHN_RP_ID`
2. `WEBAUTHN_RP_NAME`
3. `WEBAUTHN_ORIGINS` (comma-separated allowed origins)

Optional env keys:

1. `WEBAUTHN_CHALLENGE_TTL_SECONDS` (default `300`)
