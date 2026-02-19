import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { dbErrorCode, first, sql } from "../db";
import { fail, failForDbError } from "../http";
import {
  getDateString,
  getInteger,
  getNullableString,
  getNumber,
  getString,
  getUuidString,
  isRecord,
  isResultStatus,
} from "../validation";

const PLAN_STATUSES = new Set([
  "PLANNED",
  "REGISTERED",
  "PARTICIPATED",
  "RESULT_ENTERED",
  "MISSED",
  "CANCELLED",
]);

const PREP_LOG_TYPES = new Set([
  "problems",
  "theory",
  "mock",
  "contest",
  "project",
  "other",
]);

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

const isPlanStatus = (value: string): boolean => PLAN_STATUSES.has(value);
const isPrepLogType = (value: string): boolean => PREP_LOG_TYPES.has(value);

const toPrepLogType = (value: string): string | null => {
  if (value === "mock_exam") {
    return "mock";
  }
  if (isPrepLogType(value)) {
    return value;
  }
  return null;
};

export const registerV2OlympiadPrepRoutes = (app: Elysia) => {
  app.get("/v2/roadmap", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student", "teacher", "admin"], set)) {
      return fail(set, 403, "forbidden", "Forbidden.");
    }

    const seriesId = getString(query.series_id);
    const subjectCode = getString(query.subject_code);
    const eventType = getString(query.event_type);
    const stageType = getString(query.stage_type);
    const fromDate = query.from ? getDateString(query.from) : null;
    const toDate = query.to ? getDateString(query.to) : null;
    const deadlineSoon = query.deadline_soon === "true";
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if ((query.from !== undefined && !fromDate) || (query.to !== undefined && !toDate)) {
      return fail(set, 400, "validation_error", "from/to must be YYYY-MM-DD.");
    }
    if (eventType !== null && !EVENT_TYPES.has(eventType)) {
      return fail(
        set,
        400,
        "validation_error",
        "event_type must be olympiad/research_projects/contest_game/hackathon/camp/other."
      );
    }
    if (stageType !== null && !STAGE_TYPES.has(stageType)) {
      return fail(
        set,
        400,
        "validation_error",
        "stage_type must be selection/regional/final/submission/defense/training."
      );
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
          cs.event_type,
          cs.level AS series_level,
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
          ssp.status AS student_plan_status,
          ssp.external_registration_url,
          ssp.checklist_state,
          ssp.notes AS student_notes,
          ssp.planned_at,
          ssp.registered_at,
          sr.result_status,
          sr.score,
          sr.place_text,
          sr.comment AS result_comment,
          COALESCE(
            ARRAY(
              SELECT ss.subject_code
              FROM series_subjects ss
              WHERE ss.series_id = si.series_id
              ORDER BY ss.subject_code
            ),
            ARRAY[]::text[]
          ) AS subject_codes
        FROM stage_instances si
        INNER JOIN competition_series cs ON cs.id = si.series_id
        INNER JOIN stage_templates st ON st.id = si.stage_template_id
        LEFT JOIN student_stage_plans ssp
          ON ssp.stage_instance_id = si.id
         AND ssp.student_user_id = ${user.role === "student" ? user.id : null}
        LEFT JOIN stage_results sr
          ON sr.stage_instance_id = si.id
         AND sr.student_user_id = ${user.role === "student" ? user.id : null}
        WHERE
          (${seriesId}::text IS NULL OR si.series_id = ${seriesId})
          AND (${eventType}::event_type_enum IS NULL OR cs.event_type = ${eventType})
          AND (${stageType}::stage_type_enum IS NULL OR st.stage_type = ${stageType})
          AND (${fromDate}::date IS NULL OR si.starts_on >= ${fromDate})
          AND (${toDate}::date IS NULL OR si.starts_on <= ${toDate})
          AND (
            ${subjectCode}::text IS NULL
            OR EXISTS (
              SELECT 1
              FROM series_subjects ss
              WHERE ss.series_id = si.series_id
                AND ss.subject_code = ${subjectCode}
            )
          )
          AND (
            ${deadlineSoon}::boolean = FALSE
            OR (
              si.registration_deadline IS NOT NULL
              AND si.registration_deadline BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '14 days')
            )
          )
        ORDER BY si.registration_deadline NULLS LAST, si.starts_on NULLS LAST, si.created_at DESC
        LIMIT ${limit}
      `;

      return {
        filters: {
          series_id: seriesId,
          subject_code: subjectCode,
          event_type: eventType,
          stage_type: stageType,
          from: fromDate,
          to: toDate,
          deadline_soon: deadlineSoon,
          limit,
        },
        items: rows,
      };
    } catch (error) {
      return failForDbError(set, error, "v2_roadmap_failed", "Failed to fetch v2 roadmap.");
    }
  });

  app.get("/v2/stage-instances/:id", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const stageInstanceId = getUuidString(params.id);
    if (!stageInstanceId) {
      return fail(set, 400, "validation_error", "Invalid stage instance id.");
    }

    try {
      const stageRows = await sql`
        SELECT
          si.id,
          si.series_id,
          cs.name_ru AS series_name_ru,
          cs.name_kz AS series_name_kz,
          cs.abbr AS series_abbr,
          cs.event_type,
          cs.level AS series_level,
          st.id AS stage_template_id,
          st.name_ru AS stage_template_name_ru,
          st.name_kz AS stage_template_name_kz,
          st.stage_type,
          st.default_registration_method,
          ct.id AS checklist_template_id,
          ct.name_ru AS checklist_template_name_ru,
          ct.items AS checklist_items,
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
          si.updated_at,
          ssp.status AS student_plan_status,
          ssp.external_registration_url,
          ssp.checklist_state,
          ssp.notes AS student_notes,
          ssp.planned_at,
          ssp.registered_at,
          sr.result_status,
          sr.score,
          sr.place_text,
          sr.comment AS result_comment,
          COALESCE(
            ARRAY(
              SELECT ss.subject_code
              FROM series_subjects ss
              WHERE ss.series_id = si.series_id
              ORDER BY ss.subject_code
            ),
            ARRAY[]::text[]
          ) AS subject_codes
        FROM stage_instances si
        INNER JOIN competition_series cs ON cs.id = si.series_id
        INNER JOIN stage_templates st ON st.id = si.stage_template_id
        LEFT JOIN checklist_templates ct ON ct.id = st.checklist_template_id
        LEFT JOIN student_stage_plans ssp
          ON ssp.stage_instance_id = si.id
         AND ssp.student_user_id = ${user.role === "student" ? user.id : null}
        LEFT JOIN stage_results sr
          ON sr.stage_instance_id = si.id
         AND sr.student_user_id = ${user.role === "student" ? user.id : null}
        WHERE si.id = ${stageInstanceId}::uuid
        LIMIT 1
      `;
      const stage = first<Record<string, unknown>>(stageRows);
      if (!stage) {
        return fail(set, 404, "not_found", "Stage instance not found.");
      }

      const documentRows = await sql`
        SELECT
          d.id,
          d.doc_type,
          d.title_ru,
          d.title_kz,
          d.lang,
          d.url,
          d.note,
          d.series_id,
          d.stage_instance_id,
          d.created_at
        FROM documents d
        WHERE d.stage_instance_id = ${stageInstanceId}::uuid
           OR (d.stage_instance_id IS NULL AND d.series_id = ${stage.series_id as string})
        ORDER BY d.stage_instance_id NULLS LAST, d.created_at DESC
      `;

      let frameworkRows: Array<Record<string, unknown>> = [];
      try {
        frameworkRows = (await sql`
          SELECT
            tf.id,
            tf.subject_code,
            tf.name_ru,
            tf.name_kz,
            tf.description
          FROM series_topic_frameworks stf
          INNER JOIN topic_frameworks tf ON tf.id = stf.framework_id
          WHERE stf.series_id = ${stage.series_id as string}
          ORDER BY tf.name_ru
        `) as Array<Record<string, unknown>>;
      } catch (error) {
        if (dbErrorCode(error) !== "42P01") {
          throw error;
        }
        frameworkRows = (await sql`
          SELECT
            tf.id,
            tf.subject_code,
            tf.name_ru,
            tf.name_kz,
            tf.description
          FROM topic_frameworks tf
          WHERE EXISTS (
            SELECT 1
            FROM series_subjects ss
            WHERE ss.series_id = ${stage.series_id as string}
              AND ss.subject_code = tf.subject_code
          )
          ORDER BY tf.name_ru
        `) as Array<Record<string, unknown>>;
      }

      const frameworkIds = frameworkRows.map((row) => String((row as Record<string, unknown>).id));
      const topicRows =
        frameworkIds.length === 0
          ? []
          : await sql`
              SELECT
                t.id,
                t.framework_id,
                t.parent_id,
                t.name_ru,
                t.name_kz,
                t.tags,
                t.sort_order
              FROM topics t
              WHERE t.framework_id = ANY(${frameworkIds}::text[])
              ORDER BY t.framework_id, t.sort_order, t.name_ru
            `;

      return {
        ...stage,
        documents: documentRows,
        topic_frameworks: frameworkRows,
        topics: topicRows,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_stage_instance_fetch_failed",
        "Failed to fetch stage instance details."
      );
    }
  });

  app.post("/v2/stage-instances/:id/plan", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can update plan status.");
    }

    const stageInstanceId = getUuidString(params.id);
    if (!stageInstanceId) {
      return fail(set, 400, "validation_error", "Invalid stage instance id.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const statusRawInput = getString(body.status);
    if (body.status !== undefined && !statusRawInput) {
      return fail(set, 400, "validation_error", "status must be a non-empty string.");
    }
    const statusRaw = statusRawInput ?? "PLANNED";
    if (!isPlanStatus(statusRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "status must be PLANNED/REGISTERED/PARTICIPATED/RESULT_ENTERED/MISSED/CANCELLED."
      );
    }

    const externalRegistrationUrl = getNullableString(body.external_registration_url);
    if (body.external_registration_url !== undefined && externalRegistrationUrl === undefined) {
      return fail(
        set,
        400,
        "validation_error",
        "external_registration_url must be string or null."
      );
    }

    const notes = getNullableString(body.notes);
    if (body.notes !== undefined && notes === undefined) {
      return fail(set, 400, "validation_error", "notes must be string or null.");
    }

    let checklistState: Record<string, unknown> = {};
    if (body.checklist_state !== undefined) {
      if (body.checklist_state === null) {
        checklistState = {};
      } else if (!isRecord(body.checklist_state)) {
        return fail(set, 400, "validation_error", "checklist_state must be object or null.");
      } else {
        checklistState = body.checklist_state;
      }
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const stageRows = await transaction`
          SELECT id
          FROM stage_instances
          WHERE id = ${stageInstanceId}::uuid
          LIMIT 1
        `;
        if (!first(stageRows)) {
          return { kind: "stage_not_found" as const };
        }

        const planRows = await transaction`
          INSERT INTO student_stage_plans (
            student_user_id,
            stage_instance_id,
            status,
            planned_at,
            registered_at,
            external_registration_url,
            checklist_state,
            notes
          )
          VALUES (
            ${user.id},
            ${stageInstanceId}::uuid,
            ${statusRaw}::student_stage_status_enum,
            now(),
            CASE
              WHEN ${statusRaw} IN ('REGISTERED', 'PARTICIPATED', 'RESULT_ENTERED')
                THEN now()
              ELSE NULL
            END,
            ${externalRegistrationUrl ?? null},
            ${JSON.stringify(checklistState)}::jsonb,
            ${notes ?? null}
          )
          ON CONFLICT (student_user_id, stage_instance_id)
          DO UPDATE SET
            status = EXCLUDED.status,
            registered_at = CASE
              WHEN EXCLUDED.status IN ('REGISTERED', 'PARTICIPATED', 'RESULT_ENTERED')
                THEN COALESCE(student_stage_plans.registered_at, now())
              ELSE student_stage_plans.registered_at
            END,
            external_registration_url = EXCLUDED.external_registration_url,
            checklist_state = EXCLUDED.checklist_state,
            notes = EXCLUDED.notes
          RETURNING *
        `;

        return {
          kind: "ok" as const,
          plan: first(planRows),
        };
      });

      if (result.kind === "stage_not_found") {
        return fail(set, 404, "not_found", "Stage instance not found.");
      }

      return { plan: result.plan };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_stage_plan_failed",
        "Failed to upsert stage plan status."
      );
    }
  });

  app.post("/v2/stage-instances/:id/results", async ({ headers, params, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can submit results.");
    }

    const stageInstanceId = getUuidString(params.id);
    if (!stageInstanceId) {
      return fail(set, 400, "validation_error", "Invalid stage instance id.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const resultStatusRaw = getString(body.result_status);
    const score = body.score === undefined || body.score === null ? null : getNumber(body.score);
    const placeText = getNullableString(body.place_text);
    const comment = getNullableString(body.comment);

    if (!resultStatusRaw || !isResultStatus(resultStatusRaw)) {
      return fail(
        set,
        400,
        "validation_error",
        "result_status must be participant/prize_winner/winner."
      );
    }
    if (body.score !== undefined && body.score !== null && score === null) {
      return fail(set, 400, "validation_error", "score must be numeric or null.");
    }
    if (body.place_text !== undefined && placeText === undefined) {
      return fail(set, 400, "validation_error", "place_text must be string or null.");
    }
    if (body.comment !== undefined && comment === undefined) {
      return fail(set, 400, "validation_error", "comment must be string or null.");
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const stageRows = await transaction`
          SELECT id
          FROM stage_instances
          WHERE id = ${stageInstanceId}::uuid
          LIMIT 1
        `;
        if (!first(stageRows)) {
          return { kind: "stage_not_found" as const };
        }

        const resultRows = await transaction`
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
            ${stageInstanceId}::uuid,
            ${resultStatusRaw},
            ${score},
            ${placeText ?? null},
            ${comment ?? null}
          )
          ON CONFLICT (student_user_id, stage_instance_id)
          DO UPDATE SET
            result_status = EXCLUDED.result_status,
            score = EXCLUDED.score,
            place_text = EXCLUDED.place_text,
            comment = EXCLUDED.comment
          RETURNING *
        `;

        const planRows = await transaction`
          INSERT INTO student_stage_plans (
            student_user_id,
            stage_instance_id,
            status,
            planned_at,
            registered_at
          )
          VALUES (
            ${user.id},
            ${stageInstanceId}::uuid,
            'RESULT_ENTERED'::student_stage_status_enum,
            now(),
            now()
          )
          ON CONFLICT (student_user_id, stage_instance_id)
          DO UPDATE SET
            status = 'RESULT_ENTERED'::student_stage_status_enum,
            registered_at = COALESCE(student_stage_plans.registered_at, now())
          RETURNING *
        `;

        return {
          kind: "ok" as const,
          result: first(resultRows),
          plan: first(planRows),
        };
      });

      if (result.kind === "stage_not_found") {
        return fail(set, 404, "not_found", "Stage instance not found.");
      }

      return { result: result.result, plan: result.plan };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_stage_result_failed",
        "Failed to upsert stage result."
      );
    }
  });

  app.get("/v2/prep/topics", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student", "teacher", "admin"], set)) {
      return fail(set, 403, "forbidden", "Forbidden.");
    }

    const subjectCode = getString(query.subject_code);
    const seriesId = getString(query.series_id);
    const frameworkId = getString(query.framework_id);
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if (query.limit !== undefined && (limitRaw === null || limitRaw < 1)) {
      return fail(set, 400, "validation_error", "limit must be a positive integer.");
    }

    const limit = limitRaw ? Math.min(limitRaw, 500) : 300;

    try {
      let frameworks: Array<Record<string, unknown>> = [];
      if (seriesId === null) {
        frameworks = (await sql`
          SELECT
            tf.id,
            tf.subject_code,
            tf.name_ru,
            tf.name_kz,
            tf.description
          FROM topic_frameworks tf
          WHERE
            (${subjectCode}::text IS NULL OR tf.subject_code = ${subjectCode})
            AND (${frameworkId}::text IS NULL OR tf.id = ${frameworkId})
          ORDER BY tf.name_ru
          LIMIT ${limit}
        `) as Array<Record<string, unknown>>;
      } else {
        try {
          frameworks = (await sql`
            SELECT
              tf.id,
              tf.subject_code,
              tf.name_ru,
              tf.name_kz,
              tf.description
            FROM topic_frameworks tf
            WHERE
              (${subjectCode}::text IS NULL OR tf.subject_code = ${subjectCode})
              AND (${frameworkId}::text IS NULL OR tf.id = ${frameworkId})
              AND EXISTS (
                SELECT 1
                FROM series_topic_frameworks stf
                WHERE stf.framework_id = tf.id
                  AND stf.series_id = ${seriesId}
              )
            ORDER BY tf.name_ru
            LIMIT ${limit}
          `) as Array<Record<string, unknown>>;
        } catch (error) {
          if (dbErrorCode(error) !== "42P01") {
            throw error;
          }
          frameworks = (await sql`
            SELECT
              tf.id,
              tf.subject_code,
              tf.name_ru,
              tf.name_kz,
              tf.description
            FROM topic_frameworks tf
            WHERE
              (${subjectCode}::text IS NULL OR tf.subject_code = ${subjectCode})
              AND (${frameworkId}::text IS NULL OR tf.id = ${frameworkId})
            ORDER BY tf.name_ru
            LIMIT ${limit}
          `) as Array<Record<string, unknown>>;
        }
      }

      const frameworkIds = frameworks.map((row) => String((row as Record<string, unknown>).id));
      const topics =
        frameworkIds.length === 0
          ? []
          : await sql`
              SELECT
                t.id,
                t.framework_id,
                t.parent_id,
                t.name_ru,
                t.name_kz,
                t.tags,
                t.sort_order
              FROM topics t
              WHERE t.framework_id = ANY(${frameworkIds}::text[])
              ORDER BY t.framework_id, t.sort_order, t.name_ru
            `;

      return {
        filters: {
          subject_code: subjectCode,
          series_id: seriesId,
          framework_id: frameworkId,
          limit,
        },
        topic_frameworks: frameworks,
        topics,
      };
    } catch (error) {
      try {
        const fallbackFrameworks = (await sql`
          SELECT
            tf.id,
            tf.subject_code,
            tf.name_ru,
            tf.name_kz,
            tf.description
          FROM topic_frameworks tf
          WHERE
            (${subjectCode}::text IS NULL OR tf.subject_code = ${subjectCode})
            AND (${frameworkId}::text IS NULL OR tf.id = ${frameworkId})
            AND (
              ${seriesId}::text IS NULL
              OR EXISTS (
                SELECT 1
                FROM series_subjects ss
                WHERE ss.series_id = ${seriesId}
                  AND ss.subject_code = tf.subject_code
              )
            )
          ORDER BY tf.name_ru
          LIMIT ${limit}
        `) as Array<Record<string, unknown>>;

        const fallbackFrameworkIds = fallbackFrameworks.map((row) =>
          String((row as Record<string, unknown>).id)
        );
        const fallbackTopics =
          fallbackFrameworkIds.length === 0
            ? []
            : await sql`
                SELECT
                  t.id,
                  t.framework_id,
                  t.parent_id,
                  t.name_ru,
                  t.name_kz,
                  t.tags,
                  t.sort_order
                FROM topics t
                WHERE t.framework_id = ANY(${fallbackFrameworkIds}::text[])
                ORDER BY t.framework_id, t.sort_order, t.name_ru
              `;

        return {
          filters: {
            subject_code: subjectCode,
            series_id: seriesId,
            framework_id: frameworkId,
            limit,
          },
          topic_frameworks: fallbackFrameworks,
          topics: fallbackTopics,
        };
      } catch (fallbackError) {
        return failForDbError(
          set,
          fallbackError,
          "v2_prep_topics_failed",
          "Failed to fetch prep topic catalog."
        );
      }
    }
  });

  app.get("/v2/prep/logs/me", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view prep logs.");
    }

    const fromDate = query.from ? getDateString(query.from) : null;
    const toDate = query.to ? getDateString(query.to) : null;
    const limitRaw = query.limit === undefined ? null : getInteger(query.limit);

    if ((query.from !== undefined && !fromDate) || (query.to !== undefined && !toDate)) {
      return fail(set, 400, "validation_error", "from/to must be YYYY-MM-DD.");
    }
    if (query.limit !== undefined && (limitRaw === null || limitRaw < 1)) {
      return fail(set, 400, "validation_error", "limit must be a positive integer.");
    }

    const limit = limitRaw ? Math.min(limitRaw, 500) : 200;

    try {
      const rows = await sql`
        SELECT
          p.id,
          p.happened_on,
          p.minutes,
          p.log_type,
          p.note,
          p.resource_url,
          p.stage_instance_id,
          p.created_at,
          si.series_id,
          si.label AS stage_label,
          si.starts_on AS stage_starts_on,
          COALESCE(
            json_agg(
              json_build_object(
                'id', t.id,
                'framework_id', t.framework_id,
                'name_ru', t.name_ru,
                'name_kz', t.name_kz
              )
            ) FILTER (WHERE t.id IS NOT NULL),
            '[]'::json
          ) AS topics
        FROM prep_logs p
        LEFT JOIN stage_instances si ON si.id = p.stage_instance_id
        LEFT JOIN prep_log_topics plt ON plt.prep_log_id = p.id
        LEFT JOIN topics t ON t.id = plt.topic_id
        WHERE p.student_user_id = ${user.id}
          AND (${fromDate}::date IS NULL OR p.happened_on >= ${fromDate})
          AND (${toDate}::date IS NULL OR p.happened_on <= ${toDate})
        GROUP BY p.id, si.series_id, si.label, si.starts_on
        ORDER BY p.happened_on DESC, p.created_at DESC
        LIMIT ${limit}
      `;

      return {
        filters: {
          from: fromDate,
          to: toDate,
          limit,
        },
        items: rows,
      };
    } catch (error) {
      return failForDbError(set, error, "v2_prep_logs_failed", "Failed to fetch prep logs.");
    }
  });

  app.post("/v2/prep/logs", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can add prep logs.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const happenedOn = getDateString(body.happened_on ?? body.date);
    const minutes = getInteger(body.minutes ?? body.duration_minutes);
    const logTypeRaw = getString(body.log_type ?? body.type);
    const logType = logTypeRaw ? toPrepLogType(logTypeRaw) : null;
    const note = getNullableString(body.note ?? body.topic);
    const resourceUrl = getNullableString(body.resource_url ?? body.materials_url);
    const stageInstanceId =
      body.stage_instance_id === undefined || body.stage_instance_id === null
        ? null
        : getUuidString(body.stage_instance_id);

    if (!happenedOn || minutes === null || minutes < 0 || !logType) {
      return fail(
        set,
        400,
        "validation_error",
        "happened_on, minutes, and log_type are required."
      );
    }
    if (
      body.stage_instance_id !== undefined &&
      body.stage_instance_id !== null &&
      !stageInstanceId
    ) {
      return fail(set, 400, "validation_error", "stage_instance_id must be UUID or null.");
    }
    if (body.note !== undefined && note === undefined) {
      return fail(set, 400, "validation_error", "note must be string or null.");
    }
    if (body.resource_url !== undefined && resourceUrl === undefined) {
      return fail(set, 400, "validation_error", "resource_url must be string or null.");
    }

    const topicIdsRaw = body.topic_ids;
    const topicIds: string[] = [];
    if (topicIdsRaw !== undefined) {
      if (!Array.isArray(topicIdsRaw)) {
        return fail(set, 400, "validation_error", "topic_ids must be an array of strings.");
      }
      for (const topicIdRaw of topicIdsRaw) {
        const topicId = getString(topicIdRaw);
        if (!topicId) {
          return fail(set, 400, "validation_error", "topic_ids must contain non-empty strings.");
        }
        topicIds.push(topicId);
      }
    }
    const uniqueTopicIds = Array.from(new Set(topicIds));

    try {
      const result = await sql.begin(async (transaction) => {
        if (stageInstanceId !== null) {
          const stageRows = await transaction`
            SELECT id
            FROM stage_instances
            WHERE id = ${stageInstanceId}::uuid
            LIMIT 1
          `;
          if (!first(stageRows)) {
            return { kind: "stage_not_found" as const };
          }
        }

        if (uniqueTopicIds.length > 0) {
          const topicRows = await transaction`
            SELECT id
            FROM topics
            WHERE id = ANY(${uniqueTopicIds}::text[])
          `;
          const foundTopicIds = new Set(
            topicRows.map((row) => String((row as Record<string, unknown>).id))
          );
          if (foundTopicIds.size !== uniqueTopicIds.length) {
            return { kind: "topic_not_found" as const };
          }
        }

        const logRows = await transaction`
          INSERT INTO prep_logs (
            student_user_id,
            happened_on,
            minutes,
            log_type,
            note,
            resource_url,
            stage_instance_id
          )
          VALUES (
            ${user.id},
            ${happenedOn},
            ${minutes},
            ${logType},
            ${note ?? null},
            ${resourceUrl ?? null},
            ${stageInstanceId}
          )
          RETURNING *
        `;
        const prepLog = first(logRows);

        if (prepLog && uniqueTopicIds.length > 0) {
          for (const topicId of uniqueTopicIds) {
            await transaction`
              INSERT INTO prep_log_topics (prep_log_id, topic_id)
              VALUES (${(prepLog as Record<string, unknown>).id as string}::uuid, ${topicId})
              ON CONFLICT (prep_log_id, topic_id) DO NOTHING
            `;
          }
        }

        return {
          kind: "ok" as const,
          log: prepLog,
          topic_ids: uniqueTopicIds,
        };
      });

      if (result.kind === "stage_not_found") {
        return fail(set, 404, "not_found", "Stage instance not found.");
      }
      if (result.kind === "topic_not_found") {
        return fail(set, 404, "not_found", "One or more topics were not found.");
      }

      return {
        log: result.log,
        topic_ids: result.topic_ids,
      };
    } catch (error) {
      return failForDbError(set, error, "v2_prep_log_create_failed", "Failed to create prep log.");
    }
  });

  app.get("/v2/prep/analytics/me", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view prep analytics.");
    }

    const daysRaw = query.days === undefined ? null : getInteger(query.days);
    if (query.days !== undefined && (daysRaw === null || daysRaw < 1)) {
      return fail(set, 400, "validation_error", "days must be a positive integer.");
    }

    const days = daysRaw ? Math.min(daysRaw, 365) : 60;
    const sinceDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    try {
      const [summaryRows, byTypeRows, byDayRows, stageProgressRows, resultRows] = await Promise.all([
        sql`
          SELECT
            COUNT(*)::int AS sessions,
            COALESCE(SUM(minutes), 0)::int AS minutes,
            COALESCE(AVG(minutes), 0)::numeric AS avg_minutes
          FROM prep_logs
          WHERE student_user_id = ${user.id}
            AND happened_on >= ${sinceDate}
        `,
        sql`
          SELECT
            log_type,
            COUNT(*)::int AS sessions,
            COALESCE(SUM(minutes), 0)::int AS minutes
          FROM prep_logs
          WHERE student_user_id = ${user.id}
            AND happened_on >= ${sinceDate}
          GROUP BY log_type
          ORDER BY minutes DESC, log_type ASC
        `,
        sql`
          SELECT
            happened_on,
            COUNT(*)::int AS sessions,
            COALESCE(SUM(minutes), 0)::int AS minutes
          FROM prep_logs
          WHERE student_user_id = ${user.id}
            AND happened_on >= ${sinceDate}
          GROUP BY happened_on
          ORDER BY happened_on DESC
          LIMIT 90
        `,
        sql`
          SELECT
            status,
            COUNT(*)::int AS count
          FROM student_stage_plans
          WHERE student_user_id = ${user.id}
          GROUP BY status
          ORDER BY status
        `,
        sql`
          SELECT
            stage_instance_id,
            result_status,
            score,
            place_text,
            comment,
            created_at
          FROM stage_results
          WHERE student_user_id = ${user.id}
          ORDER BY created_at DESC
          LIMIT 15
        `,
      ]);

      return {
        days,
        since: sinceDate,
        summary: first(summaryRows) ?? {
          sessions: 0,
          minutes: 0,
          avg_minutes: 0,
        },
        by_type: byTypeRows,
        by_day: byDayRows,
        stage_progress: stageProgressRows,
        recent_results: resultRows,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "v2_prep_analytics_failed",
        "Failed to fetch prep analytics."
      );
    }
  });
};
