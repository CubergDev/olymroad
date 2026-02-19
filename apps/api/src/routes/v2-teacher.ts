import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import {
  getDateString,
  getInteger,
  getNullableString,
  getString,
  isPlanStatus,
  isPrepType,
  isRecord,
} from "../validation";
import type { PlanStatus, PrepType } from "../types";
import {
  getCurrentDateInConfiguredOffset,
  getDateDaysAgoInConfiguredOffset,
} from "../time";

type PlanItemInput = {
  itemType: PrepType;
  topic: string;
  targetCount: number;
  notes: string | null;
};

type TeacherNotificationType =
  | "deadline_soon"
  | "new_comment"
  | "result_added"
  | "reminder";

const TEACHER_NOTIFICATION_TYPES: TeacherNotificationType[] = [
  "deadline_soon",
  "new_comment",
  "result_added",
  "reminder",
];

const TEACHER_ROUTE_PREFIXES = ["/teacher", "/v2/teacher"] as const;

const ensureTeacher = async (
  authorization: string | undefined,
  set: { status?: number }
) => {
  const user = await requireUser(authorization, set);
  if (!user) {
    return null;
  }
  if (!requireRole(user, ["teacher"], set)) {
    return null;
  }
  return user;
};

const parsePlanItems = (value: unknown): { items: PlanItemInput[] } | { error: string } => {
  if (!Array.isArray(value)) {
    return { error: "items must be an array." };
  }

  const items: PlanItemInput[] = [];
  for (const rawItem of value) {
    if (!isRecord(rawItem)) {
      return { error: "Each plan item must be an object." };
    }

    const itemTypeRaw = getString(rawItem.item_type);
    const topic = getString(rawItem.topic);
    const targetCount = getInteger(rawItem.target_count);
    const notes = getNullableString(rawItem.notes);

    if (!itemTypeRaw || !isPrepType(itemTypeRaw)) {
      return { error: "item_type must be theory/problems/mock_exam." };
    }
    if (!topic) {
      return { error: "topic is required for each plan item." };
    }
    if (!targetCount || targetCount <= 0) {
      return { error: "target_count must be a positive integer." };
    }
    if (rawItem.notes !== undefined && notes === undefined) {
      return { error: "notes must be a string or null." };
    }

    items.push({
      itemType: itemTypeRaw,
      topic,
      targetCount,
      notes: notes ?? null,
    });
  }

  return { items };
};

const isTeacherNotificationType = (
  value: string
): value is TeacherNotificationType =>
  TEACHER_NOTIFICATION_TYPES.includes(value as TeacherNotificationType);

const teacherOwnsStudent = async (teacherId: number, studentId: number): Promise<boolean> => {
  const rows = await sql`
    SELECT 1
    WHERE
      EXISTS (
        SELECT 1
        FROM groups g
        INNER JOIN group_students gs ON gs.group_id = g.id
        WHERE g.teacher_id = ${teacherId} AND gs.student_id = ${studentId}
      )
      OR EXISTS (
        SELECT 1
        FROM teacher_student_claims c
        WHERE c.teacher_id = ${teacherId} AND c.student_id = ${studentId}
      )
    LIMIT 1
  `;
  return first(rows) !== null;
};

