import type { Elysia } from "elysia";
import { issueToken, requireRole, requireUser, toPublicUser } from "../auth";
import { dbErrorCode, first, sql } from "../db";
import { fail } from "../http";
import {
  getEmailString,
  getInteger,
  getNullableString,
  getString,
  isRecord,
  isUserRole,
} from "../validation";
import type { UserRow } from "../types";

export const registerAuthProfileRoutes = (app: Elysia) => {
  app.post("/auth/register", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const name = getString(body.name);
    const email = getEmailString(body.email);
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
    if (name.length > 255) {
      return fail(set, 400, "validation_error", "Name must be less than 255 characters.");
    }
    if (password.length < 8) {
      return fail(set, 400, "validation_error", "Password must be at least 8 characters.");
    }
    if (!isUserRole(requestedRole)) {
      return fail(set, 400, "validation_error", "Role must be student, teacher, or admin.");
    }
    if (locale !== "ru" && locale !== "kz" && locale !== "en") {
      return fail(set, 400, "validation_error", "Locale must be ru, kz, or en.");
    }
    if (typeof body.grade !== "undefined" && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "Grade must be an integer.");
    }

    try {
      const passwordHash = await Bun.password.hash(password);
      const createdUser = await sql.begin(async (transaction) => {
        const rows = await transaction`
          INSERT INTO users (name, email, password_hash, role, school, grade, locale)
          VALUES (
            ${name},
            ${email},
            ${passwordHash},
            ${requestedRole},
            ${typeof school === "undefined" ? null : school},
            ${typeof body.grade === "undefined" ? null : grade},
            ${locale}
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

        return user;
      });

      return {
        token: issueToken(createdUser.id),
        user: toPublicUser(createdUser),
      };
    } catch (error) {
      if (dbErrorCode(error) === "23505") {
        return fail(set, 409, "email_taken", "Email is already registered.");
      }
      return fail(set, 500, "register_failed", "Failed to register user.");
    }
  });

  app.post("/auth/login", async ({ body, set }) => {
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }
    const email = getEmailString(body.email);
    const password = getString(body.password);

    if (!email || !password) {
      return fail(set, 400, "validation_error", "Email and password are required.");
    }

    try {
      const rows = await sql`
        SELECT id, name, email, password_hash, role, school, grade, locale, is_active, created_at, updated_at
        FROM users
        WHERE email = ${email}
        LIMIT 1
      `;
      const user = first<UserRow>(rows);
      if (!user || !user.password_hash) {
        return fail(set, 401, "invalid_credentials", "Invalid credentials.");
      }
      if (!user.is_active) {
        return fail(set, 403, "account_disabled", "Account is disabled.");
      }

      const passwordValid = await Bun.password.verify(password, user.password_hash);
      if (!passwordValid) {
        return fail(set, 401, "invalid_credentials", "Invalid credentials.");
      }

      return {
        token: issueToken(user.id),
        user: toPublicUser(user),
      };
    } catch {
      return fail(set, 500, "login_failed", "Failed to login.");
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
    } catch {
      return fail(set, 500, "me_failed", "Failed to fetch profile.");
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

    const hasSchool = Object.prototype.hasOwnProperty.call(body, "school");
    const hasGrade = Object.prototype.hasOwnProperty.call(body, "grade");
    const hasLocale = Object.prototype.hasOwnProperty.call(body, "locale");
    const school = getNullableString(body.school);
    const grade = body.grade === null ? null : getInteger(body.grade);
    const locale = getNullableString(body.locale);

    if (hasSchool && typeof school === "undefined") {
      return fail(set, 400, "validation_error", "school must be a string or null.");
    }
    if (hasSchool && school !== null && school.length > 500) {
      return fail(set, 400, "validation_error", "school must be less than 500 characters.");
    }
    if (hasGrade && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "grade must be an integer or null.");
    }
    if (hasLocale && locale !== "ru" && locale !== "kz" && locale !== "en") {
      return fail(set, 400, "validation_error", "locale must be ru, kz, or en.");
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const updatedRows = await transaction`
          UPDATE users
          SET
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
      const message =
        error instanceof Error ? error.message : "Failed to update profile.";
      return fail(set, 400, "profile_update_failed", message);
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
      return fail(set, 400, "validation_error", "goals_text must be a string.");
    }
    if (hasGrade && body.grade !== null && grade === null) {
      return fail(set, 400, "validation_error", "grade must be an integer or null.");
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
              WHEN ${hasGoalsText}::boolean THEN ${goalsText ?? ""}
              ELSE goals_text
            END,
            onboarding_completed_at = now()
          WHERE user_id = ${user.id}
          RETURNING user_id, directions_json, goals_text, onboarding_completed_at, updated_at
        `;
        return first<Record<string, unknown>>(rows);
      });

      return { completed: true, profile };
    } catch {
      return fail(set, 500, "onboarding_failed", "Failed to complete onboarding.");
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
        } else if (roleRaw === "teacher") {
          await transaction`
            INSERT INTO teacher_profiles (user_id)
            VALUES (${targetUserId})
            ON CONFLICT (user_id) DO NOTHING
          `;
        }
        return updated;
      });

      if (!updatedUser) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return { user: toPublicUser(updatedUser) };
    } catch {
      return fail(set, 500, "role_update_failed", "Failed to update role.");
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
    } catch {
      return fail(set, 500, "active_update_failed", "Failed to update user activity.");
    }
  });
};
