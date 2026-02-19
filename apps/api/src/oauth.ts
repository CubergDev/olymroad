import { CONFIG } from "./config";

type RecordValue = Record<string, unknown>;

export type OAuthIdentity = {
  providerAccountId: string;
  email: string;
  name: string | null;
};

const JWT_CLOCK_SKEW_SECONDS = 60;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (source: RecordValue, key: string): string | null => {
  const value = source[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readNumber = (source: RecordValue, key: string): number | null => {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeIdentity = (identity: OAuthIdentity): OAuthIdentity => ({
  providerAccountId: identity.providerAccountId,
  email: identity.email.trim().toLowerCase(),
  name: identity.name?.trim() ?? null,
});

export const isGoogleOAuthConfigured = (): boolean =>
  CONFIG.oauth.googleClientIds.length > 0;

export const verifyGoogleIdToken = async (
  idToken: string
): Promise<OAuthIdentity | null> => {
  try {
    const tokenInfoUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
    tokenInfoUrl.searchParams.set("id_token", idToken);
    const response = await fetch(tokenInfoUrl);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!isRecord(payload)) {
      return null;
    }

    const audience = readString(payload, "aud");
    const issuer = readString(payload, "iss");
    const providerAccountId = readString(payload, "sub");
    const email = readString(payload, "email");
    const name = readString(payload, "name");
    const exp = readNumber(payload, "exp");
    const emailVerifiedRaw = payload.email_verified;
    const emailVerified =
      emailVerifiedRaw === true || emailVerifiedRaw === "true" || emailVerifiedRaw === "1";

    if (!audience || !CONFIG.oauth.googleClientIds.includes(audience)) {
      return null;
    }
    if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
      return null;
    }
    if (!providerAccountId || !email || !emailVerified) {
      return null;
    }
    if (!exp || exp <= Math.floor(Date.now() / 1000) - JWT_CLOCK_SKEW_SECONDS) {
      return null;
    }

    return normalizeIdentity({
      providerAccountId,
      email,
      name,
    });
  } catch {
    return null;
  }
};
