# OAuth + Passkey setup guide (Google + WebAuthn)

Last verified against official docs: **February 18, 2026**.

This repo currently uses:

1. `POST /auth/oauth/google` with `id_token`
2. `POST /me/security/oauth/google/link` with `id_token`
3. Passkeys via WebAuthn (`@simplewebauthn/server` + `@simplewebauthn/browser`)

## 1) Google OAuth app (free)

Official docs:

1. https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
2. https://developers.google.com/identity/gsi/web/guides/verify-google-id-token

Steps:

1. Open Google Cloud Console and create/select a project.
2. Configure OAuth consent screen (Google Auth Platform -> Branding).
3. Create OAuth client with type **Web application**.
4. Add JavaScript origins:
   1. `http://localhost`
   2. `http://localhost:5173`
   3. your production origin (example: `https://app.example.com`)
5. Copy the **Client ID**.

Project env values:

```env
# API accepts one or more Google client IDs
GOOGLE_OAUTH_CLIENT_IDS=your_google_client_id.apps.googleusercontent.com

# Web app uses this client ID for popup flow
PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

## 2) Passkeys (WebAuthn) setup

Official docs:

1. SimpleWebAuthn server package docs: https://simplewebauthn.dev/docs/packages/server
2. SimpleWebAuthn passkeys advanced notes: https://simplewebauthn.dev/docs/advanced/passkeys
3. WebAuthn API reference (MDN): https://developer.mozilla.org/en-US/docs/Web/API/Web_Authentication_API

Steps:

1. Set RP values and allowed origins in API env:

```env
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=OlymRoad
WEBAUTHN_ORIGINS=http://localhost:5173
WEBAUTHN_CHALLENGE_TTL_SECONDS=300
```

2. For production:
   1. set `WEBAUTHN_RP_ID` to your registrable domain (example: `example.com`)
   2. set `WEBAUTHN_ORIGINS` to exact HTTPS app origins (example: `https://app.example.com`)
3. Keep challenges server-side and short-lived.
4. During verification, enforce:
   1. `expectedOrigin`
   2. `expectedRPID`
   3. stored `expectedChallenge`
5. Serve production over HTTPS (localhost is the only practical local exception).

## 3) End-to-end quick smoke test

1. Restart API + web app after env changes.
2. Google:
   1. click Google sign-in
   2. confirm API returns app `token` and `user`
3. Security tab:
   1. link/unlink Google
   2. change password with current password
   3. add/remove a passkey
4. Login screen:
   1. test passkey login path
   2. verify Google login still works

## 4) Cost

Google OAuth app registration is free. You only pay if you use paid cloud/API products beyond auth.