export const registerTeacherRoutes = (app: Elysia) => {
  app.get("/teacher/groups", async ({ headers, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }

    try {
      const rows = await sql`
        SELECT
          g.id,
          g.name,
          g.subject_id,
          g.created_at,
          s.code AS subject_code,
          s.name_ru AS subject_name_ru,
          s.name_kz AS subject_name_kz,
          COUNT(gs.student_id) AS student_count
        FROM groups g
        INNER JOIN subjects s ON s.id = g.subject_id
        LEFT JOIN group_students gs ON gs.group_id = g.id
        WHERE g.teacher_id = ${teacher.id}
        GROUP BY g.id, s.code, s.name_ru, s.name_kz
        ORDER BY g.created_at DESC, g.id DESC
      `;

      return { items: rows };
    } catch {
      return fail(set, 500, "groups_fetch_failed", "Failed to fetch teacher groups.");
    }
  });

  app.post("/teacher/groups", async ({ headers, body, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const name = getString(body.name);
    const subjectId = getInteger(body.subject_id);
    if (!name || !subjectId) {
      return fail(set, 400, "validation_error", "name and subject_id are required.");
    }

    try {
      const rows = await sql`
        INSERT INTO groups (teacher_id, name, subject_id)
        VALUES (${teacher.id}, ${name}, ${subjectId})
        RETURNING *
      `;
      return { group: first(rows) };
    } catch {
      return fail(set, 500, "group_create_failed", "Failed to create group.");
    }
  });

  app.post("/teacher/groups/:group_id/students", async ({ headers, params, body, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const groupId = getInteger(params.group_id);
    const studentId = getInteger(body.student_id);
    if (!groupId || !studentId) {
      return fail(set, 400, "validation_error", "group_id and student_id are required.");
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const groupRows = await transaction`
          SELECT id, teacher_id
          FROM groups
          WHERE id = ${groupId}
          LIMIT 1
        `;
        const group = first<{ id: number; teacher_id: number }>(groupRows);
        if (!group || group.teacher_id !== teacher.id) {
          return { kind: "group_not_found" as const };
        }

        const studentRows = await transaction`
          SELECT id
          FROM users
          WHERE id = ${studentId} AND role = 'student'
          LIMIT 1
        `;
        if (!first(studentRows)) {
          return { kind: "student_not_found" as const };
        }

        const insertedRows = await transaction`
          INSERT INTO group_students (group_id, student_id)
          VALUES (${groupId}, ${studentId})
          ON CONFLICT (group_id, student_id) DO NOTHING
          RETURNING group_id, student_id
        `;

        const inserted = first(insertedRows);
        return {
          kind: "ok" as const,
          enrollment: inserted ?? { group_id: groupId, student_id: studentId },
          added: inserted !== null,
        };
      });

      if (result.kind === "group_not_found") {
        return fail(set, 404, "not_found", "Group not found.");
      }
      if (result.kind === "student_not_found") {
        return fail(set, 404, "not_found", "Student not found.");
      }

      return {
        enrollment: result.enrollment,
        added: result.added,
      };
    } catch {
      return fail(set, 500, "group_student_add_failed", "Failed to add student to group.");
    }
  });

  app.get("/teacher/groups/:group_id/summary", async ({ headers, params, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }

    const groupId = getInteger(params.group_id);
    const todayLocal = getCurrentDateInConfiguredOffset();
    const thirtyDaysAgoLocal = getDateDaysAgoInConfiguredOffset(30);
    if (!groupId) {
      return fail(set, 400, "validation_error", "Invalid group id.");
    }

    try {
      const groupRows = await sql`
        SELECT
          g.id,
          g.name,
          g.subject_id,
          g.created_at,
          s.code AS subject_code,
          s.name_ru AS subject_name_ru,
          s.name_kz AS subject_name_kz,
          COUNT(gs.student_id) AS student_count
        FROM groups g
        INNER JOIN subjects s ON s.id = g.subject_id
        LEFT JOIN group_students gs ON gs.group_id = g.id
        WHERE g.id = ${groupId} AND g.teacher_id = ${teacher.id}
        GROUP BY g.id, s.code, s.name_ru, s.name_kz
        LIMIT 1
      `;
      const group = first(groupRows);
      if (!group) {
        return fail(set, 404, "not_found", "Group not found.");
      }

      const students = await sql`
        SELECT
          u.id AS student_id,
          u.name AS student_name,
          u.school,
          u.grade,
          COALESCE(reg_stats.total_registrations, 0) AS total_registrations,
          COALESCE(reg_stats.registered_or_more, 0) AS registered_or_more,
          COALESCE(reg_stats.result_added_count, 0) AS result_added_count,
          reg_stats.next_deadline,
          COALESCE(prep_stats.minutes_30d, 0) AS prep_minutes_30d,
          COALESCE(prep_stats.activities_30d, 0) AS activities_30d
        FROM group_students gs
        INNER JOIN users u ON u.id = gs.student_id
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) AS total_registrations,
            COUNT(*) FILTER (WHERE r.status <> 'planned') AS registered_or_more,
            COUNT(*) FILTER (WHERE r.status = 'result_added') AS result_added_count,
            MIN(st.registration_deadline) FILTER (
              WHERE st.registration_deadline >= ${todayLocal}::date AND r.status <> 'result_added'
            ) AS next_deadline
          FROM registrations r
          INNER JOIN stages st ON st.id = r.stage_id
          WHERE r.student_id = u.id
        ) reg_stats ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COALESCE(SUM(pa.duration_minutes), 0)::int AS minutes_30d,
            COUNT(*) AS activities_30d
          FROM prep_activities pa
          WHERE pa.student_id = u.id
            AND pa.date >= ${thirtyDaysAgoLocal}::date
        ) prep_stats ON TRUE
        WHERE gs.group_id = ${groupId}
        ORDER BY u.name ASC
      `;

      const upcomingDeadlines = await sql`
        SELECT
          u.id AS student_id,
          u.name AS student_name,
          st.id AS stage_id,
          st.name AS stage_name,
          st.registration_deadline,
          r.status
        FROM group_students gs
        INNER JOIN users u ON u.id = gs.student_id
        INNER JOIN registrations r ON r.student_id = u.id
        INNER JOIN stages st ON st.id = r.stage_id
        WHERE gs.group_id = ${groupId}
          AND st.registration_deadline >= ${todayLocal}::date
          AND r.status <> 'result_added'
        ORDER BY st.registration_deadline ASC
        LIMIT 20
      `;

      return {
        group,
        students,
        upcoming_deadlines: upcomingDeadlines,
      };
    } catch {
      return fail(set, 500, "group_summary_failed", "Failed to fetch group summary.");
    }
  });

  for (const routePrefix of TEACHER_ROUTE_PREFIXES) {
    app.get(`${routePrefix}/students/claimed`, async ({ headers, set }) => {
      const teacher = await ensureTeacher(headers.authorization, set);
      if (!teacher) {
        return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
      }

      const todayLocal = getCurrentDateInConfiguredOffset();

      try {
        const rows = await sql`
          SELECT
            c.student_id,
            u.name AS student_name,
            u.school,
            u.grade,
            c.created_at,
            nearest.stage_id AS nearest_stage_id,
            nearest.stage_name AS nearest_stage_name,
            nearest.registration_deadline AS nearest_stage_deadline,
            nearest.status AS nearest_stage_status
          FROM teacher_student_claims c
          INNER JOIN users u ON u.id = c.student_id
          LEFT JOIN LATERAL (
            SELECT
              st.id AS stage_id,
              st.name AS stage_name,
              st.registration_deadline,
              r.status
            FROM registrations r
            INNER JOIN stages st ON st.id = r.stage_id
            WHERE r.student_id = c.student_id
              AND st.registration_deadline >= ${todayLocal}::date
              AND r.status <> 'result_added'
            ORDER BY st.registration_deadline ASC
            LIMIT 1
          ) nearest ON TRUE
          WHERE c.teacher_id = ${teacher.id}
          ORDER BY u.name ASC, c.student_id ASC
        `;

        return { items: rows };
      } catch {
        return fail(
          set,
          500,
          "claimed_students_fetch_failed",
          "Failed to fetch claimed students."
        );
      }
    });

    app.post(`${routePrefix}/students/:student_id/claim`, async ({ headers, params, set }) => {
      const teacher = await ensureTeacher(headers.authorization, set);
      if (!teacher) {
        return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
      }

      const studentId = getInteger(params.student_id);
      if (!studentId) {
        return fail(set, 400, "validation_error", "Invalid student id.");
      }

      try {
        const result = await sql.begin(async (transaction) => {
          const studentRows = await transaction`
            SELECT id
            FROM users
            WHERE id = ${studentId} AND role = 'student'
            LIMIT 1
          `;
          if (!first(studentRows)) {
            return { kind: "student_not_found" as const };
          }

          const previousRows = await transaction`
            SELECT teacher_id
            FROM teacher_student_claims
            WHERE student_id = ${studentId}
            LIMIT 1
          `;
          const previous = first<{ teacher_id: number }>(previousRows);

          const claimRows = await transaction`
            INSERT INTO teacher_student_claims (teacher_id, student_id)
            VALUES (${teacher.id}, ${studentId})
            ON CONFLICT (student_id) DO UPDATE
            SET
              teacher_id = EXCLUDED.teacher_id,
              updated_at = now()
            RETURNING *
          `;
          const claim = first<Record<string, unknown>>(claimRows);
          return {
            kind: "ok" as const,
            claim,
            previous_teacher_id: previous?.teacher_id ?? null,
          };
        });

        if (result.kind === "student_not_found") {
          return fail(set, 404, "not_found", "Student not found.");
        }

        const previousTeacherId = result.previous_teacher_id;
        return {
          claim: result.claim,
          changed_owner:
            previousTeacherId === null ? true : Number(previousTeacherId) !== teacher.id,
        };
      } catch {
        return fail(set, 500, "claim_student_failed", "Failed to claim student.");
      }
    });

    app.post(
      `${routePrefix}/students/:student_id/notifications`,
      async ({ headers, params, body, set }) => {
        const teacher = await ensureTeacher(headers.authorization, set);
        if (!teacher) {
          return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
        }
        if (!isRecord(body)) {
          return fail(set, 400, "validation_error", "Invalid request body.");
        }

        const studentId = getInteger(params.student_id);
        const typeRaw = getString(body.type) ?? "reminder";
        const title = getString(body.title);
        const notificationBody = getString(body.body);

        if (!studentId || !title || !notificationBody) {
          return fail(
            set,
            400,
            "validation_error",
            "student_id, title, and body are required."
          );
        }
        if (!isTeacherNotificationType(typeRaw)) {
          return fail(set, 400, "validation_error", "Invalid notification type.");
        }

        try {
          const hasAccess = await teacherOwnsStudent(teacher.id, studentId);
          if (!hasAccess) {
            return fail(set, 403, "forbidden", "Student is not assigned to you.");
          }

          const rows = await sql`
            INSERT INTO notifications (user_id, type, title, body)
            VALUES (${studentId}, ${typeRaw}, ${title}, ${notificationBody})
            RETURNING id, user_id, type, title, body, is_read, created_at
          `;

          return { notification: first(rows) };
        } catch {
          return fail(
            set,
            500,
            "notification_send_failed",
            "Failed to send notification."
          );
        }
      }
    );
  }

  app.post("/teacher/students/:student_id/comments", async ({ headers, params, body, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const studentId = getInteger(params.student_id);
    const stageId =
      body.stage_id === undefined || body.stage_id === null
        ? null
        : getInteger(body.stage_id);
    const text = getString(body.text);

    if (!studentId || !text) {
      return fail(set, 400, "validation_error", "student_id and text are required.");
    }
    if (body.stage_id !== undefined && body.stage_id !== null && stageId === null) {
      return fail(set, 400, "validation_error", "stage_id must be an integer or null.");
    }

    try {
      const hasAccess = await teacherOwnsStudent(teacher.id, studentId);
      if (!hasAccess) {
        return fail(set, 403, "forbidden", "Student is not assigned to your groups.");
      }

      if (stageId !== null) {
        const stageRows = await sql`
          SELECT id
          FROM stages
          WHERE id = ${stageId}
          LIMIT 1
        `;
        if (!first(stageRows)) {
          return fail(set, 404, "not_found", "Stage not found.");
        }
      }

      const rows = await sql`
        INSERT INTO teacher_comments (teacher_id, student_id, stage_id, text)
        VALUES (${teacher.id}, ${studentId}, ${stageId}, ${text})
        RETURNING *
      `;
      return { comment: first(rows) };
    } catch {
      return fail(set, 500, "comment_create_failed", "Failed to create teacher comment.");
    }
  });

  app.post("/teacher/students/:student_id/plans", async ({ headers, params, body, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const studentId = getInteger(params.student_id);
    const subjectId = getInteger(body.subject_id);
    const periodStart = getDateString(body.period_start);
    const periodEnd = getDateString(body.period_end);
    const objectiveText = getNullableString(body.objective_text);
    const statusRaw = getString(body.status) ?? "draft";
    const itemsRaw = body.items;

    if (!studentId || !subjectId || !periodStart || !periodEnd) {
      return fail(
        set,
        400,
        "validation_error",
        "student_id, subject_id, period_start, and period_end are required."
      );
    }
    if (body.objective_text !== undefined && objectiveText === undefined) {
      return fail(set, 400, "validation_error", "objective_text must be a string or null.");
    }
    if (!isPlanStatus(statusRaw)) {
      return fail(set, 400, "validation_error", "Invalid plan status.");
    }

    let parsedItems: PlanItemInput[] = [];
    if (itemsRaw !== undefined) {
      const parsed = parsePlanItems(itemsRaw);
      if ("error" in parsed) {
        return fail(set, 400, "validation_error", parsed.error);
      }
      parsedItems = parsed.items;
    }

    try {
      const hasAccess = await teacherOwnsStudent(teacher.id, studentId);
      if (!hasAccess) {
        return fail(set, 403, "forbidden", "Student is not assigned to your groups.");
      }

      const plan = await sql.begin(async (transaction) => {
        const planRows = await transaction`
          INSERT INTO teacher_prep_plans (
            teacher_id, student_id, subject_id, period_start, period_end, objective_text, status
          )
          VALUES (
            ${teacher.id},
            ${studentId},
            ${subjectId},
            ${periodStart},
            ${periodEnd},
            ${objectiveText ?? ""},
            ${statusRaw}
          )
          RETURNING *
        `;
        const createdPlan = first<Record<string, unknown>>(planRows);
        if (!createdPlan) {
          throw new Error("Failed to create plan.");
        }

        const items: Record<string, unknown>[] = [];
        for (const item of parsedItems) {
          const itemRows = await transaction`
            INSERT INTO teacher_prep_plan_items (plan_id, item_type, topic, target_count, notes)
            VALUES (
              ${createdPlan.id as number},
              ${item.itemType},
              ${item.topic},
              ${item.targetCount},
              ${item.notes}
            )
            RETURNING *
          `;
          const createdItem = first<Record<string, unknown>>(itemRows);
          if (createdItem) {
            items.push(createdItem);
          }
        }

        return {
          plan: createdPlan,
          items,
        };
      });

      return plan;
    } catch {
      return fail(set, 500, "plan_create_failed", "Failed to create teacher plan.");
    }
  });

  app.get("/teacher/students/:student_id/plans", async ({ headers, params, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }

    const studentId = getInteger(params.student_id);
    if (!studentId) {
      return fail(set, 400, "validation_error", "Invalid student id.");
    }

    try {
      const hasAccess = await teacherOwnsStudent(teacher.id, studentId);
      if (!hasAccess) {
        return fail(set, 403, "forbidden", "Student is not assigned to your groups.");
      }

      const rows = await sql`
        SELECT
          p.id AS plan_id,
          p.teacher_id,
          p.student_id,
          p.subject_id,
          p.period_start,
          p.period_end,
          p.objective_text,
          p.status,
          p.created_at,
          p.updated_at,
          i.id AS item_id,
          i.item_type,
          i.topic,
          i.target_count,
          i.notes
        FROM teacher_prep_plans p
        LEFT JOIN teacher_prep_plan_items i ON i.plan_id = p.id
        WHERE p.teacher_id = ${teacher.id} AND p.student_id = ${studentId}
        ORDER BY p.period_start DESC, p.id DESC, i.id ASC
      `;

      const plansById = new Map<number, Record<string, unknown>>();
      for (const row of rows as Array<Record<string, unknown>>) {
        const planId = row.plan_id as number;
        if (!plansById.has(planId)) {
          plansById.set(planId, {
            id: planId,
            teacher_id: row.teacher_id,
            student_id: row.student_id,
            subject_id: row.subject_id,
            period_start: row.period_start,
            period_end: row.period_end,
            objective_text: row.objective_text,
            status: row.status,
            created_at: row.created_at,
            updated_at: row.updated_at,
            items: [],
          });
        }

        if (row.item_id) {
          const currentPlan = plansById.get(planId);
          (currentPlan?.items as Array<Record<string, unknown>>).push({
            id: row.item_id,
            item_type: row.item_type,
            topic: row.topic,
            target_count: row.target_count,
            notes: row.notes,
          });
        }
      }

      return {
        items: Array.from(plansById.values()),
      };
    } catch {
      return fail(set, 500, "plans_fetch_failed", "Failed to fetch teacher plans.");
    }
  });

  app.patch("/teacher/plans/:plan_id", async ({ headers, params, body, set }) => {
    const teacher = await ensureTeacher(headers.authorization, set);
    if (!teacher) {
      return fail(set, set.status ?? 403, "forbidden", "Teacher role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const planId = getInteger(params.plan_id);
    if (!planId) {
      return fail(set, 400, "validation_error", "Invalid plan id.");
    }

    const hasSubjectId = Object.prototype.hasOwnProperty.call(body, "subject_id");
    const hasPeriodStart = Object.prototype.hasOwnProperty.call(body, "period_start");
    const hasPeriodEnd = Object.prototype.hasOwnProperty.call(body, "period_end");
    const hasObjectiveText = Object.prototype.hasOwnProperty.call(body, "objective_text");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasItems = Object.prototype.hasOwnProperty.call(body, "items");

    if (
      !hasSubjectId &&
      !hasPeriodStart &&
      !hasPeriodEnd &&
      !hasObjectiveText &&
      !hasStatus &&
      !hasItems
    ) {
      return fail(set, 400, "validation_error", "No fields to update.");
    }

    const subjectId = getInteger(body.subject_id);
    const periodStart = getDateString(body.period_start);
    const periodEnd = getDateString(body.period_end);
    const objectiveText = getNullableString(body.objective_text);
    const statusRaw = getString(body.status);

    if (hasSubjectId && !subjectId) {
      return fail(set, 400, "validation_error", "subject_id must be an integer.");
    }
    if (hasPeriodStart && !periodStart) {
      return fail(set, 400, "validation_error", "period_start must be a date.");
    }
    if (hasPeriodEnd && !periodEnd) {
      return fail(set, 400, "validation_error", "period_end must be a date.");
    }
    if (hasObjectiveText && objectiveText === undefined) {
      return fail(set, 400, "validation_error", "objective_text must be a string or null.");
    }
    if (hasStatus && (!statusRaw || !isPlanStatus(statusRaw))) {
      return fail(set, 400, "validation_error", "Invalid plan status.");
    }

    let parsedItems: PlanItemInput[] = [];
    if (hasItems) {
      const parsed = parsePlanItems(body.items);
      if ("error" in parsed) {
        return fail(set, 400, "validation_error", parsed.error);
      }
      parsedItems = parsed.items;
    }

    try {
      const result = await sql.begin(async (transaction) => {
        const ownershipRows = await transaction`
          SELECT id
          FROM teacher_prep_plans
          WHERE id = ${planId} AND teacher_id = ${teacher.id}
          LIMIT 1
        `;
        if (!first(ownershipRows)) {
          return { kind: "not_found" as const };
        }

        const updatedRows = await transaction`
          UPDATE teacher_prep_plans
          SET
            subject_id = CASE WHEN ${hasSubjectId}::boolean THEN ${subjectId} ELSE subject_id END,
            period_start = CASE WHEN ${hasPeriodStart}::boolean THEN ${periodStart} ELSE period_start END,
            period_end = CASE WHEN ${hasPeriodEnd}::boolean THEN ${periodEnd} ELSE period_end END,
            objective_text = CASE
              WHEN ${hasObjectiveText}::boolean THEN ${objectiveText ?? ""}
              ELSE objective_text
            END,
            status = CASE
              WHEN ${hasStatus}::boolean THEN ${statusRaw ?? "draft"}::plan_status
              ELSE status
            END
          WHERE id = ${planId}
          RETURNING *
        `;
        const updatedPlan = first<Record<string, unknown>>(updatedRows);
        if (!updatedPlan) {
          return { kind: "not_found" as const };
        }

        if (hasItems) {
          await transaction`
            DELETE FROM teacher_prep_plan_items
            WHERE plan_id = ${planId}
          `;
          for (const item of parsedItems) {
            await transaction`
              INSERT INTO teacher_prep_plan_items (plan_id, item_type, topic, target_count, notes)
              VALUES (${planId}, ${item.itemType}, ${item.topic}, ${item.targetCount}, ${item.notes})
            `;
          }
        }

        const itemRows = await transaction`
          SELECT *
          FROM teacher_prep_plan_items
          WHERE plan_id = ${planId}
          ORDER BY id ASC
        `;

        return {
          kind: "ok" as const,
          plan: updatedPlan,
          items: itemRows,
        };
      });

      if (result.kind === "not_found") {
        return fail(set, 404, "not_found", "Plan not found.");
      }

      return {
        plan: result.plan,
        items: result.items,
      };
    } catch {
      return fail(set, 500, "plan_update_failed", "Failed to update teacher plan.");
    }
  });
};

