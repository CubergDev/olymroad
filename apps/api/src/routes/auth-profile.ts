import type { Elysia } from "elysia";
import { issueToken, requireRole, requireUser, toPublicUser } from "../auth";
import { dbErrorCode, first, sql } from "../db";
import { fail, failForDbError } from "../http";
import { CONFIG } from "../config";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  isEmailServiceConfigured,
  sendPasswordResetOtpEmail,
  sendRegistrationOtpEmail,
} from "../email";
import { isGoogleOAuthConfigured, verifyGoogleIdToken } from "../oauth";
import {
  getInteger,
  getNullableString,
  getString,
  isLocale,
  isRecord,
  SUPPORTED_LOCALES,
  isUserRole,
} from "../validation";
import type { AuthProvider, UserRow } from "../types";

const LOCALE_VALIDATION_MESSAGE = `Locale must be one of: ${SUPPORTED_LOCALES.join(", ")}.`;
const OAUTH_ROLE_VALIDATION_MESSAGE = "Role must be student or teacher.";
const PASSKEY_CHALLENGE_REGISTER = "register";
const PASSKEY_CHALLENGE_AUTHENTICATE = "authenticate";
const EMAIL_OTP_PURPOSE_VERIFY = "verify_email";
const EMAIL_OTP_PURPOSE_RESET = "reset_password";
const EMAIL_OTP_PURPOSE_CHANGE = "change_email";
const EMAIL_OTP_LENGTH = 6;
const PASSKEY_DELETE_LOCKOUT_MESSAGE =
  "Cannot remove this passkey because no other sign-in method would remain.";
const OAUTH_UNLINK_LOCKOUT_MESSAGE =
  "Cannot unlink this OAuth provider because no other sign-in method would remain.";

const OAUTH_PROVIDERS: AuthProvider[] = ["google"];

type OAuthIdentityInput = {
  providerAccountId: string;
  email: string;
  name: string | null;
};

type OAuthUpsertInput = {
  provider: AuthProvider;
  identity: OAuthIdentityInput;
  role: "student" | "teacher";
  school: string | null | undefined;
  grade: number | null;
  gradeProvided: boolean;
  locale: string;
  fallbackName: string | null;
};

type AuthAccountRow = {
  provider: AuthProvider;
  provider_account_id: string;
  created_at: string;
};

type PasskeyRow = {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: unknown;
  counter: number | string;
  transports: unknown;
  device_type: string | null;
  backed_up: boolean | null;
  created_at: string;
  last_used_at: string | null;
};

type PasskeyChallengeRow = {
  id: number;
  user_id: number | null;
  challenge: string;
};

type EmailOtpPurpose =
  | typeof EMAIL_OTP_PURPOSE_VERIFY
  | typeof EMAIL_OTP_PURPOSE_RESET
  | typeof EMAIL_OTP_PURPOSE_CHANGE;

type EmailOtpRow = {
  id: number;
  user_id: number;
  otp_code: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
};

const isAuthProvider = (value: string): value is AuthProvider =>
  OAUTH_PROVIDERS.includes(value as AuthProvider);

const getOAuthTokenFieldName = (_provider: AuthProvider): "id_token" => "id_token";

const isOAuthProviderConfigured = (_provider: AuthProvider): boolean =>
  isGoogleOAuthConfigured();

const verifyOAuthIdentity = async (
  _provider: AuthProvider,
  token: string
): Promise<OAuthIdentityInput | null> => {
  const identity = await verifyGoogleIdToken(token);
  if (!identity) {
    return null;
  }
  return {
    providerAccountId: identity.providerAccountId,
    email: identity.email,
    name: identity.name,
  };
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const normalizeTransportList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
};

const toPgTextArrayLiteral = (values: string[]): string => {
  if (values.length === 0) {
    return "{}";
  }

  const escaped = values.map((value) =>
    `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
  );
  return `{${escaped.join(",")}}`;
};

const parseHexBytes = (hex: string): Uint8Array | null => {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);
    if (!Number.isFinite(byte)) {
      return null;
    }
    bytes[index / 2] = byte;
  }
  return bytes;
};

const toUint8Array = (value: unknown): Uint8Array | null => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return new Uint8Array(value);
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === "number")) {
    return Uint8Array.from(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("\\x")) {
      return parseHexBytes(trimmed.slice(2));
    }
  }
  return null;
};

const extractCredentialId = (response: unknown): string | null => {
  if (!isRecord(response)) {
    return null;
  }
  return getString(response.id) ?? getString(response.rawId);
};

const extractClientDataChallenge = (response: unknown): string | null => {
  if (!isRecord(response)) {
    return null;
  }
  const responsePayload = response.response;
  if (!isRecord(responsePayload)) {
    return null;
  }
  const clientDataJsonBase64Url = getString(responsePayload.clientDataJSON);
  if (!clientDataJsonBase64Url) {
    return null;
  }

  try {
    const clientDataJson = Buffer.from(clientDataJsonBase64Url, "base64url").toString("utf8");
    const parsed = JSON.parse(clientDataJson);
    if (!isRecord(parsed)) {
      return null;
    }
    return getString(parsed.challenge);
  } catch {
    return null;
  }
};

const canRemoveAuthMethod = async (
  userId: number,
  options: { providerToRemove?: AuthProvider; passkeyIdToRemove?: number } = {}
): Promise<boolean> => {
  const rows = await sql`
    SELECT
      (u.password_hash IS NOT NULL) AS has_password,
      EXISTS (
        SELECT 1
        FROM auth_passkeys ap
        WHERE ap.user_id = u.id
          AND (
            ${options.passkeyIdToRemove ?? null}::bigint IS NULL
            OR ap.id <> ${options.passkeyIdToRemove ?? null}
          )
      ) AS has_passkey,
      EXISTS (
        SELECT 1
        FROM auth_accounts aa
        WHERE aa.user_id = u.id
          AND (
            ${options.providerToRemove ?? null}::text IS NULL
            OR aa.provider <> ${options.providerToRemove ?? null}
          )
      ) AS has_oauth
    FROM users u
    WHERE u.id = ${userId}
    LIMIT 1
  `;
  const state = first<Record<string, unknown>>(rows);
  if (!state) {
    return false;
  }
  return state.has_password === true || state.has_passkey === true || state.has_oauth === true;
};

const deriveNameFromEmail = (email: string): string => {
  const [localPart] = email.split("@");
  const normalized = localPart?.trim();
  return normalized && normalized.length > 0 ? normalized : "User";
};

const generateNumericOtp = (): string => {
  const min = 10 ** (EMAIL_OTP_LENGTH - 1);
  const max = 10 ** EMAIL_OTP_LENGTH - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
};

const createEmailOtp = async (
  transaction: typeof sql,
  input: {
    userId: number;
    email: string;
    purpose: EmailOtpPurpose;
  }
): Promise<string> => {
  const otpCode = generateNumericOtp();
  await transaction`
    INSERT INTO auth_email_otps (
      user_id,
      email,
      purpose,
      otp_code,
      max_attempts,
      expires_at
    )
    VALUES (
      ${input.userId},
      ${input.email},
      ${input.purpose},
      ${otpCode},
      ${CONFIG.email.otpMaxAttempts},
      now() + ${CONFIG.email.otpTtlSeconds} * INTERVAL '1 second'
    )
  `;
  return otpCode;
};

const consumeEmailOtp = async (
  purpose: EmailOtpPurpose,
  email: string,
  otpCode: string
): Promise<
  | { ok: true; userId: number }
  | { ok: false; code: "invalid_otp" | "otp_expired" | "otp_attempts_exceeded" }
> =>
  sql.begin(async (transaction) => {
    const rows = await transaction`
      SELECT id, user_id, otp_code, attempts, max_attempts, expires_at
      FROM auth_email_otps
      WHERE email = ${email}
        AND purpose = ${purpose}
        AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;
    const row = first<EmailOtpRow>(rows);
    if (!row) {
      return { ok: false, code: "invalid_otp" };
    }

    const expiresAt = new Date(row.expires_at).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      await transaction`
        UPDATE auth_email_otps
        SET consumed_at = now()
        WHERE id = ${row.id}
      `;
      return { ok: false, code: "otp_expired" };
    }

    if (row.attempts >= row.max_attempts) {
      await transaction`
        UPDATE auth_email_otps
        SET consumed_at = now()
        WHERE id = ${row.id}
      `;
      return { ok: false, code: "otp_attempts_exceeded" };
    }

    if (row.otp_code !== otpCode) {
      const nextAttempts = row.attempts + 1;
      await transaction`
        UPDATE auth_email_otps
        SET
          attempts = ${nextAttempts},
          consumed_at = CASE
            WHEN ${nextAttempts} >= max_attempts THEN now()
            ELSE consumed_at
          END
        WHERE id = ${row.id}
      `;
      return {
        ok: false,
        code: nextAttempts >= row.max_attempts ? "otp_attempts_exceeded" : "invalid_otp",
      };
    }

    await transaction`
      UPDATE auth_email_otps
      SET consumed_at = now()
      WHERE id = ${row.id}
    `;
    return { ok: true, userId: row.user_id };
  });

