import type { Elysia } from "elysia";
import { requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import { getInteger } from "../validation";

export const registerNotificationRoutes = (app: Elysia) => {
  app.get("/notifications", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const unreadOnly =
      query.unread_only === "true" || query.unreadOnly === "true";
    const limit = query.limit ? getInteger(query.limit) : 100;
    const offset = query.offset ? getInteger(query.offset) : 0;

    if (!limit || limit <= 0 || limit > 500) {
      return fail(set, 400, "validation_error", "limit must be between 1 and 500.");
    }
    if (offset === null || offset < 0) {
      return fail(set, 400, "validation_error", "offset must be >= 0.");
    }

    try {
      const items = await sql`
        SELECT id, user_id, type, title, body, is_read, created_at
        FROM notifications
        WHERE user_id = ${user.id}
          AND (${unreadOnly}::boolean = FALSE OR is_read = FALSE)
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const statsRows = await sql`
        SELECT
          COUNT(*) AS total_count,
          COUNT(*) FILTER (WHERE is_read = FALSE) AS unread_count
        FROM notifications
        WHERE user_id = ${user.id}
      `;
      const stats = first(statsRows);

      return {
        items,
        summary: {
          total_count: stats ? Number((stats as Record<string, unknown>).total_count ?? 0) : 0,
          unread_count: stats ? Number((stats as Record<string, unknown>).unread_count ?? 0) : 0,
        },
      };
    } catch {
      return fail(set, 500, "notifications_failed", "Failed to fetch notifications.");
    }
  });

  app.post("/notifications/:id/read", async ({ headers, params, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const notificationId = getInteger(params.id);
    if (!notificationId) {
      return fail(set, 400, "validation_error", "Invalid notification id.");
    }

    try {
      const rows = await sql`
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = ${notificationId} AND user_id = ${user.id}
        RETURNING id, user_id, type, title, body, is_read, created_at
      `;
      const notification = first(rows);
      if (!notification) {
        return fail(set, 404, "not_found", "Notification not found.");
      }
      return { notification };
    } catch {
      return fail(set, 500, "notification_mark_failed", "Failed to mark notification as read.");
    }
  });
};
