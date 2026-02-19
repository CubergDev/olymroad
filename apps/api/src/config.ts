const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DOCKER;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DOCKER is required.");
}

const parsedTimezoneOffset = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES ?? 300);
const appTimezoneOffsetMinutes = Number.isFinite(parsedTimezoneOffset)
  ? parsedTimezoneOffset
  : 300;

const storagePresignTtlRaw = Number(process.env.STORAGE_PRESIGN_TTL_SECONDS ?? 900);
const storagePresignTtlSeconds =
  Number.isFinite(storagePresignTtlRaw) && storagePresignTtlRaw > 0
    ? Math.floor(storagePresignTtlRaw)
    : 900;

const corsOrigins = (
  process.env.CORS_ORIGINS ??
  "http://localhost:5173,http://127.0.0.1:5173,capacitor://localhost"
)
  .split(",")
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const parseCsv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const oauthGoogleClientIds = parseCsv(process.env.GOOGLE_OAUTH_CLIENT_IDS);

const webauthnRpId = (process.env.WEBAUTHN_RP_ID ?? "localhost").trim();
const webauthnRpName = (process.env.WEBAUTHN_RP_NAME ?? "OlymRoad").trim();
const webauthnOrigins = parseCsv(
  process.env.WEBAUTHN_ORIGINS ??
    "http://localhost:5173,http://127.0.0.1:5173,https://localhost:5173"
);
const webauthnChallengeTtlRaw = Number(process.env.WEBAUTHN_CHALLENGE_TTL_SECONDS ?? 300);
const webauthnChallengeTtlSeconds =
  Number.isFinite(webauthnChallengeTtlRaw) && webauthnChallengeTtlRaw > 0
    ? Math.floor(webauthnChallengeTtlRaw)
    : 300;

if (!webauthnRpId || !webauthnRpName || webauthnOrigins.length === 0) {
  throw new Error("WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, and WEBAUTHN_ORIGINS are required.");
}

const minioEndpoint = process.env.MINIO_ENDPOINT ?? "http://localhost:9000";
const minioAccessKey =
  process.env.MINIO_ACCESS_KEY ?? process.env.MINIO_ROOT_USER ?? "";
const minioSecretKey =
  process.env.MINIO_SECRET_KEY ?? process.env.MINIO_ROOT_PASSWORD ?? "";
const minioBucket = process.env.MINIO_BUCKET ?? "olymroad-dev";

if (!minioEndpoint || !minioAccessKey || !minioSecretKey || !minioBucket) {
  throw new Error(
    "MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, and MINIO_BUCKET are required."
  );
}

const resendApiKey = (process.env.RESEND_API_KEY ?? "").trim();
const resendFromEmail = (process.env.RESEND_FROM_EMAIL ?? "").trim() || "onboarding@resend.dev";
const emailOtpTtlRaw = Number(process.env.EMAIL_OTP_TTL_SECONDS ?? 600);
const emailOtpTtlSeconds =
  Number.isFinite(emailOtpTtlRaw) && emailOtpTtlRaw > 0
    ? Math.floor(emailOtpTtlRaw)
    : 600;
const emailOtpMaxAttemptsRaw = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS ?? 5);
const emailOtpMaxAttempts =
  Number.isFinite(emailOtpMaxAttemptsRaw) && emailOtpMaxAttemptsRaw > 0
    ? Math.floor(emailOtpMaxAttemptsRaw)
    : 5;
const openaiApiKey = (process.env.OPENAI_API_KEY ?? "").trim();
const openaiApiBaseUrl = (process.env.OPENAI_API_BASE_URL ?? "https://api.openai.com/v1")
  .trim()
  .replace(/\/+$/, "");
const openaiModelFast = (process.env.OPENAI_MODEL_FAST ?? "gpt-5.2-mini").trim();

export const CONFIG = {
  databaseUrl,
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? "olymroad-dev-auth-secret",
  authTokenTtlSeconds: Number(
    process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7
  ),
  oauth: {
    googleClientIds: oauthGoogleClientIds,
  },
  webauthn: {
    rpId: webauthnRpId,
    rpName: webauthnRpName,
    origins: webauthnOrigins,
    challengeTtlSeconds: webauthnChallengeTtlSeconds,
  },
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Almaty",
  appTimezoneOffsetMinutes,
  port: Number(process.env.PORT ?? 3000),
  storage: {
    provider: "minio" as const,
    bucket: minioBucket,
    endpoint: minioEndpoint,
    accessKeyId: minioAccessKey,
    secretAccessKey: minioSecretKey,
    presignTtlSeconds: storagePresignTtlSeconds,
  },
  email: {
    provider: "resend" as const,
    resendApiKey,
    resendFromEmail,
    otpTtlSeconds: emailOtpTtlSeconds,
    otpMaxAttempts: emailOtpMaxAttempts,
  },
  ai: {
    openaiApiKey,
    openaiApiBaseUrl,
    openaiModelFast,
    enabled: openaiApiKey.length > 0,
  },
  cors: {
    origins: corsOrigins,
  },
};