const upsertOAuthUser = async (input: OAuthUpsertInput): Promise<UserRow> =>
  sql.begin(async (transaction) => {
    const linkedRows = await transaction`
      SELECT u.id, u.name, u.email, u.password_hash, u.role, u.school, u.grade, u.locale, u.is_active, u.created_at, u.updated_at
      FROM auth_accounts aa
      JOIN users u ON u.id = aa.user_id
      WHERE aa.provider = ${input.provider}
        AND aa.provider_account_id = ${input.identity.providerAccountId}
      LIMIT 1
    `;
    let user = first<UserRow>(linkedRows);
    if (user) {
      return user;
    }

    const normalizedEmail = input.identity.email.toLowerCase();
    const resolvedName =
      input.identity.name?.trim() || input.fallbackName?.trim() || deriveNameFromEmail(normalizedEmail);

    const existingRows = await transaction`
      SELECT id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
      FROM users
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    user = first<UserRow>(existingRows);

    if (!user) {
      const createdRows = await transaction`
        INSERT INTO users (name, email, password_hash, role, school, grade, locale, is_email_verified)
        VALUES (
          ${resolvedName},
          ${normalizedEmail},
          null,
          ${input.role},
          ${input.school ?? null},
          ${input.gradeProvided ? input.grade : null},
          ${input.locale},
          TRUE
        )
        RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
      `;
      user = first<UserRow>(createdRows);
      if (!user) {
        throw new Error("OAuth user creation failed.");
      }

      if (input.role === "student") {
        await transaction`
          INSERT INTO student_profiles (user_id)
          VALUES (${user.id})
          ON CONFLICT (user_id) DO NOTHING
        `;
      } else {
        await transaction`
          INSERT INTO teacher_profiles (user_id)
          VALUES (${user.id})
          ON CONFLICT (user_id) DO NOTHING
        `;
      }
    }

    await transaction`
      UPDATE users
      SET is_email_verified = TRUE
      WHERE id = ${user.id}
    `;

    if (user.is_active) {
      await transaction`
        INSERT INTO auth_accounts (user_id, provider, provider_account_id)
        VALUES (${user.id}, ${input.provider}, ${input.identity.providerAccountId})
        ON CONFLICT (provider, provider_account_id) DO NOTHING
      `;
    }

    return user;
  });

export const registerAuthProfileRoutes = (app: Elysia) => {
  app.post("/auth/register", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const name = getString(body.name);
    const email = getString(body.email)?.toLowerCase();
    const password = getString(body.password);
    const requestedRoleRaw = getString(body.role);
    const requestedRole = requestedRoleRaw ?? "student";
    const school = getNullableString(body.school);
    const grade = body.grade === null ? null : getInteger(body.grade);
    const localeRaw = getNullableString(body.locale);
    const locale = localeRaw ?? "ru";

    if (!name || !email || !password) {
      return fail(set, 400, "validation_error", "Name, email, and password are required.");
    }
    if (password.length < 8) {
      return fail(set, 400, "validation_error", "Password must be at least 8 characters.");
    }
    if (!isUserRole(requestedRole) || requestedRole === "admin") {
      return fail(set, 400, "validation_error", "Role must be student or teacher.");
    }
    if (!isLocale(locale)) {
      return fail(set, 400, "validation_error", LOCALE_VALIDATION_MESSAGE);
    }
    if (typeof body.grade !== "undefined" && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "Grade must be an integer.");
    }
    if (!isEmailServiceConfigured()) {
      return fail(
        set,
        503,
        "email_service_not_configured",
        "Email service is not configured on this server."
      );
    }

    try {
      const passwordHash = await Bun.password.hash(password);
      const created = await sql.begin(async (transaction) => {
        const rows = await transaction`
          INSERT INTO users (name, email, password_hash, role, school, grade, locale, is_email_verified)
          VALUES (
            ${name},
            ${email},
            ${passwordHash},
            ${requestedRole},
            ${typeof school === "undefined" ? null : school},
            ${typeof body.grade === "undefined" ? null : grade},
            ${locale},
            FALSE
          )
          RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        `;
        const user = first<UserRow>(rows);
        if (!user) {
          throw new Error("User creation failed.");
        }

        if (requestedRole === "student") {
          await transaction`
            INSERT INTO student_profiles (user_id)
            VALUES (${user.id})
            ON CONFLICT (user_id) DO NOTHING
          `;
        } else if (requestedRole === "teacher") {
          await transaction`
            INSERT INTO teacher_profiles (user_id)
            VALUES (${user.id})
            ON CONFLICT (user_id) DO NOTHING
          `;
        }

        const otpCode = await createEmailOtp(transaction, {
          userId: user.id,
          email,
          purpose: EMAIL_OTP_PURPOSE_VERIFY,
        });

        return { user, otpCode };
      });

      await sendRegistrationOtpEmail({
        email,
        otpCode: created.otpCode,
      });

      return {
        pending_verification: true,
        email,
        expires_in_seconds: CONFIG.email.otpTtlSeconds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "email_service_not_configured") {
        return fail(
          set,
          503,
          "email_service_not_configured",
          "Email service is not configured on this server."
        );
      }
      if (message === "email_send_failed") {
        return fail(set, 502, "email_send_failed", "Failed to send verification email.");
      }
      if (dbErrorCode(error) === "23505") {
        return fail(set, 409, "email_taken", "Email is already registered.");
      }
      return failForDbError(set, error, "register_failed", "Failed to register user.");
    }
  });

  app.post("/auth/login", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }
    const email = getString(body.email)?.toLowerCase();
    const password = getString(body.password);

    if (!email || !password) {
      return fail(set, 400, "validation_error", "Email and password are required.");
    }

    try {
      type UserLoginRow = UserRow & { is_email_verified: boolean };
      const rows = await sql`
        SELECT id, name, email, password_hash, role, school, grade, locale, is_active, is_email_verified, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const user = first<UserLoginRow>(rows);
      if (!user || !user.password_hash) {
        return fail(set, 401, "invalid_credentials", "Invalid credentials.");
      }
      if (!user.is_active) {
        return fail(set, 403, "account_disabled", "Account is disabled.");
      }
      if (!user.is_email_verified) {
        return fail(
          set,
          403,
          "email_not_verified",
          "Email is not verified. Complete OTP verification first."
        );
      }

      const passwordValid = await Bun.password.verify(password, user.password_hash);
      if (!passwordValid) {
        return fail(set, 401, "invalid_credentials", "Invalid credentials.");
      }

      return {
        token: issueToken(user.id),
        user: toPublicUser(user),
      };
    } catch (error) {
      return failForDbError(set, error, "login_failed", "Failed to login.");
    }
  });

  app.post("/auth/email/verify", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const email = getString(body.email)?.toLowerCase();
    const otpCodeRaw = getString(body.otp);
    const otpCode = otpCodeRaw?.trim() ?? "";

    if (!email || !otpCode) {
      return fail(set, 400, "validation_error", "email and otp are required.");
    }
    if (!new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(otpCode)) {
      return fail(set, 400, "validation_error", `otp must be ${EMAIL_OTP_LENGTH} digits.`);
    }

    const consumed = await consumeEmailOtp(EMAIL_OTP_PURPOSE_VERIFY, email, otpCode);
    if (!consumed.ok) {
      if (consumed.code === "otp_expired") {
        return fail(set, 400, "otp_expired", "OTP code has expired.");
      }
      if (consumed.code === "otp_attempts_exceeded") {
        return fail(set, 400, "otp_attempts_exceeded", "Maximum OTP attempts exceeded.");
      }
      return fail(set, 400, "invalid_otp", "OTP code is invalid.");
    }

    try {
      type UserVerificationRow = UserRow & { is_email_verified: boolean };
      const rows = await sql`
        UPDATE users
        SET is_email_verified = TRUE
        WHERE id = ${consumed.userId}
          AND email = ${email}
        RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, is_email_verified, created_at, updated_at
      `;
      const user = first<UserVerificationRow>(rows);
      if (!user) {
        return fail(set, 400, "invalid_otp", "OTP code is invalid.");
      }
      if (!user.is_active) {
        return fail(set, 403, "account_disabled", "Account is disabled.");
      }

      return {
        token: issueToken(user.id),
        user: toPublicUser(user),
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "email_verification_failed",
        "Failed to verify email address."
      );
    }
  });

  app.post("/auth/email/resend", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const email = getString(body.email)?.toLowerCase();
    if (!email) {
      return fail(set, 400, "validation_error", "email is required.");
    }
    if (!isEmailServiceConfigured()) {
      return fail(
        set,
        503,
        "email_service_not_configured",
        "Email service is not configured on this server."
      );
    }

    try {
      type UserResendRow = UserRow & { is_email_verified: boolean };
      const rows = await sql`
        SELECT id, name, email, password_hash, role, school, grade, locale, is_active, is_email_verified, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const user = first<UserResendRow>(rows);
      if (!user || !user.is_active || user.is_email_verified || !user.password_hash) {
        return { sent: true };
      }

      const otpCode = await createEmailOtp(sql, {
        userId: user.id,
        email,
        purpose: EMAIL_OTP_PURPOSE_VERIFY,
      });
      await sendRegistrationOtpEmail({
        email,
        otpCode,
      });

      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "email_send_failed") {
        return fail(set, 502, "email_send_failed", "Failed to send verification email.");
      }
      return failForDbError(set, error, "email_resend_failed", "Failed to resend verification OTP.");
    }
  });

  app.post("/auth/password/forgot", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const email = getString(body.email)?.toLowerCase();
    if (!email) {
      return fail(set, 400, "validation_error", "email is required.");
    }
    if (!isEmailServiceConfigured()) {
      return fail(
        set,
        503,
        "email_service_not_configured",
        "Email service is not configured on this server."
      );
    }

    try {
      type ForgotUserRow = UserRow & { is_email_verified: boolean };
      const rows = await sql`
        SELECT id, name, email, password_hash, role, school, grade, locale, is_active, is_email_verified, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const user = first<ForgotUserRow>(rows);
      if (!user || !user.is_active || !user.password_hash) {
        return { sent: true };
      }

      const otpCode = await createEmailOtp(sql, {
        userId: user.id,
        email,
        purpose: EMAIL_OTP_PURPOSE_RESET,
      });
      await sendPasswordResetOtpEmail({
        email,
        otpCode,
      });

      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "email_send_failed") {
        return fail(set, 502, "email_send_failed", "Failed to send password reset email.");
      }
      return failForDbError(
        set,
        error,
        "forgot_password_failed",
        "Failed to start password reset."
      );
    }
  });

  app.post("/auth/password/reset", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const email = getString(body.email)?.toLowerCase();
    const otpCodeRaw = getString(body.otp);
    const otpCode = otpCodeRaw?.trim() ?? "";
    const newPassword = getString(body.new_password);

    if (!email || !otpCode || !newPassword) {
      return fail(set, 400, "validation_error", "email, otp, and new_password are required.");
    }
    if (!new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(otpCode)) {
      return fail(set, 400, "validation_error", `otp must be ${EMAIL_OTP_LENGTH} digits.`);
    }
    if (newPassword.length < 8) {
      return fail(set, 400, "validation_error", "new_password must be at least 8 characters.");
    }

    const consumed = await consumeEmailOtp(EMAIL_OTP_PURPOSE_RESET, email, otpCode);
    if (!consumed.ok) {
      if (consumed.code === "otp_expired") {
        return fail(set, 400, "otp_expired", "OTP code has expired.");
      }
      if (consumed.code === "otp_attempts_exceeded") {
        return fail(set, 400, "otp_attempts_exceeded", "Maximum OTP attempts exceeded.");
      }
      return fail(set, 400, "invalid_otp", "OTP code is invalid.");
    }

    try {
      const newHash = await Bun.password.hash(newPassword);
      const rows = await sql`
        UPDATE users
        SET
          password_hash = ${newHash},
          is_email_verified = TRUE
        WHERE id = ${consumed.userId}
          AND email = ${email}
          AND is_active = TRUE
        RETURNING id
      `;
      if (!first<{ id: number }>(rows)) {
        return fail(set, 400, "invalid_otp", "OTP code is invalid.");
      }

      return { changed: true };
    } catch (error) {
      return failForDbError(set, error, "password_reset_failed", "Failed to reset password.");
    }
  });

  const handleOAuthSignIn = async (
    provider: AuthProvider,
    body: unknown,
    set: { status?: number }
  ) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const tokenFieldName = getOAuthTokenFieldName(provider);
    const oauthToken = getString(body[tokenFieldName]);
    const requestedRoleRaw = getString(body.role);
    const requestedRole = requestedRoleRaw ?? "student";
    const hasSchool = Object.prototype.hasOwnProperty.call(body, "school");
    const school = getNullableString(body.school);
    const gradeProvided = Object.prototype.hasOwnProperty.call(body, "grade");
    const grade = body.grade === null ? null : getInteger(body.grade);
    const localeRaw = getNullableString(body.locale);
    const locale = localeRaw ?? "ru";
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const fallbackName = getNullableString(body.name);

    if (!oauthToken) {
      return fail(set, 400, "validation_error", `${tokenFieldName} is required.`);
    }
    if (!isUserRole(requestedRole) || requestedRole === "admin") {
      return fail(set, 400, "validation_error", OAUTH_ROLE_VALIDATION_MESSAGE);
    }
    if (hasSchool && typeof school === "undefined") {
      return fail(set, 400, "validation_error", "school must be a string or null.");
    }
    if (gradeProvided && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "grade must be an integer or null.");
    }
    if (!isLocale(locale)) {
      return fail(set, 400, "validation_error", LOCALE_VALIDATION_MESSAGE);
    }
    if (hasName && typeof fallbackName === "undefined") {
      return fail(set, 400, "validation_error", "name must be a string or null.");
    }
    if (!isOAuthProviderConfigured(provider)) {
      return fail(
        set,
        503,
        "oauth_not_configured",
        `${provider[0]?.toUpperCase()}${provider.slice(1)} OAuth is not configured on this server.`
      );
    }

    try {
      const verifiedIdentity = await verifyOAuthIdentity(provider, oauthToken);
      if (!verifiedIdentity) {
        return fail(set, 401, "invalid_oauth_token", "OAuth token is invalid or expired.");
      }

      const user = await upsertOAuthUser({
        provider,
        identity: verifiedIdentity,
        role: requestedRole,
        school,
        grade,
        gradeProvided,
        locale,
        fallbackName: fallbackName ?? null,
      });

      if (!user.is_active) {
        return fail(set, 403, "account_disabled", "Account is disabled.");
      }

      return {
        token: issueToken(user.id),
        user: toPublicUser(user),
      };
    } catch (error) {
      if (dbErrorCode(error) === "23505") {
        return fail(
          set,
          409,
          "oauth_account_conflict",
          "OAuth account is already linked to another user."
        );
      }
      return failForDbError(
        set,
        error,
        "oauth_login_failed",
        "Failed to authenticate with OAuth provider."
      );
    }
  };

  const handleOAuthLink = async (
    provider: AuthProvider,
    userId: number,
    body: unknown,
    set: { status?: number }
  ) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }
    if (!isOAuthProviderConfigured(provider)) {
      return fail(
        set,
        503,
        "oauth_not_configured",
        `${provider[0]?.toUpperCase()}${provider.slice(1)} OAuth is not configured on this server.`
      );
    }

    const tokenFieldName = getOAuthTokenFieldName(provider);
    const oauthToken = getString(body[tokenFieldName]);
    if (!oauthToken) {
      return fail(set, 400, "validation_error", `${tokenFieldName} is required.`);
    }

    const verifiedIdentity = await verifyOAuthIdentity(provider, oauthToken);
    if (!verifiedIdentity) {
      return fail(set, 401, "invalid_oauth_token", "OAuth token is invalid or expired.");
    }

    try {
      await sql.begin(async (transaction) => {
        const existingRows = await transaction`
          SELECT user_id
          FROM auth_accounts
          WHERE provider = ${provider}
            AND provider_account_id = ${verifiedIdentity.providerAccountId}
          LIMIT 1
        `;
        const existing = first<{ user_id: number }>(existingRows);
        if (existing && existing.user_id !== userId) {
          throw new Error("oauth_account_conflict");
        }

        await transaction`
          INSERT INTO auth_accounts (user_id, provider, provider_account_id)
          VALUES (${userId}, ${provider}, ${verifiedIdentity.providerAccountId})
          ON CONFLICT (provider, provider_account_id) DO NOTHING
        `;
      });

      return {
        linked: true,
        provider,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "oauth_account_conflict" || dbErrorCode(error) === "23505") {
        return fail(
          set,
          409,
          "oauth_account_conflict",
          "OAuth account is already linked to another user."
        );
      }
      return failForDbError(set, error, "oauth_link_failed", "Failed to link OAuth account.");
    }
  };

  app.post("/auth/oauth/google", async ({ body, set }) =>
    handleOAuthSignIn("google", body, set)
  );

  app.get("/me/security", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    try {
      const authAccountRows = await sql`
        SELECT provider, provider_account_id, created_at
        FROM auth_accounts
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `;
      const passkeyRows = await sql`
        SELECT id, credential_id, transports, created_at, last_used_at
        FROM auth_passkeys
        WHERE user_id = ${user.id}
        ORDER BY created_at DESC
      `;

      const oauthAccounts = authAccountRows.map((row) => {
        const entry = row as AuthAccountRow;
        return {
          provider: entry.provider,
          provider_account_id: entry.provider_account_id,
          created_at: entry.created_at,
        };
      });

      const passkeys = passkeyRows.map((row) => {
        const entry = row as {
          id: number;
          credential_id: string;
          transports: unknown;
          created_at: string;
          last_used_at: string | null;
        };
        return {
          id: entry.id,
          credential_id: entry.credential_id,
          transports: normalizeTransportList(entry.transports),
          created_at: entry.created_at,
          last_used_at: entry.last_used_at,
        };
      });

      return {
        security: {
          has_password: user.password_hash !== null,
          oauth_accounts: oauthAccounts,
          passkeys,
        },
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "security_status_failed",
        "Failed to fetch account security settings."
      );
    }
  });

  app.post("/me/security/password/change", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const oldPassword = getString(body.old_password);
    const newPassword = getString(body.new_password);
    if (!oldPassword || !newPassword) {
      return fail(
        set,
        400,
        "validation_error",
        "old_password and new_password are required."
      );
    }
    if (newPassword.length < 8) {
      return fail(set, 400, "validation_error", "new_password must be at least 8 characters.");
    }
    if (!user.password_hash) {
      return fail(
        set,
        400,
        "password_not_set",
        "Current account does not have a password configured."
      );
    }

    const oldPasswordValid = await Bun.password.verify(oldPassword, user.password_hash);
    if (!oldPasswordValid) {
      return fail(set, 401, "invalid_credentials", "Old password is incorrect.");
    }

    try {
      const newHash = await Bun.password.hash(newPassword);
      await sql`
        UPDATE users
        SET password_hash = ${newHash}
        WHERE id = ${user.id}
      `;
      return { changed: true };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "password_change_failed",
        "Failed to change password."
      );
    }
  });

  const sendEmailChangeOtp = async (
    user: UserRow,
    nextEmail: string,
    set: { status?: number }
  ) => {
    if (!isEmailServiceConfigured()) {
      return fail(
        set,
        503,
        "email_service_not_configured",
        "Email service is not configured on this server."
      );
    }
    if (nextEmail === user.email.toLowerCase()) {
      return fail(
        set,
        400,
        "validation_error",
        "new email must be different from current email."
      );
    }

    try {
      const existingRows = await sql`
        SELECT id
        FROM users
        WHERE email = ${nextEmail}
          AND id <> ${user.id}
        LIMIT 1
      `;
      if (first<{ id: number }>(existingRows)) {
        return fail(set, 409, "email_taken", "Email is already registered.");
      }

      const otpCode = await createEmailOtp(sql, {
        userId: user.id,
        email: nextEmail,
        purpose: EMAIL_OTP_PURPOSE_CHANGE,
      });
      await sendRegistrationOtpEmail({
        email: nextEmail,
        otpCode,
      });

      return {
        sent: true,
        email: nextEmail,
        expires_in_seconds: CONFIG.email.otpTtlSeconds,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "email_send_failed") {
        return fail(set, 502, "email_send_failed", "Failed to send verification email.");
      }
      return failForDbError(
        set,
        error,
        "email_change_request_failed",
        "Failed to send email change verification code."
      );
    }
  };

  app.post("/me/security/email/change/request", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const nextEmail = getString(body.email)?.toLowerCase();
    if (!nextEmail) {
      return fail(set, 400, "validation_error", "email is required.");
    }

    return sendEmailChangeOtp(user, nextEmail, set);
  });

  app.post("/me/security/email/change/resend", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const nextEmail = getString(body.email)?.toLowerCase();
    if (!nextEmail) {
      return fail(set, 400, "validation_error", "email is required.");
    }

    return sendEmailChangeOtp(user, nextEmail, set);
  });

  app.post("/me/security/email/change/verify", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const nextEmail = getString(body.email)?.toLowerCase();
    const otpCodeRaw = getString(body.otp);
    const otpCode = otpCodeRaw?.trim() ?? "";
    if (!nextEmail || !otpCode) {
      return fail(set, 400, "validation_error", "email and otp are required.");
    }
    if (!new RegExp(`^\\d{${EMAIL_OTP_LENGTH}}$`).test(otpCode)) {
      return fail(set, 400, "validation_error", `otp must be ${EMAIL_OTP_LENGTH} digits.`);
    }

    const consumed = await consumeEmailOtp(EMAIL_OTP_PURPOSE_CHANGE, nextEmail, otpCode);
    if (!consumed.ok) {
      if (consumed.code === "otp_expired") {
        return fail(set, 400, "otp_expired", "OTP code has expired.");
      }
      if (consumed.code === "otp_attempts_exceeded") {
        return fail(set, 400, "otp_attempts_exceeded", "Maximum OTP attempts exceeded.");
      }
      return fail(set, 400, "invalid_otp", "OTP code is invalid.");
    }
    if (consumed.userId !== user.id) {
      return fail(set, 400, "invalid_otp", "OTP code is invalid.");
    }

    try {
      const updatedRows = await sql`
        UPDATE users
        SET
          email = ${nextEmail},
          is_email_verified = TRUE
        WHERE id = ${user.id}
          AND is_active = TRUE
        RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
      `;
      const updatedUser = first<UserRow>(updatedRows);
      if (!updatedUser) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return {
        changed: true,
        user: toPublicUser(updatedUser),
      };
    } catch (error) {
      if (dbErrorCode(error) === "23505") {
        return fail(set, 409, "email_taken", "Email is already registered.");
      }
      return failForDbError(set, error, "email_change_failed", "Failed to change email.");
    }
  });

  app.post("/me/security/oauth/google/link", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    return handleOAuthLink("google", user.id, body, set);
  });

  app.delete("/me/security/oauth/:provider", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const providerRaw = getString(params.provider);
    if (!providerRaw || !isAuthProvider(providerRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "provider must be one of: google."
      );
    }

    try {
      const linkedRows = await sql`
        SELECT provider
        FROM auth_accounts
        WHERE user_id = ${user.id}
          AND provider = ${providerRaw}
        LIMIT 1
      `;
      const linked = first<Record<string, unknown>>(linkedRows);
      if (!linked) {
        return fail(set, 404, "not_found", "OAuth account is not linked.");
      }

      const canRemove = await canRemoveAuthMethod(user.id, {
        providerToRemove: providerRaw,
      });
      if (!canRemove) {
        return fail(set, 409, "lockout_prevention", OAUTH_UNLINK_LOCKOUT_MESSAGE);
      }

      await sql`
        DELETE FROM auth_accounts
        WHERE user_id = ${user.id}
          AND provider = ${providerRaw}
      `;

      return {
        unlinked: true,
        provider: providerRaw,
      };
    } catch (error) {
      return failForDbError(set, error, "oauth_unlink_failed", "Failed to unlink OAuth account.");
    }
  });

  app.post("/me/security/passkeys/register/options", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    try {
      const existingPasskeyRows = await sql`
        SELECT credential_id, transports
        FROM auth_passkeys
        WHERE user_id = ${user.id}
      `;

      const excludeCredentials = existingPasskeyRows
        .map((row) => {
          const entry = row as Record<string, unknown>;
          const credentialId = getString(entry.credential_id);
          if (!credentialId) {
            return null;
          }
          const transports = normalizeTransportList(entry.transports);
          if (transports.length > 0) {
            return {
              id: credentialId,
              transports,
            };
          }
          return { id: credentialId };
        })
        .filter((entry): entry is { id: string; transports?: string[] } => entry !== null);

      const options = await generateRegistrationOptions({
        rpName: CONFIG.webauthn.rpName,
        rpID: CONFIG.webauthn.rpId,
        userID: new TextEncoder().encode(String(user.id)),
        userName: user.email,
        userDisplayName: user.name,
        timeout: 60_000,
        attestationType: "none",
        requireResidentKey: true,
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "preferred",
        },
        excludeCredentials,
      });

      await sql`
        DELETE FROM auth_passkey_challenges
        WHERE user_id = ${user.id}
          AND flow = ${PASSKEY_CHALLENGE_REGISTER}
      `;
      await sql`
        INSERT INTO auth_passkey_challenges (user_id, flow, challenge, expires_at)
        VALUES (
          ${user.id},
          ${PASSKEY_CHALLENGE_REGISTER},
          ${options.challenge},
          now() + ${CONFIG.webauthn.challengeTtlSeconds} * INTERVAL '1 second'
        )
      `;

      return { options };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "passkey_registration_options_failed",
        "Failed to generate passkey registration options."
      );
    }
  });

  app.post("/me/security/passkeys/register/verify", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }
    const response = body.response;
    if (!isRecord(response)) {
      return fail(set, 400, "validation_error", "response object is required.");
    }

    const challenge = extractClientDataChallenge(response);
    const credentialId = extractCredentialId(response);
    if (!challenge || !credentialId) {
      return fail(set, 400, "invalid_passkey_response", "Passkey response is malformed.");
    }

    const challengeRows = await sql`
      SELECT id, user_id, challenge
      FROM auth_passkey_challenges
      WHERE user_id = ${user.id}
        AND flow = ${PASSKEY_CHALLENGE_REGISTER}
        AND challenge = ${challenge}
        AND expires_at > now()
      LIMIT 1
    `;
    const storedChallenge = first<PasskeyChallengeRow>(challengeRows);
    if (!storedChallenge) {
      return fail(
        set,
        400,
        "passkey_challenge_not_found",
        "Passkey challenge is missing or expired."
      );
    }

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: response as any,
        expectedChallenge: storedChallenge.challenge,
        expectedOrigin: CONFIG.webauthn.origins,
        expectedRPID: CONFIG.webauthn.rpId,
        requireUserVerification: true,
      });
    } catch {
      return fail(set, 400, "invalid_passkey_response", "Passkey verification failed.");
    }

    if (!verification.verified || !verification.registrationInfo) {
      return fail(set, 400, "invalid_passkey_response", "Passkey verification failed.");
    }

    const registrationInfo = verification.registrationInfo as unknown;
    let credentialPublicKey: Uint8Array | null = null;
    let counter = 0;
    let transports: string[] = [];
    let deviceType: string | null = null;
    let backedUp: boolean | null = null;

    if (isRecord(registrationInfo) && isRecord(registrationInfo.credential)) {
      const credentialRecord = registrationInfo.credential;
      credentialPublicKey = toUint8Array(credentialRecord.publicKey);
      const parsedCounter = asFiniteNumber(credentialRecord.counter);
      counter =
        parsedCounter !== null && parsedCounter >= 0 ? Math.floor(parsedCounter) : counter;
      transports = normalizeTransportList(credentialRecord.transports);
      deviceType = getString(registrationInfo.credentialDeviceType);
      backedUp = asBoolean(registrationInfo.credentialBackedUp);
    } else if (isRecord(registrationInfo)) {
      credentialPublicKey = toUint8Array(registrationInfo.credentialPublicKey);
      const parsedCounter = asFiniteNumber(registrationInfo.counter);
      counter =
        parsedCounter !== null && parsedCounter >= 0 ? Math.floor(parsedCounter) : counter;
      deviceType = getString(registrationInfo.credentialDeviceType);
      backedUp = asBoolean(registrationInfo.credentialBackedUp);
      if (isRecord(response.response)) {
        transports = normalizeTransportList(response.response.transports);
      }
    }

    if (!credentialPublicKey) {
      return fail(set, 400, "invalid_passkey_response", "Credential public key is missing.");
    }

    try {
      const passkey = await sql.begin(async (transaction) => {
        const transportsLiteral = toPgTextArrayLiteral(transports);

        const existingRows = await transaction`
          SELECT id, user_id
          FROM auth_passkeys
          WHERE credential_id = ${credentialId}
          LIMIT 1
        `;
        const existing = first<{ id: number; user_id: number }>(existingRows);
        if (existing && existing.user_id !== user.id) {
          throw new Error("passkey_credential_conflict");
        }

        const upsertRows = existing
          ? await transaction`
              UPDATE auth_passkeys
              SET
                credential_public_key = ${Buffer.from(credentialPublicKey)},
                counter = ${counter},
                transports = ${transportsLiteral}::text[],
                device_type = ${deviceType},
                backed_up = ${backedUp}
              WHERE id = ${existing.id}
              RETURNING id, user_id, credential_id, credential_public_key, counter, transports, device_type, backed_up, created_at, last_used_at
            `
          : await transaction`
              INSERT INTO auth_passkeys (
                user_id,
                credential_id,
                credential_public_key,
                counter,
                transports,
                device_type,
                backed_up
              )
              VALUES (
                ${user.id},
                ${credentialId},
                ${Buffer.from(credentialPublicKey)},
                ${counter},
                ${transportsLiteral}::text[],
                ${deviceType},
                ${backedUp}
              )
              RETURNING id, user_id, credential_id, credential_public_key, counter, transports, device_type, backed_up, created_at, last_used_at
            `;
        const storedPasskey = first<PasskeyRow>(upsertRows);
        if (!storedPasskey) {
          throw new Error("passkey_store_failed");
        }

        await transaction`
          DELETE FROM auth_passkey_challenges
          WHERE id = ${storedChallenge.id}
        `;

        return {
          id: storedPasskey.id,
          credential_id: storedPasskey.credential_id,
          transports: normalizeTransportList(storedPasskey.transports),
          created_at: storedPasskey.created_at,
          last_used_at: storedPasskey.last_used_at,
        };
      });

      return {
        verified: true,
        passkey,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (message === "passkey_credential_conflict" || dbErrorCode(error) === "23505") {
        return fail(
          set,
          409,
          "duplicate_resource",
          "Passkey credential is already linked to another account."
        );
      }
      return failForDbError(
        set,
        error,
        "passkey_registration_failed",
        "Failed to register passkey."
      );
    }
  });

  app.delete("/me/security/passkeys/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const passkeyId = getInteger(params.id);
    if (!passkeyId) {
      return fail(set, 400, "validation_error", "Valid passkey id is required.");
    }

    try {
      const rows = await sql`
        SELECT id
        FROM auth_passkeys
        WHERE id = ${passkeyId}
          AND user_id = ${user.id}
        LIMIT 1
      `;
      const passkey = first<{ id: number }>(rows);
      if (!passkey) {
        return fail(set, 404, "passkey_not_found", "Passkey was not found.");
      }

      const canRemove = await canRemoveAuthMethod(user.id, {
        passkeyIdToRemove: passkeyId,
      });
      if (!canRemove) {
        return fail(set, 409, "lockout_prevention", PASSKEY_DELETE_LOCKOUT_MESSAGE);
      }

      await sql`
        DELETE FROM auth_passkeys
        WHERE id = ${passkeyId}
          AND user_id = ${user.id}
      `;

      return { deleted: true };
    } catch (error) {
      return failForDbError(set, error, "passkey_delete_failed", "Failed to delete passkey.");
    }
  });

  app.post("/auth/passkeys/authenticate/options", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const email = getString(body.email)?.toLowerCase() ?? null;

    try {
      let user: UserRow | null = null;
      if (email) {
        const userRows = await sql`
          SELECT id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
          FROM users
          WHERE email = ${email}
            AND is_active = TRUE
          LIMIT 1
        `;
        user = first<UserRow>(userRows);
      }

      const allowCredentialRows = user
        ? await sql`
            SELECT credential_id, transports
            FROM auth_passkeys
            WHERE user_id = ${user.id}
          `
        : [];

      const allowCredentials = allowCredentialRows
        .map((row) => {
          const entry = row as Record<string, unknown>;
          const credentialId = getString(entry.credential_id);
          if (!credentialId) {
            return null;
          }
          const transports = normalizeTransportList(entry.transports);
          if (transports.length > 0) {
            return {
              id: credentialId,
              transports,
            };
          }
          return { id: credentialId };
        })
        .filter((entry): entry is { id: string; transports?: string[] } => entry !== null);

      const options = await generateAuthenticationOptions({
        rpID: CONFIG.webauthn.rpId,
        timeout: 30_000,
        userVerification: "preferred",
        allowCredentials,
      });

      await sql`
        INSERT INTO auth_passkey_challenges (user_id, flow, challenge, expires_at)
        VALUES (
          ${user?.id ?? null},
          ${PASSKEY_CHALLENGE_AUTHENTICATE},
          ${options.challenge},
          now() + ${CONFIG.webauthn.challengeTtlSeconds} * INTERVAL '1 second'
        )
      `;

      return { options };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "passkey_authentication_options_failed",
        "Failed to generate passkey authentication options."
      );
    }
  });

  app.post("/auth/passkeys/authenticate/verify", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }
    const response = body.response;
    if (!isRecord(response)) {
      return fail(set, 400, "validation_error", "response object is required.");
    }
    const optionalEmail = getString(body.email)?.toLowerCase() ?? null;
    const challenge = extractClientDataChallenge(response);
    const credentialId = extractCredentialId(response);
    if (!challenge || !credentialId) {
      return fail(set, 400, "invalid_passkey_response", "Passkey response is malformed.");
    }

    try {
      const challengeRows = await sql`
        SELECT id, user_id, challenge
        FROM auth_passkey_challenges
        WHERE flow = ${PASSKEY_CHALLENGE_AUTHENTICATE}
          AND challenge = ${challenge}
          AND expires_at > now()
        LIMIT 1
      `;
      const storedChallenge = first<PasskeyChallengeRow>(challengeRows);
      if (!storedChallenge) {
        return fail(
          set,
          400,
          "passkey_challenge_not_found",
          "Passkey challenge is missing or expired."
        );
      }

      const passkeyRows = await sql`
        SELECT id, user_id, credential_id, credential_public_key, counter, transports, device_type, backed_up, created_at, last_used_at
        FROM auth_passkeys
        WHERE credential_id = ${credentialId}
        LIMIT 1
      `;
      const passkey = first<PasskeyRow>(passkeyRows);
      if (!passkey) {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }
      if (storedChallenge.user_id !== null && storedChallenge.user_id !== passkey.user_id) {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }

      const userRows = await sql`
        SELECT id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        FROM users
        WHERE id = ${passkey.user_id}
        LIMIT 1
      `;
      const user = first<UserRow>(userRows);
      if (!user || !user.is_active) {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }
      if (optionalEmail && optionalEmail !== user.email.toLowerCase()) {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }

      const credentialPublicKey = toUint8Array(passkey.credential_public_key);
      if (!credentialPublicKey) {
        return fail(set, 400, "invalid_passkey_response", "Stored passkey is invalid.");
      }
      const counterValue = asFiniteNumber(passkey.counter);
      if (counterValue === null || counterValue < 0) {
        return fail(set, 400, "invalid_passkey_response", "Stored passkey is invalid.");
      }

      let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
      try {
        verification = await verifyAuthenticationResponse({
          response: response as any,
          expectedChallenge: storedChallenge.challenge,
          expectedOrigin: CONFIG.webauthn.origins,
          expectedRPID: CONFIG.webauthn.rpId,
          requireUserVerification: false,
          credential: {
            id: passkey.credential_id,
            publicKey: credentialPublicKey,
            counter: Math.floor(counterValue),
            transports: normalizeTransportList(passkey.transports),
          },
        });
      } catch {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }

      if (!verification.verified) {
        return fail(set, 401, "invalid_passkey_response", "Passkey verification failed.");
      }

      const authenticationInfo = verification.authenticationInfo as unknown;
      const parsedNewCounter = isRecord(authenticationInfo)
        ? asFiniteNumber(authenticationInfo.newCounter)
        : null;
      const nextCounter =
        parsedNewCounter !== null
          ? Math.max(0, Math.floor(parsedNewCounter))
          : Math.floor(counterValue);

      await sql.begin(async (transaction) => {
        await transaction`
          UPDATE auth_passkeys
          SET
            counter = ${nextCounter},
            last_used_at = now()
          WHERE id = ${passkey.id}
        `;
        await transaction`
          DELETE FROM auth_passkey_challenges
          WHERE id = ${storedChallenge.id}
        `;
      });

      return {
        token: issueToken(user.id),
        user: toPublicUser(user),
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "passkey_authentication_failed",
        "Failed to authenticate with passkey."
      );
    }
  });

  app.get("/me", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    try {
      let profile: Record<string, unknown> | null = null;
      if (user.role === "student") {
        const rows = await sql`
          SELECT user_id, directions_json, goals_text, onboarding_completed_at, updated_at
          FROM student_profiles
          WHERE user_id = ${user.id}
          LIMIT 1
        `;
        profile = first<Record<string, unknown>>(rows);
      } else if (user.role === "teacher") {
        const rows = await sql`
          SELECT user_id, subjects_json, updated_at
          FROM teacher_profiles
          WHERE user_id = ${user.id}
          LIMIT 1
        `;
        profile = first<Record<string, unknown>>(rows);
      }

      return {
        user: toPublicUser(user),
        profile,
      };
    } catch (error) {
      return failForDbError(set, error, "me_failed", "Failed to fetch profile.");
    }
  });

  app.put("/me/profile", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasSchool = Object.prototype.hasOwnProperty.call(body, "school");
    const hasGrade = Object.prototype.hasOwnProperty.call(body, "grade");
    const hasLocale = Object.prototype.hasOwnProperty.call(body, "locale");
    const name = getString(body.name)?.trim() ?? null;
    const school = getNullableString(body.school);
    const grade = body.grade === null ? null : getInteger(body.grade);
    const locale = getNullableString(body.locale);

    if (hasName && (!name || name.length === 0)) {
      return fail(set, 400, "validation_error", "name must be a non-empty string.");
    }
    if (hasSchool && typeof school === "undefined") {
      return fail(set, 400, "validation_error", "school must be a string or null.");
    }
    if (hasGrade && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "grade must be an integer or null.");
    }
    if (hasLocale && !isLocale(locale ?? "")) {
      return fail(set, 400, "validation_error", LOCALE_VALIDATION_MESSAGE);
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const updatedRows = await transaction`
          UPDATE users
          SET
            name = CASE WHEN ${hasName}::boolean THEN ${name ?? user.name} ELSE name END,
            school = CASE WHEN ${hasSchool}::boolean THEN ${school ?? null} ELSE school END,
            grade = CASE WHEN ${hasGrade}::boolean THEN ${grade} ELSE grade END,
            locale = CASE WHEN ${hasLocale}::boolean THEN ${locale ?? user.locale} ELSE locale END
          WHERE id = ${user.id}
          RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        `;
        const updatedUser = first<UserRow>(updatedRows);
        if (!updatedUser) {
          throw new Error("Failed to update user.");
        }

        let profile: Record<string, unknown> | null = null;
        if (updatedUser.role === "student") {
          const hasDirections = Object.prototype.hasOwnProperty.call(body, "directions");
          const hasGoalsText = Object.prototype.hasOwnProperty.call(body, "goals_text");
          const directions =
            hasDirections && Array.isArray(body.directions)
              ? body.directions.filter((entry): entry is string => typeof entry === "string")
              : [];
          const goalsText = getNullableString(body.goals_text);

          if (hasDirections && !Array.isArray(body.directions)) {
            throw new Error("directions must be an array of strings.");
          }
          if (hasGoalsText && typeof goalsText === "undefined") {
            throw new Error("goals_text must be a string or null.");
          }

          const rows = await transaction`
            UPDATE student_profiles
            SET
              directions_json = CASE
                WHEN ${hasDirections}::boolean THEN ${JSON.stringify(directions)}::jsonb
                ELSE directions_json
              END,
              goals_text = CASE
                WHEN ${hasGoalsText}::boolean THEN ${goalsText ?? ""}
                ELSE goals_text
              END
            WHERE user_id = ${updatedUser.id}
            RETURNING user_id, directions_json, goals_text, onboarding_completed_at, updated_at
          `;
          profile = first<Record<string, unknown>>(rows);
        } else if (updatedUser.role === "teacher") {
          const hasSubjects = Object.prototype.hasOwnProperty.call(body, "subjects");
          const subjects =
            hasSubjects && Array.isArray(body.subjects)
              ? body.subjects.filter((entry): entry is string => typeof entry === "string")
              : [];

          if (hasSubjects && !Array.isArray(body.subjects)) {
            throw new Error("subjects must be an array of strings.");
          }

          const rows = await transaction`
            UPDATE teacher_profiles
            SET
              subjects_json = CASE
                WHEN ${hasSubjects}::boolean THEN ${JSON.stringify(subjects)}::jsonb
                ELSE subjects_json
              END
            WHERE user_id = ${updatedUser.id}
            RETURNING user_id, subjects_json, updated_at
          `;
          profile = first<Record<string, unknown>>(rows);
        }

        return { user: toPublicUser(updatedUser), profile };
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      if (
        message === "directions must be an array of strings." ||
        message === "goals_text must be a string or null." ||
        message === "subjects must be an array of strings."
      ) {
        return fail(set, 400, "validation_error", message);
      }
      return failForDbError(set, error, "profile_update_failed", "Failed to update profile.");
    }
  });

  app.post("/me/onboarding/complete", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (user.role !== "student") {
      return fail(set, 403, "forbidden", "Only students can complete onboarding.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const hasDirections = Object.prototype.hasOwnProperty.call(body, "directions");
    const hasGoalsText = Object.prototype.hasOwnProperty.call(body, "goals_text");
    const hasGrade = Object.prototype.hasOwnProperty.call(body, "grade");

    if (!hasDirections || !hasGoalsText || !hasGrade) {
      return fail(
        set,
        400,
        "validation_error",
        "directions, goals_text, and grade are required to complete onboarding."
      );
    }

    if (hasDirections && !Array.isArray(body.directions)) {
      return fail(set, 400, "validation_error", "directions must be an array of strings.");
    }

    const directions = hasDirections
      ? (body.directions as unknown[]).filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [];
    const goalsText = getNullableString(body.goals_text);
    const grade = body.grade === null ? null : getInteger(body.grade);

    if (hasGoalsText && typeof goalsText === "undefined") {
      return fail(set, 400, "validation_error", "goals_text must be a non-empty string.");
    }
    if (goalsText === null || goalsText.trim().length === 0) {
      return fail(set, 400, "validation_error", "goals_text must be a non-empty string.");
    }
    if (directions.length === 0) {
      return fail(set, 400, "validation_error", "directions must include at least one item.");
    }
    if (hasGrade && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "grade must be an integer.");
    }
    if (grade === null || grade < 1 || grade > 12) {
      return fail(set, 400, "validation_error", "grade must be between 1 and 12.");
    }

    try {
      const profile = await sql.begin(async (transaction) => {
        if (hasGrade) {
          await transaction`
            UPDATE users
            SET grade = ${grade}
            WHERE id = ${user.id}
          `;
        }

        const rows = await transaction`
          UPDATE student_profiles
            SET
              directions_json = CASE
                WHEN ${hasDirections}::boolean THEN ${JSON.stringify(directions)}::jsonb
                ELSE directions_json
              END,
              goals_text = CASE
                WHEN ${hasGoalsText}::boolean THEN ${goalsText}
                ELSE goals_text
              END,
            onboarding_completed_at = now()
          WHERE user_id = ${user.id}
          RETURNING user_id, directions_json, goals_text, onboarding_completed_at, updated_at
        `;
        return first<Record<string, unknown>>(rows);
      });

      return { completed: true, profile };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "onboarding_failed",
        "Failed to complete onboarding."
      );
    }
  });

  app.get("/admin/users", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Admin role required.");
    }

    const searchRaw = typeof query.search === "string" ? query.search.trim() : "";
    const roleRaw = typeof query.role === "string" ? query.role.trim().toLowerCase() : "";
    const limitRaw = getInteger(query.limit);

    let role: UserRole | null = null;
    if (roleRaw.length > 0) {
      if (!isUserRole(roleRaw)) {
        return fail(set, 400, "validation_error", "Invalid role filter.");
      }
      role = roleRaw;
    }

    const isActiveParam = query.is_active;
    let isActive: boolean | null = null;
    if (typeof isActiveParam === "string" && isActiveParam.length > 0) {
      if (isActiveParam === "true") {
        isActive = true;
      } else if (isActiveParam === "false") {
        isActive = false;
      } else {
        return fail(set, 400, "validation_error", "is_active must be true or false.");
      }
    }

    const limit = Math.min(Math.max(limitRaw ?? 120, 1), 300);
    const searchLike = searchRaw.length > 0 ? `%${searchRaw}%` : null;

    try {
      const rows = await sql`
        SELECT
          id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        FROM users u
        WHERE
          (${role}::text IS NULL OR u.role::text = ${role})
          AND (${isActive}::boolean IS NULL OR u.is_active = ${isActive})
          AND (
            ${searchLike}::text IS NULL
            OR u.name ILIKE ${searchLike}
            OR u.email ILIKE ${searchLike}
            OR COALESCE(u.school, '') ILIKE ${searchLike}
          )
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ${limit}
      `;

      const items = rows.map((row) => toPublicUser(row as UserRow));
      return { items };
    } catch (error) {
      return failForDbError(set, error, "users_fetch_failed", "Failed to fetch users.");
    }
  });

  app.patch("/admin/users/:id/role", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const targetUserId = getInteger(params.id);
    const roleRaw = getString(body.role);
    if (!targetUserId || !roleRaw || !isUserRole(roleRaw)) {
      return fail(set, 400, "validation_error", "Valid target user id and role are required.");
    }

    try {
      const updatedUser = await sql.begin(async (transaction) => {
        const rows = await transaction`
          UPDATE users
          SET role = ${roleRaw}
          WHERE id = ${targetUserId}
          RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        `;
        const updated = first<UserRow>(rows);
        if (!updated) {
          return null;
        }

        if (roleRaw === "student") {
          await transaction`
            INSERT INTO student_profiles (user_id)
            VALUES (${targetUserId})
            ON CONFLICT (user_id) DO NOTHING
          `;
          await transaction`
            DELETE FROM teacher_profiles
            WHERE user_id = ${targetUserId}
          `;
        } else if (roleRaw === "teacher") {
          await transaction`
            INSERT INTO teacher_profiles (user_id)
            VALUES (${targetUserId})
            ON CONFLICT (user_id) DO NOTHING
          `;
          await transaction`
            DELETE FROM student_profiles
            WHERE user_id = ${targetUserId}
          `;
        } else {
          await transaction`
            DELETE FROM student_profiles
            WHERE user_id = ${targetUserId}
          `;
          await transaction`
            DELETE FROM teacher_profiles
            WHERE user_id = ${targetUserId}
          `;
        }
        return updated;
      });

      if (!updatedUser) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return { user: toPublicUser(updatedUser) };
    } catch (error) {
      return failForDbError(set, error, "role_update_failed", "Failed to update role.");
    }
  });

  app.patch("/admin/users/:id/active", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const targetUserId = getInteger(params.id);
    const isActive = typeof body.is_active === "boolean" ? body.is_active : null;
    if (!targetUserId || isActive === null) {
      return fail(
        set,
        400,
        "validation_error",
        "Valid target user id and is_active are required."
      );
    }

    try {
      const rows = await sql`
        UPDATE users
        SET is_active = ${isActive}
        WHERE id = ${targetUserId}
        RETURNING id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
      `;
      const updated = first<UserRow>(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return { user: toPublicUser(updated) };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "active_update_failed",
        "Failed to update user activity."
      );
    }
  });

  app.delete("/admin/users/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Admin role required.");
    }

    const targetUserId = getInteger(params.id);
    if (!targetUserId) {
      return fail(set, 400, "validation_error", "Valid target user id is required.");
    }
    if (targetUserId === user.id) {
      return fail(set, 409, "self_delete_forbidden", "Cannot delete the current admin user.");
    }

    try {
      const rows = await sql`
        DELETE FROM users
        WHERE id = ${targetUserId}
        RETURNING id
      `;
      const deleted = first<{ id: number }>(rows);
      if (!deleted) {
        return fail(set, 404, "not_found", "User not found.");
      }
      return { deleted: true, user_id: deleted.id };
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "23503") {
        return fail(
          set,
          409,
          "user_has_dependencies",
          "User has related records and cannot be deleted."
        );
      }
      return failForDbError(set, error, "user_delete_failed", "Failed to delete user.");
    }
  });
};
