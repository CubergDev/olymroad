import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import {
  getInteger,
  getNumber,
  getNullableInteger,
  getNullableString,
  getString,
  isRecord,
  isRegistrationStatus,
  isResultStatus,
  normalizeChecklist,
  registrationTransitionMap,
} from "../validation";
import type { RegistrationStatus } from "../types";
import { getCurrentDateInConfiguredOffset } from "../time";

export const registerRoadmapRegistrationResultRoutes = (app: Elysia) => {
  app.get("/roadmap", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student", "teacher", "admin"], set)) {
      return fail(set, 403, "forbidden", "Forbidden.");
    }

    const subjectId = getInteger(query.subject);
    const levelId = getInteger(query.level);
    const monthFilter = getInteger(query.month);
    const yearFilter = getInteger(query.year);
    const formatRaw = getString(query.format);
    const registrationStatusRaw = getString(query.registration_status);
    const deadlineSoon = query.deadline_soon === "true";

    if (query.subject !== undefined && subjectId === null) {
      return fail(set, 400, "validation_error", "subject must be integer.");
    }
    if (query.level !== undefined && levelId === null) {
      return fail(set, 400, "validation_error", "level must be integer.");
    }
    if (
      query.month !== undefined &&
      (monthFilter === null || monthFilter < 1 || monthFilter > 12)
    ) {
      return fail(set, 400, "validation_error", "month must be between 1 and 12.");
    }
    if (
      query.year !== undefined &&
      (yearFilter === null || yearFilter < 2000 || yearFilter > 3000)
    ) {
      return fail(set, 400, "validation_error", "year must be valid.");
    }
    if (formatRaw !== null && formatRaw !== "online" && formatRaw !== "offline" && formatRaw !== "mixed") {
      return fail(set, 400, "validation_error", "format must be online/offline/mixed.");
    }

    const registrationStatusFilter =
      user.role === "student" &&
      registrationStatusRaw &&
      isRegistrationStatus(registrationStatusRaw)
        ? registrationStatusRaw
        : null;
    const todayLocal = getCurrentDateInConfiguredOffset();
    const canViewUnpublished = user.role === "admin";

    if (
      user.role === "student" &&
      registrationStatusRaw !== null &&
      registrationStatusFilter === null
    ) {
      return fail(set, 400, "validation_error", "registration_status is invalid.");
    }

    try {
      const rows = await sql`
        SELECT
          s.id AS stage_id,
          s.name AS stage_name,
          s.date_start,
          s.date_end,
          s.registration_deadline,
          s.location,
          s.online_link,
          s.status AS stage_status,
          s.checklist_json,
          o.id AS olympiad_id,
          o.title AS olympiad_title,
          o.format,
          o.season,
          o.status AS olympiad_status,
          o.organizer,
          o.rules_url,
          sub.id AS subject_id,
          sub.code AS subject_code,
          sub.name_ru AS subject_name_ru,
          sub.name_kz AS subject_name_kz,
          lvl.id AS level_id,
          lvl.code AS level_code,
          lvl.name_ru AS level_name_ru,
          lvl.name_kz AS level_name_kz,
          reg.id AS region_id,
          reg.code AS region_code,
          reg.name_ru AS region_name_ru,
          reg.name_kz AS region_name_kz,
          r.status AS registration_status
        FROM stages s
        INNER JOIN olympiads o ON o.id = s.olympiad_id
        INNER JOIN subjects sub ON sub.id = o.subject_id
        INNER JOIN levels lvl ON lvl.id = o.level_id
        LEFT JOIN regions reg ON reg.id = o.region_id
        LEFT JOIN registrations r ON r.stage_id = s.id AND r.student_id = ${user.role === "student" ? user.id : null}
        WHERE
          (${canViewUnpublished}::boolean = TRUE OR (s.status = 'published' AND o.status = 'published'))
          AND
          (${subjectId}::bigint IS NULL OR o.subject_id = ${subjectId})
          AND (${levelId}::bigint IS NULL OR o.level_id = ${levelId})
          AND (${formatRaw}::olympiad_format IS NULL OR o.format = ${formatRaw})
          AND (${yearFilter}::int IS NULL OR EXTRACT(YEAR FROM s.date_start) = ${yearFilter})
          AND (${monthFilter}::int IS NULL OR EXTRACT(MONTH FROM s.date_start) = ${monthFilter})
          AND (
            ${deadlineSoon}::boolean = FALSE
            OR s.registration_deadline BETWEEN ${todayLocal}::date AND (${todayLocal}::date + INTERVAL '14 days')
          )
          AND (${registrationStatusFilter}::registration_status IS NULL OR r.status = ${registrationStatusFilter})
        ORDER BY s.registration_deadline ASC, s.date_start ASC
      `;

      return {
        filters: {
          subject: subjectId,
          level: levelId,
          format: formatRaw,
          month: monthFilter,
          year: yearFilter,
          deadline_soon: deadlineSoon,
          registration_status: registrationStatusFilter,
        },
        items: rows,
      };
    } catch {
      return fail(set, 500, "roadmap_failed", "Failed to fetch roadmap.");
    }
  });

  app.get("/stages/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const stageId = getInteger(params.id);
    const canViewUnpublished = user.role === "admin";
    if (!stageId) {
      return fail(set, 400, "validation_error", "Invalid stage id.");
    }

    try {
      const rows = await sql`
        SELECT
          s.id AS stage_id,
          s.name AS stage_name,
          s.date_start,
          s.date_end,
          s.registration_deadline,
          s.location,
          s.online_link,
          s.status AS stage_status,
          s.checklist_json,
          o.id AS olympiad_id,
          o.title AS olympiad_title,
          o.format,
          o.season,
          o.status AS olympiad_status,
          o.organizer,
          o.rules_url,
          sub.id AS subject_id,
          sub.code AS subject_code,
          sub.name_ru AS subject_name_ru,
          sub.name_kz AS subject_name_kz,
          lvl.id AS level_id,
          lvl.code AS level_code,
          lvl.name_ru AS level_name_ru,
          lvl.name_kz AS level_name_kz,
          reg.id AS region_id,
          reg.code AS region_code,
          reg.name_ru AS region_name_ru,
          reg.name_kz AS region_name_kz,
          r.status AS registration_status
        FROM stages s
        INNER JOIN olympiads o ON o.id = s.olympiad_id
        INNER JOIN subjects sub ON sub.id = o.subject_id
        INNER JOIN levels lvl ON lvl.id = o.level_id
        LEFT JOIN regions reg ON reg.id = o.region_id
        LEFT JOIN registrations r ON r.stage_id = s.id AND r.student_id = ${user.role === "student" ? user.id : null}
        WHERE s.id = ${stageId}
          AND (${canViewUnpublished}::boolean = TRUE OR (s.status = 'published' AND o.status = 'published'))
        LIMIT 1
      `;
      const stage = first<Record<string, unknown>>(rows);
      if (!stage) {
        return fail(set, 404, "not_found", "Stage not found.");
      }

      return {
        ...stage,
        checklist: normalizeChecklist(stage.checklist_json),
      };
    } catch {
      return fail(set, 500, "stage_fetch_failed", "Failed to fetch stage.");
    }
  });

  app.post("/stages/:id/register", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can register.");
    }

    const stageId = getInteger(params.id);
    if (!stageId) {
      return fail(set, 400, "validation_error", "Invalid stage id.");
    }

    try {
      const todayLocal = getCurrentDateInConfiguredOffset();
      const result = await sql.begin(async (transaction) => {
        const stageRows = await transaction`
          SELECT id, registration_deadline
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        const stage = first<{ id: number; registration_deadline: string }>(stageRows);
        if (!stage) return { kind: "not_found" as const };

        if (stage.registration_deadline < todayLocal) {
          return { kind: "deadline_passed" as const };
        }

        const rows = await transaction`
          SELECT id, status, created_at, updated_at
          FROM registrations
          WHERE student_id = ${user.id} AND stage_id = ${stageId}
          LIMIT 1
        `;
        const existing = first<{ id: number; status: RegistrationStatus }>(rows);

        if (!existing) {
          const inserted = await transaction`
            INSERT INTO registrations (student_id, stage_id, status)
            VALUES (${user.id}, ${stageId}, 'registered')
            RETURNING id, student_id, stage_id, status, created_at, updated_at
          `;
          return { kind: "ok" as const, registration: first(inserted) };
        }

        if (existing.status === "planned") {
          const updated = await transaction`
            UPDATE registrations
            SET status = 'registered'
            WHERE id = ${existing.id}
            RETURNING id, student_id, stage_id, status, created_at, updated_at
          `;
          return { kind: "ok" as const, registration: first(updated) };
        }
        if (existing.status === "registered") {
          return { kind: "ok" as const, registration: existing };
        }

        return { kind: "invalid_transition" as const, currentStatus: existing.status };
      });

      if (result.kind === "not_found") {
        return fail(set, 404, "not_found", "Stage not found.");
      }
      if (result.kind === "deadline_passed") {
        return fail(set, 409, "deadline_passed", "Registration deadline has passed.");
      }
      if (result.kind === "invalid_transition") {
        return fail(
          set,
          409,
          "invalid_transition",
          `Cannot register from status ${result.currentStatus}.`
        );
      }
      return { registration: result.registration };
    } catch {
      return fail(set, 500, "registration_failed", "Failed to register to stage.");
    }
  });

  app.patch("/stages/:id/status", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can update registration status.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const stageId = getInteger(params.id);
    const nextStatusRaw = getString(body.status);
    if (!stageId || !nextStatusRaw || !isRegistrationStatus(nextStatusRaw)) {
      return fail(set, 400, "validation_error", "Valid stage id and status are required.");
    }

    try {
      const rows = await sql`
        SELECT id, status, created_at, updated_at
        FROM registrations
        WHERE student_id = ${user.id} AND stage_id = ${stageId}
        LIMIT 1
      `;
      const registration = first<{ id: number; status: RegistrationStatus }>(rows);
      if (!registration) {
        return fail(set, 404, "not_found", "Registration not found for this stage.");
      }
      if (registration.status === nextStatusRaw) {
        return { registration };
      }

      if (
        registration.status === "result_added" ||
        registrationTransitionMap[
          registration.status as Exclude<RegistrationStatus, "result_added">
        ] !== nextStatusRaw
      ) {
        return fail(
          set,
          409,
          "invalid_transition",
          `Invalid status transition from ${registration.status} to ${nextStatusRaw}.`
        );
      }

      const updatedRows = await sql`
        UPDATE registrations
        SET status = ${nextStatusRaw}
        WHERE id = ${registration.id}
        RETURNING id, student_id, stage_id, status, created_at, updated_at
      `;
      return { registration: first(updatedRows) };
    } catch {
      return fail(set, 500, "registration_status_failed", "Failed to update registration status.");
    }
  });

  app.get("/registrations/me", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view registrations.");
    }

    try {
      const rows = await sql`
        SELECT
          r.id,
          r.status,
          r.created_at,
          r.updated_at,
          s.id AS stage_id,
          s.name AS stage_name,
          s.registration_deadline,
          s.date_start,
          s.date_end,
          o.id AS olympiad_id,
          o.title AS olympiad_title,
          o.season
        FROM registrations r
        INNER JOIN stages s ON s.id = r.stage_id
        INNER JOIN olympiads o ON o.id = s.olympiad_id
        WHERE r.student_id = ${user.id}
        ORDER BY s.registration_deadline ASC
      `;
      return { items: rows };
    } catch {
      return fail(set, 500, "registrations_failed", "Failed to fetch registrations.");
    }
  });

  app.post("/stages/:id/results", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can add results.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const stageId = getInteger(params.id);
    const score = getNumber(body.score);
    const place = getNullableInteger(body.place);
    const statusRaw = getString(body.status);
    const comment = getNullableString(body.comment);

    if (!stageId || score === null || !statusRaw || !isResultStatus(statusRaw)) {
      return fail(set, 400, "validation_error", "Missing required result fields.");
    }
    if (body.place !== undefined && place === undefined) {
      return fail(set, 400, "validation_error", "place must be an integer or null.");
    }
    if (body.comment !== undefined && comment === undefined) {
      return fail(set, 400, "validation_error", "comment must be a string or null.");
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const stageRows = await transaction`
          SELECT id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        if (!first(stageRows)) return { kind: "not_found" as const };

        const resultRows = await transaction`
          INSERT INTO results (student_id, stage_id, score, place, status, comment)
          VALUES (${user.id}, ${stageId}, ${score}, ${place}, ${statusRaw}, ${comment ?? null})
          ON CONFLICT (student_id, stage_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            place = EXCLUDED.place,
            status = EXCLUDED.status,
            comment = EXCLUDED.comment
          RETURNING id, student_id, stage_id, score, place, status, comment, created_at
        `;
        const savedResult = first(resultRows);

        const registrationRows = await transaction`
          INSERT INTO registrations (student_id, stage_id, status)
          VALUES (${user.id}, ${stageId}, 'result_added')
          ON CONFLICT (student_id, stage_id)
          DO UPDATE SET status = 'result_added'
          RETURNING id, student_id, stage_id, status, created_at, updated_at
        `;
        const registration = first(registrationRows);

        return { kind: "ok" as const, result: savedResult, registration };
      });

      if (result.kind === "not_found") {
        return fail(set, 404, "not_found", "Stage not found.");
      }

      return { result: result.result, registration: result.registration };
    } catch {
      return fail(set, 500, "result_failed", "Failed to save result.");
    }
  });
};
