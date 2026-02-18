import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import {
  getDateString,
  getInteger,
  getNullableString,
  getString,
  getUuidString,
  isGoalPeriod,
  isPrepType,
  isRecord,
} from "../validation";

export const registerPrepRoutes = (app: Elysia) => {
  app.post("/prep-activities", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can add prep activities.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const stageId =
      body.stage_id === undefined || body.stage_id === null
        ? null
        : getInteger(body.stage_id);
    const date = getDateString(body.date);
    const durationMinutes = getInteger(body.duration_minutes);
    const typeRaw = getString(body.type);
    const topic = getString(body.topic);
    const materialsUrl = getNullableString(body.materials_url);
    const materialObjectId =
      body.material_object_id === undefined || body.material_object_id === null
        ? null
        : getUuidString(body.material_object_id);

    if (!date || !durationMinutes || !typeRaw || !isPrepType(typeRaw) || !topic) {
      return fail(set, 400, "validation_error", "Missing required prep activity fields.");
    }
    if (durationMinutes <= 0) {
      return fail(set, 400, "validation_error", "duration_minutes must be > 0.");
    }
    if (body.stage_id !== undefined && body.stage_id !== null && stageId === null) {
      return fail(set, 400, "validation_error", "stage_id must be integer or null.");
    }
    if (body.materials_url !== undefined && materialsUrl === undefined) {
      return fail(set, 400, "validation_error", "materials_url must be string or null.");
    }
    if (
      body.material_object_id !== undefined &&
      body.material_object_id !== null &&
      !materialObjectId
    ) {
      return fail(set, 400, "validation_error", "material_object_id must be UUID or null.");
    }

    try {
      const rows = await sql`
        INSERT INTO prep_activities (
          student_id, stage_id, date, duration_minutes, type, topic, materials_url, material_object_id
        )
        VALUES (
          ${user.id},
          ${stageId},
          ${date},
          ${durationMinutes},
          ${typeRaw},
          ${topic},
          ${materialsUrl ?? null},
          ${materialObjectId}
        )
        RETURNING *
      `;
      return { activity: first(rows) };
    } catch {
      return fail(set, 500, "prep_activity_failed", "Failed to create prep activity.");
    }
  });

  app.get("/prep-activities/me", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view prep activities.");
    }

    const fromDate = query.from ? getDateString(query.from) : null;
    const toDate = query.to ? getDateString(query.to) : null;
    if ((query.from && !fromDate) || (query.to && !toDate)) {
      return fail(set, 400, "validation_error", "from/to must be YYYY-MM-DD.");
    }

    try {
      const rows = await sql`
        SELECT *
        FROM prep_activities
        WHERE student_id = ${user.id}
          AND (${fromDate}::date IS NULL OR date >= ${fromDate})
          AND (${toDate}::date IS NULL OR date <= ${toDate})
        ORDER BY date DESC, id DESC
      `;
      return { items: rows };
    } catch {
      return fail(set, 500, "prep_activities_failed", "Failed to fetch prep activities.");
    }
  });

  app.put("/prep-goals/me", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can update prep goals.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const periodRaw = getString(body.period);
    const periodStart = getDateString(body.period_start);
    const targetMinutes = getInteger(body.target_minutes);
    const targetProblems = getInteger(body.target_problems);
    const targetMockExams = getInteger(body.target_mock_exams);

    if (!periodRaw || !isGoalPeriod(periodRaw) || !periodStart) {
      return fail(set, 400, "validation_error", "period and period_start are required.");
    }
    if (
      targetMinutes === null ||
      targetProblems === null ||
      targetMockExams === null ||
      targetMinutes < 0 ||
      targetProblems < 0 ||
      targetMockExams < 0
    ) {
      return fail(set, 400, "validation_error", "Goal targets must be non-negative integers.");
    }

    try {
      const rows = await sql`
        INSERT INTO prep_goals (
          student_id, period, period_start, target_minutes, target_problems, target_mock_exams
        )
        VALUES (
          ${user.id},
          ${periodRaw},
          ${periodStart},
          ${targetMinutes},
          ${targetProblems},
          ${targetMockExams}
        )
        ON CONFLICT (student_id, period, period_start)
        DO UPDATE SET
          target_minutes = EXCLUDED.target_minutes,
          target_problems = EXCLUDED.target_problems,
          target_mock_exams = EXCLUDED.target_mock_exams
        RETURNING *
      `;
      return { goal: first(rows) };
    } catch {
      return fail(set, 500, "prep_goal_failed", "Failed to upsert prep goal.");
    }
  });

  app.get("/prep-goals/me", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!requireRole(user, ["student"], set)) {
      return fail(set, 403, "forbidden", "Only students can view prep goals.");
    }

    const periodRaw = query.period ? getString(query.period) : null;
    if (periodRaw !== null && !isGoalPeriod(periodRaw)) {
      return fail(set, 400, "validation_error", "period must be week or month.");
    }

    try {
      const rows = await sql`
        SELECT *
        FROM prep_goals
        WHERE student_id = ${user.id}
          AND (${periodRaw}::goal_period IS NULL OR period = ${periodRaw})
        ORDER BY period_start DESC
      `;
      return { items: rows };
    } catch {
      return fail(set, 500, "prep_goals_failed", "Failed to fetch prep goals.");
    }
  });
};
