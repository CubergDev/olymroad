import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail, failForDbError } from "../http";
import {
  getBoolean,
  getDateString,
  getInteger,
  getString,
  getUuidString,
  isRecord,
  isUserRole,
} from "../validation";

const EVENT_TYPES = new Set([
  "olympiad",
  "research_projects",
  "contest_game",
  "hackathon",
  "camp",
  "other",
]);

const STAGE_TYPES = new Set([
  "selection",
  "regional",
  "final",
  "submission",
  "defense",
  "training",
]);

const STAGE_FORMATS = new Set(["online", "offline", "hybrid"]);
const DATE_PRECISIONS = new Set(["DAY", "RANGE", "MONTH", "UNKNOWN"]);

export const registerV2AdminRoutes = (app: Elysia) => {
  app.get("/v2/admin/series", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can access this endpoint.");
    }

    const search = getString(query.search);
    const eventType = getString(query.event_type);
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if (eventType !== null && !EVENT_TYPES.has(eventType)) {
      return fail(
        set,
        400,
        "validation_error",
        "event_type must be olympiad/research_projects/contest_game/hackathon/camp/other."
      );
    }
    if (query.limit !== undefined && (limitRaw === null || limitRaw < 1)) {
      return fail(set, 400, "validation_error", "limit must be a positive integer.");
    }

    const limit = limitRaw ? Math.min(limitRaw, 500) : 200;

    try {
      const rows = await sql`
        SELECT
          cs.id,
          cs.name_ru,
          cs.name_kz,
          cs.abbr,
          cs.event_type,
          cs.level,
          cs.grade_min,
          cs.grade_max,
          cs.grade_note,
          cs.pipeline_template_id,
          cs.created_at,
          cs.updated_at,
          COALESCE(
            ARRAY(
              SELECT ss.subject_code
              FROM series_subjects ss
              WHERE ss.series_id = cs.id
              ORDER BY ss.subject_code
            ),
            ARRAY[]::text[]
          ) AS subject_codes
        FROM competition_series cs
        WHERE (${eventType}::event_type_enum IS NULL OR cs.event_type = ${eventType})
          AND (
            ${search}::text IS NULL
            OR cs.id ILIKE ${search ? `%${search}%` : null}
            OR cs.name_ru ILIKE ${search ? `%${search}%` : null}
            OR cs.abbr ILIKE ${search ? `%${search}%` : null}
          )
        ORDER BY cs.name_ru
        LIMIT ${limit}
      `;

      return {
        filters: {
          search,
          event_type: eventType,
          limit,
        },
        items: rows,
      };
    } catch (error) {
      return failForDbError(set, error, "v2_admin_series_failed", "Failed to fetch competition series.");
    }
  });

  app.get("/v2/admin/stage-templates", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can access this endpoint.");
    }

    try {
      const rows = await sql`
        SELECT
          st.id,
          st.name_ru,
          st.name_kz,
          st.stage_type,
          st.default_registration_method,
          st.checklist_template_id,
          st.created_at
        FROM stage_templates st
        ORDER BY st.name_ru
      `;
      return { items: rows };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_admin_stage_templates_failed",
        "Failed to fetch stage templates."
      );
    }
  });

  app.get("/v2/admin/stage-instances", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can access this endpoint.");
    }

    const seriesId = getString(query.series_id);
    const stageType = getString(query.stage_type);
    const fromDate = query.from ? getDateString(query.from) : null;
    const toDate = query.to ? getDateString(query.to) : null;
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if (stageType !== null && !STAGE_TYPES.has(stageType)) {
      return fail(
        set,
        400,
        "validation_error",
        "stage_type must be selection/regional/final/submission/defense/training."
      );
    }
    if ((query.from !== undefined && !fromDate) || (query.to !== undefined && !toDate)) {
      return fail(set, 400, "validation_error", "from/to must be YYYY-MM-DD.");
    }
    if (query.limit !== undefined && (limitRaw === null || limitRaw < 1)) {
      return fail(set, 400, "validation_error", "limit must be a positive integer.");
    }

    const limit = limitRaw ? Math.min(limitRaw, 500) : 250;

    try {
      const rows = await sql`
        SELECT
          si.id,
          si.series_id,
          cs.name_ru AS series_name_ru,
          cs.name_kz AS series_name_kz,
          cs.abbr AS series_abbr,
          st.id AS stage_template_id,
          st.name_ru AS stage_template_name_ru,
          st.name_kz AS stage_template_name_kz,
          st.stage_type,
          si.label,
          si.date_precision,
          si.starts_on,
          si.ends_on,
          si.registration_deadline,
          si.location_text,
          si.format,
          si.source_ref,
          si.is_seed,
          si.created_at,
          si.updated_at
        FROM stage_instances si
        INNER JOIN competition_series cs ON cs.id = si.series_id
        INNER JOIN stage_templates st ON st.id = si.stage_template_id
        WHERE (${seriesId}::text IS NULL OR si.series_id = ${seriesId})
          AND (${stageType}::stage_type_enum IS NULL OR st.stage_type = ${stageType})
          AND (${fromDate}::date IS NULL OR si.starts_on >= ${fromDate})
          AND (${toDate}::date IS NULL OR si.starts_on <= ${toDate})
        ORDER BY si.registration_deadline NULLS LAST, si.starts_on NULLS LAST, si.created_at DESC
        LIMIT ${limit}
      `;

      return {
        filters: {
          series_id: seriesId,
          stage_type: stageType,
          from: fromDate,
          to: toDate,
          limit,
        },
        items: rows,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_admin_stage_instances_failed",
        "Failed to fetch stage instances."
      );
    }
  });

  app.post("/v2/admin/stage-instances", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can create stage instances.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const seriesId = getString(body.series_id);
    const stageTemplateId = getString(body.stage_template_id);
    const label = getString(body.label);
    const datePrecision = getString(body.date_precision) ?? "DAY";
    const startsOn = body.starts_on === null ? null : getDateString(body.starts_on);
    const endsOn = body.ends_on === null ? null : getDateString(body.ends_on);
    const registrationDeadline =
      body.registration_deadline === null ? null : getDateString(body.registration_deadline);
    const locationText = getString(body.location_text);
    const format = getString(body.format) ?? "offline";
    const sourceRef = getString(body.source_ref);
    const isSeed = getBoolean(body.is_seed) ?? false;

    if (!seriesId || !stageTemplateId) {
      return fail(set, 400, "validation_error", "series_id and stage_template_id are required.");
    }
    if (!DATE_PRECISIONS.has(datePrecision)) {
      return fail(set, 400, "validation_error", "date_precision must be DAY/RANGE/MONTH/UNKNOWN.");
    }
    if (!STAGE_FORMATS.has(format)) {
      return fail(set, 400, "validation_error", "format must be online/offline/hybrid.");
    }
    if (body.starts_on !== undefined && body.starts_on !== null && !startsOn) {
      return fail(set, 400, "validation_error", "starts_on must be YYYY-MM-DD or null.");
    }
    if (body.ends_on !== undefined && body.ends_on !== null && !endsOn) {
      return fail(set, 400, "validation_error", "ends_on must be YYYY-MM-DD or null.");
    }
    if (
      body.registration_deadline !== undefined &&
      body.registration_deadline !== null &&
      !registrationDeadline
    ) {
      return fail(
        set,
        400,
        "validation_error",
        "registration_deadline must be YYYY-MM-DD or null."
      );
    }

    try {
      const rows = await sql`
        INSERT INTO stage_instances (
          series_id,
          stage_template_id,
          label,
          date_precision,
          starts_on,
          ends_on,
          registration_deadline,
          location_text,
          format,
          source_ref,
          is_seed
        )
        VALUES (
          ${seriesId},
          ${stageTemplateId},
          ${label ?? null},
          ${datePrecision},
          ${startsOn},
          ${endsOn},
          ${registrationDeadline},
          ${locationText ?? null},
          ${format},
          ${sourceRef ?? null},
          ${isSeed}
        )
        RETURNING *
      `;

      return { stage_instance: first(rows) };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_admin_stage_instance_create_failed",
        "Failed to create stage instance."
      );
    }
  });

  app.patch("/v2/admin/stage-instances/:id", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can update stage instances.");
    }

    const stageInstanceId = getUuidString(params.id);
    if (!stageInstanceId) {
      return fail(set, 400, "validation_error", "Invalid stage instance id.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const currentRows = await sql`
      SELECT *
      FROM stage_instances
      WHERE id = ${stageInstanceId}::uuid
      LIMIT 1
    `;
    const current = first<Record<string, unknown>>(currentRows);
    if (!current) {
      return fail(set, 404, "not_found", "Stage instance not found.");
    }

    const seriesId =
      body.series_id === undefined ? (current.series_id as string) : getString(body.series_id);
    const stageTemplateId =
      body.stage_template_id === undefined
        ? (current.stage_template_id as string)
        : getString(body.stage_template_id);
    const label = body.label === undefined ? (current.label as string | null) : getString(body.label);
    const datePrecision =
      body.date_precision === undefined
        ? (current.date_precision as string)
        : getString(body.date_precision);
    const startsOn =
      body.starts_on === undefined
        ? (current.starts_on as string | null)
        : body.starts_on === null
          ? null
          : getDateString(body.starts_on);
    const endsOn =
      body.ends_on === undefined
        ? (current.ends_on as string | null)
        : body.ends_on === null
          ? null
          : getDateString(body.ends_on);
    const registrationDeadline =
      body.registration_deadline === undefined
        ? (current.registration_deadline as string | null)
        : body.registration_deadline === null
          ? null
          : getDateString(body.registration_deadline);
    const locationText =
      body.location_text === undefined
        ? (current.location_text as string | null)
        : getString(body.location_text);
    const format = body.format === undefined ? (current.format as string) : getString(body.format);
    const sourceRef =
      body.source_ref === undefined
        ? (current.source_ref as string | null)
        : getString(body.source_ref);
    const isSeed = body.is_seed === undefined ? Boolean(current.is_seed) : getBoolean(body.is_seed);

    if (!seriesId || !stageTemplateId || !datePrecision || !format || isSeed === null) {
      return fail(set, 400, "validation_error", "Invalid stage instance fields.");
    }
    if (!DATE_PRECISIONS.has(datePrecision)) {
      return fail(set, 400, "validation_error", "date_precision must be DAY/RANGE/MONTH/UNKNOWN.");
    }
    if (!STAGE_FORMATS.has(format)) {
      return fail(set, 400, "validation_error", "format must be online/offline/hybrid.");
    }
    if (body.starts_on !== undefined && body.starts_on !== null && !startsOn) {
      return fail(set, 400, "validation_error", "starts_on must be YYYY-MM-DD or null.");
    }
    if (body.ends_on !== undefined && body.ends_on !== null && !endsOn) {
      return fail(set, 400, "validation_error", "ends_on must be YYYY-MM-DD or null.");
    }
    if (
      body.registration_deadline !== undefined &&
      body.registration_deadline !== null &&
      !registrationDeadline
    ) {
      return fail(
        set,
        400,
        "validation_error",
        "registration_deadline must be YYYY-MM-DD or null."
      );
    }

    try {
      const rows = await sql`
        UPDATE stage_instances
        SET
          series_id = ${seriesId},
          stage_template_id = ${stageTemplateId},
          label = ${label ?? null},
          date_precision = ${datePrecision},
          starts_on = ${startsOn},
          ends_on = ${endsOn},
          registration_deadline = ${registrationDeadline},
          location_text = ${locationText ?? null},
          format = ${format},
          source_ref = ${sourceRef ?? null},
          is_seed = ${isSeed},
          updated_at = now()
        WHERE id = ${stageInstanceId}::uuid
        RETURNING *
      `;

      return { stage_instance: first(rows) };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_admin_stage_instance_patch_failed",
        "Failed to update stage instance."
      );
    }
  });

  app.get("/v2/admin/users", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can access this endpoint.");
    }

    const search = getString(query.search);
    const role = getString(query.role);
    const isActiveRaw = query.is_active === undefined ? null : getString(query.is_active);
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if (role !== null && !isUserRole(role)) {
      return fail(set, 400, "validation_error", "role must be student/teacher/admin.");
    }

    let isActive: boolean | null = null;
    if (isActiveRaw !== null) {
      if (isActiveRaw === "true") isActive = true;
      else if (isActiveRaw === "false") isActive = false;
      else return fail(set, 400, "validation_error", "is_active must be true/false.");
    }

    if (query.limit !== undefined && (limitRaw === null || limitRaw < 1)) {
      return fail(set, 400, "validation_error", "limit must be a positive integer.");
    }

    const limit = limitRaw ? Math.min(limitRaw, 300) : 150;

    try {
      const rows = await sql`
        SELECT
          id,
          name,
          email,
          role,
          school,
          grade,
          locale,
          is_active,
          created_at,
          updated_at
        FROM users
        WHERE
          (${role}::user_role IS NULL OR role = ${role})
          AND (${isActive}::boolean IS NULL OR is_active = ${isActive})
          AND (
            ${search}::text IS NULL
            OR name ILIKE ${search ? `%${search}%` : null}
            OR email ILIKE ${search ? `%${search}%` : null}
            OR COALESCE(school, '') ILIKE ${search ? `%${search}%` : null}
          )
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;

      return {
        filters: {
          search,
          role,
          is_active: isActive,
          limit,
        },
        items: rows,
      };
    } catch (error) {
      return failForDbError(set, error, "v2_admin_users_failed", "Failed to fetch users.");
    }
  });

  app.patch("/v2/admin/users/:id/role", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can update user roles.");
    }

    const userId = getInteger(params.id);
    if (!userId || userId < 1) {
      return fail(set, 400, "validation_error", "Invalid user id.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const role = getString(body.role);
    if (!role || !isUserRole(role)) {
      return fail(set, 400, "validation_error", "role must be student/teacher/admin.");
    }

    try {
      const rows = await sql`
        UPDATE users
        SET role = ${role}, updated_at = now()
        WHERE id = ${userId}
        RETURNING
          id,
          name,
          email,
          role,
          school,
          grade,
          locale,
          is_active,
          created_at,
          updated_at
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return { user: updated };
    } catch (error) {
      return failForDbError(set, error, "v2_admin_user_role_failed", "Failed to update user role.");
    }
  });

  app.patch("/v2/admin/users/:id/active", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) return fail(set, 401, "unauthorized", "Unauthorized.");
    if (!requireRole(user, ["admin"], set)) {
      return fail(set, 403, "forbidden", "Only admins can update active state.");
    }

    const userId = getInteger(params.id);
    if (!userId || userId < 1) {
      return fail(set, 400, "validation_error", "Invalid user id.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const isActive = getBoolean(body.is_active);
    if (isActive === null) {
      return fail(set, 400, "validation_error", "is_active must be boolean.");
    }

    try {
      const rows = await sql`
        UPDATE users
        SET is_active = ${isActive}, updated_at = now()
        WHERE id = ${userId}
        RETURNING
          id,
          name,
          email,
          role,
          school,
          grade,
          locale,
          is_active,
          created_at,
          updated_at
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "User not found.");
      }

      return { user: updated };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_admin_user_active_failed",
        "Failed to update user active state."
      );
    }
  });
};
