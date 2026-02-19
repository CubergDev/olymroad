import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import {
  getInteger,
  getNumber,
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

const registrationToPlanStatus = (
  status: RegistrationStatus
): "PLANNED" | "REGISTERED" | "PARTICIPATED" | "RESULT_ENTERED" => {
  if (status === "registered") return "REGISTERED";
  if (status === "participated") return "PARTICIPATED";
  if (status === "result_added") return "RESULT_ENTERED";
  return "PLANNED";
};

const syncStudentStagePlan = async (
  transaction: any,
  studentId: number,
  stageInstanceId: string | null,
  status: RegistrationStatus
) => {
  if (!stageInstanceId) {
    return;
  }

  await transaction`
    INSERT INTO student_stage_plans (
      student_user_id,
      stage_instance_id,
      status,
      planned_at,
      registered_at
    )
    VALUES (
      ${studentId},
      ${stageInstanceId}::uuid,
      ${registrationToPlanStatus(status)}::student_stage_status_enum,
      now(),
      CASE
        WHEN ${registrationToPlanStatus(status)} IN ('REGISTERED', 'PARTICIPATED', 'RESULT_ENTERED')
          THEN now()
        ELSE NULL
      END
    )
    ON CONFLICT (student_user_id, stage_instance_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      registered_at = CASE
        WHEN EXCLUDED.status IN ('REGISTERED', 'PARTICIPATED', 'RESULT_ENTERED')
          THEN now()
        ELSE student_stage_plans.registered_at
      END
  `;
};

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
    const eventTypeRaw = getString(query.event_type);
    const stageTypeRaw = getString(query.stage_type);
    const seriesIdRaw = getString(query.series_id);
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
    if (eventTypeRaw !== null && !EVENT_TYPES.has(eventTypeRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "event_type must be olympiad/research_projects/contest_game/hackathon/camp/other."
      );
    }
    if (stageTypeRaw !== null && !STAGE_TYPES.has(stageTypeRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "stage_type must be selection/regional/final/submission/defense/training."
      );
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
          s.date_precision,
          s.source_ref,
          s.stage_template_id,
          s.stage_instance_id,
          s.status AS stage_status,
          s.checklist_json,
          o.id AS olympiad_id,
          o.title AS olympiad_title,
          o.series_id,
          o.format,
          o.season,
          o.status AS olympiad_status,
          o.organizer,
          o.rules_url,
          cs.event_type,
          cs.level AS series_level,
          stt.stage_type,
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
          COALESCE(
            r.status,
            CASE sp.status
              WHEN 'PLANNED' THEN 'planned'
              WHEN 'REGISTERED' THEN 'registered'
              WHEN 'PARTICIPATED' THEN 'participated'
              WHEN 'RESULT_ENTERED' THEN 'result_added'
              ELSE NULL
            END
          ) AS registration_status
        FROM stages s
        INNER JOIN olympiads o ON o.id = s.olympiad_id
        LEFT JOIN competition_series cs ON cs.id = o.series_id
        LEFT JOIN stage_templates stt ON stt.id = s.stage_template_id
        INNER JOIN subjects sub ON sub.id = o.subject_id
        INNER JOIN levels lvl ON lvl.id = o.level_id
        LEFT JOIN regions reg ON reg.id = o.region_id
        LEFT JOIN registrations r ON r.stage_id = s.id AND r.student_id = ${user.role === "student" ? user.id : null}
        LEFT JOIN student_stage_plans sp
          ON sp.stage_instance_id = s.stage_instance_id
         AND sp.student_user_id = ${user.role === "student" ? user.id : null}
        WHERE
          (${canViewUnpublished}::boolean = TRUE OR (s.status = 'published' AND o.status = 'published'))
          AND
          (${subjectId}::bigint IS NULL OR o.subject_id = ${subjectId})
          AND (${levelId}::bigint IS NULL OR o.level_id = ${levelId})
          AND (${formatRaw}::olympiad_format IS NULL OR o.format = ${formatRaw})
          AND (${seriesIdRaw}::text IS NULL OR o.series_id = ${seriesIdRaw})
          AND (${eventTypeRaw}::event_type_enum IS NULL OR cs.event_type = ${eventTypeRaw})
          AND (${stageTypeRaw}::stage_type_enum IS NULL OR stt.stage_type = ${stageTypeRaw})
          AND (${yearFilter}::int IS NULL OR EXTRACT(YEAR FROM s.date_start) = ${yearFilter})
          AND (${monthFilter}::int IS NULL OR EXTRACT(MONTH FROM s.date_start) = ${monthFilter})
          AND (
            ${deadlineSoon}::boolean = FALSE
            OR s.registration_deadline BETWEEN ${todayLocal}::date AND (${todayLocal}::date + INTERVAL '14 days')
          )
          AND (
            ${registrationStatusFilter}::registration_status IS NULL
            OR COALESCE(
              r.status,
              CASE sp.status
                WHEN 'PLANNED' THEN 'planned'::registration_status
                WHEN 'REGISTERED' THEN 'registered'::registration_status
                WHEN 'PARTICIPATED' THEN 'participated'::registration_status
                WHEN 'RESULT_ENTERED' THEN 'result_added'::registration_status
                ELSE NULL
              END
            ) = ${registrationStatusFilter}
          )
        ORDER BY s.registration_deadline ASC, s.date_start ASC
      `;

      return {
        filters: {
          subject: subjectId,
          level: levelId,
          format: formatRaw,
          event_type: eventTypeRaw,
          stage_type: stageTypeRaw,
          series_id: seriesIdRaw,
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
          s.date_precision,
          s.source_ref,
          s.stage_template_id,
          s.stage_instance_id,
          s.status AS stage_status,
          s.checklist_json,
          o.id AS olympiad_id,
          o.title AS olympiad_title,
          o.series_id,
          o.format,
          o.season,
          o.status AS olympiad_status,
          o.organizer,
          o.rules_url,
          cs.event_type,
          cs.level AS series_level,
          stt.stage_type,
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
          COALESCE(
            r.status,
            CASE sp.status
              WHEN 'PLANNED' THEN 'planned'
              WHEN 'REGISTERED' THEN 'registered'
              WHEN 'PARTICIPATED' THEN 'participated'
              WHEN 'RESULT_ENTERED' THEN 'result_added'
              ELSE NULL
            END
          ) AS registration_status
        FROM stages s
        INNER JOIN olympiads o ON o.id = s.olympiad_id
        LEFT JOIN competition_series cs ON cs.id = o.series_id
        LEFT JOIN stage_templates stt ON stt.id = s.stage_template_id
        INNER JOIN subjects sub ON sub.id = o.subject_id
        INNER JOIN levels lvl ON lvl.id = o.level_id
        LEFT JOIN regions reg ON reg.id = o.region_id
        LEFT JOIN registrations r ON r.stage_id = s.id AND r.student_id = ${user.role === "student" ? user.id : null}
        LEFT JOIN student_stage_plans sp
          ON sp.stage_instance_id = s.stage_instance_id
         AND sp.student_user_id = ${user.role === "student" ? user.id : null}
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
          SELECT id, registration_deadline, stage_instance_id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        const stage = first<{
          id: number;
          registration_deadline: string;
          stage_instance_id: string | null;
        }>(stageRows);
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
          await syncStudentStagePlan(transaction, user.id, stage.stage_instance_id, "registered");
          return { kind: "ok" as const, registration: first(inserted) };
        }

        if (existing.status === "planned") {
          const updated = await transaction`
            UPDATE registrations
            SET status = 'registered'
            WHERE id = ${existing.id}
            RETURNING id, student_id, stage_id, status, created_at, updated_at
          `;
          await syncStudentStagePlan(transaction, user.id, stage.stage_instance_id, "registered");
          return { kind: "ok" as const, registration: first(updated) };
        }
        if (existing.status === "registered") {
          await syncStudentStagePlan(transaction, user.id, stage.stage_instance_id, "registered");
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
        const stageRows = await sql`
          SELECT stage_instance_id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        const stage = first<{ stage_instance_id: string | null }>(stageRows);
        await sql.begin(async (transaction) => {
          await syncStudentStagePlan(
            transaction,
            user.id,
            stage?.stage_instance_id ?? null,
            nextStatusRaw
          );
        });
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

      const result = await sql.begin(async (transaction) => {
        const updatedRows = await transaction`
          UPDATE registrations
          SET status = ${nextStatusRaw}
          WHERE id = ${registration.id}
          RETURNING id, student_id, stage_id, status, created_at, updated_at
        `;
        const updated = first(updatedRows);

        const stageRows = await transaction`
          SELECT stage_instance_id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        const stage = first<{ stage_instance_id: string | null }>(stageRows);
        await syncStudentStagePlan(
          transaction,
          user.id,
          stage?.stage_instance_id ?? null,
          nextStatusRaw
        );

        return updated;
      });

      return { registration: result };
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
    const place = body.place === null || body.place === undefined ? null : getInteger(body.place);
    const statusRaw = getString(body.status);
    const comment = getNullableString(body.comment);

    if (!stageId || score === null || !statusRaw || !isResultStatus(statusRaw)) {
      return fail(set, 400, "validation_error", "Missing required result fields.");
    }
    if (body.place !== undefined && body.place !== null && place === null) {
      return fail(set, 400, "validation_error", "place must be an integer or null.");
    }
    if (body.comment !== undefined && comment === undefined) {
      return fail(set, 400, "validation_error", "comment must be a string or null.");
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const stageRows = await transaction`
          SELECT id, stage_instance_id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        const stage = first<{ id: number; stage_instance_id: string | null }>(stageRows);
        if (!stage) return { kind: "not_found" as const };

        const resultRows = await transaction`
          INSERT INTO results (student_id, stage_id, stage_instance_id, score, place, place_text, status, comment)
          VALUES (
            ${user.id},
            ${stageId},
            ${stage.stage_instance_id},
            ${score},
            ${place},
            ${place === null ? null : String(place)},
            ${statusRaw},
            ${comment ?? null}
          )
          ON CONFLICT (student_id, stage_id)
          DO UPDATE SET
            stage_instance_id = EXCLUDED.stage_instance_id,
            score = EXCLUDED.score,
            place = EXCLUDED.place,
            place_text = EXCLUDED.place_text,
            status = EXCLUDED.status,
            comment = EXCLUDED.comment
          RETURNING id, student_id, stage_id, stage_instance_id, score, place, place_text, status, comment, created_at
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

        await syncStudentStagePlan(
          transaction,
          user.id,
          stage.stage_instance_id,
          "result_added"
        );

        if (stage.stage_instance_id) {
          await transaction`
            INSERT INTO stage_results (
              student_user_id,
              stage_instance_id,
              result_status,
              score,
              place_text,
              comment
            )
            VALUES (
              ${user.id},
              ${stage.stage_instance_id},
              ${statusRaw},
              ${score},
              ${place === null ? null : String(place)},
              ${comment ?? null}
            )
            ON CONFLICT (student_user_id, stage_instance_id)
            DO UPDATE SET
              result_status = EXCLUDED.result_status,
              score = EXCLUDED.score,
              place_text = EXCLUDED.place_text,
              comment = EXCLUDED.comment
          `;
        }

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
