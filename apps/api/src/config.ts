const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DOCKER;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DOCKER is required.");
}

const parsedTimezoneOffset = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES ?? 300);
const appTimezoneOffsetMinutes = Number.isFinite(parsedTimezoneOffset)
  ? parsedTimezoneOffset
  : 300;

export const CONFIG = {
  databaseUrl,
  authTokenSecret: process.env.AUTH_TOKEN_SECRET ?? "olymroad-dev-auth-secret",
  authTokenTtlSeconds: Number(
    process.env.AUTH_TOKEN_TTL_SECONDS ?? 60 * 60 * 24 * 7
  ),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Almaty",
  appTimezoneOffsetMinutes,
  port: Number(process.env.PORT ?? 3000),
};
