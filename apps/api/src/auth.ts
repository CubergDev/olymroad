import { createHmac, timingSafeEqual } from "node:crypto";
import { CONFIG } from "./config";
import { first, sql } from "./db";
import type { PublicUser, UserRow, UserRole } from "./types";

const signPayload = (payload: string): string =>
  createHmac("sha256", CONFIG.authTokenSecret).update(payload).digest("base64url");

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const issueToken = (userId: number): string => {
  const exp = Math.floor(Date.now() / 1000) + CONFIG.authTokenTtlSeconds;
  const payload = `${userId}:${exp}`;
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = signPayload(encoded);
  return `${encoded}.${signature}`;
};

const verifyToken = (token: string): { userId: number } | null => {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signPayload(encoded);
  if (!safeCompare(signature, expected)) {
    return null;
  }

  const decoded = Buffer.from(encoded, "base64url").toString("utf8");
  const [userIdRaw, expRaw] = decoded.split(":");
  const userId = Number(userIdRaw);
  const exp = Number(expRaw);

  if (!Number.isInteger(userId) || !Number.isFinite(exp)) {
    return null;
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { userId };
};

const getBearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) {
    return null;
  }
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }
  return token;
};

export const getAuthUser = async (
  authorization: string | undefined
): Promise<UserRow | null> => {
  const token = getBearerToken(authorization);
  if (!token) {
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const rows = await sql`
    SELECT id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
    FROM users
    WHERE id = ${payload.userId}
    LIMIT 1
  `;
  const user = first<UserRow>(rows);
  if (!user || !user.is_active) {
    return null;
  }
  return user;
};

export const requireUser = async (
  authorization: string | undefined,
  set: { status?: number }
): Promise<UserRow | null> => {
  const user = await getAuthUser(authorization);
  if (!user) {
    set.status = 401;
    return null;
  }
  return user;
};

export const requireRole = (
  user: UserRow,
  roles: UserRole[],
  set: { status?: number }
): boolean => {
  if (!roles.includes(user.role)) {
    set.status = 403;
    return false;
  }
  return true;
};

export const toPublicUser = (user: UserRow): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  school: user.school,
  grade: user.grade,
  locale: user.locale,
  is_active: user.is_active,
  created_at: user.created_at,
  updated_at: user.updated_at,
});
