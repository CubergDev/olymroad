import { createHash } from "node:crypto";
import type { Elysia } from "elysia";
import { requireUser } from "../auth";
import { first, sql } from "../db";
import {
  GoogleApiError,
  hasGoogleCalendarScope,
  isGoogleUnauthorizedError,
  listGoogleCalendarEvents,
  upsertGoogleCalendarStageEvent,
  verifyGoogleCalendarAccessToken,
} from "../google-calendar";
import { fail, failForDbError } from "../http";
import { getDateString, getInteger, getNullableString, getString, isRecord } from "../validation";
import type { UserRow } from "../types";

type CalendarSyncMode = "import" | "export" | "both";

type CalendarIntegrationRow = {
  id: number;
  user_id: number;
  provider: "google";
  provider_account_id: string;
  provider_email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  calendar_id: string;
  last_sync_at: string | null;
  last_sync_direction: CalendarSyncMode | null;
  last_sync_status: "ok" | "failed" | null;
  last_sync_error: string | null;
  created_at: string;
  updated_at: string;
};

type StageForCalendar = {
  stage_id: number;
  stage_name: string;
  date_start: string;
  date_end: string | null;
  registration_deadline: string;
  location: string | null;
  online_link: string | null;
  olympiad_title: string;
  format: string;
  season: string;
  registration_status: string | null;
};

const DEFAULT_IMPORT_LOOKBACK_DAYS = 30;
const DEFAULT_IMPORT_LOOKAHEAD_DAYS = 365;

const isDateOnly = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

const addDaysToDate = (dateValue: string, days: number): string => {
  const [yearRaw, monthRaw, dayRaw] = dateValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateValue;
  }
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  asUtc.setUTCDate(asUtc.getUTCDate() + days);
  return asUtc.toISOString().slice(0, 10);
};

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

const toScopeArray = (scope: string | null): string[] =>
  (scope ?? "")
    .split(" ")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const hasGoogleCalendarReadScope = (scope: string[]): boolean => {
  const allowed = new Set([
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly",
  ]);
  return scope.some((entry) => allowed.has(entry));
};

const hasGoogleCalendarWriteScope = (scope: string[]): boolean => {
  const allowed = new Set([
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ]);
  return scope.some((entry) => allowed.has(entry));
};

const parseSyncMode = (value: unknown): CalendarSyncMode | null => {
  if (value === undefined || value === null) {
    return "both";
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "import" || normalized === "export" || normalized === "both") {
    return normalized;
  }
  return null;
};

const loadGoogleCalendarIntegration = async (
  userId: number
): Promise<CalendarIntegrationRow | null> => {
  const rows = await sql`
    SELECT
      id,
      user_id,
      provider,
      provider_account_id,
      provider_email,
      access_token,
      refresh_token,
      token_expires_at,
      scope,
      calendar_id,
      last_sync_at,
      last_sync_direction,
      last_sync_status,
      last_sync_error,
      created_at,
      updated_at
    FROM calendar_integrations
    WHERE user_id = ${userId}
      AND provider = 'google'
    LIMIT 1
  `;
  return first<CalendarIntegrationRow>(rows);
};

const toPublicIntegration = (integration: CalendarIntegrationRow) => ({
  provider: integration.provider,
  provider_account_id: integration.provider_account_id,
  provider_email: integration.provider_email,
  calendar_id: integration.calendar_id,
  scope: toScopeArray(integration.scope),
  token_expires_at: integration.token_expires_at,
  last_sync_at: integration.last_sync_at,
  last_sync_direction: integration.last_sync_direction,
  last_sync_status: integration.last_sync_status,
  last_sync_error: integration.last_sync_error,
  created_at: integration.created_at,
  updated_at: integration.updated_at,
});

const loadStagesForCalendar = async (input: {
  user: UserRow;
  fromDate: string | null;
  toDate: string | null;
}): Promise<StageForCalendar[]> => {
  const canViewUnpublished = input.user.role === "admin";
  const rows = await sql`
    SELECT
      s.id AS stage_id,
      s.name AS stage_name,
      s.date_start,
      s.date_end,
      s.registration_deadline,
      s.location,
      s.online_link,
      o.title AS olympiad_title,
      o.format,
      o.season,
      r.status AS registration_status
    FROM stages s
    INNER JOIN olympiads o ON o.id = s.olympiad_id
    LEFT JOIN registrations r
      ON r.stage_id = s.id
      AND r.student_id = ${input.user.role === "student" ? input.user.id : null}
    WHERE
      (${canViewUnpublished}::boolean = TRUE OR (s.status = 'published' AND o.status = 'published'))
      AND (${input.fromDate}::date IS NULL OR s.date_start >= ${input.fromDate})
      AND (${input.toDate}::date IS NULL OR s.date_start <= ${input.toDate})
    ORDER BY s.date_start ASC, s.registration_deadline ASC, s.id ASC
  `;
  return rows as StageForCalendar[];
};

const escapeIcsText = (value: string): string =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const toIcsDate = (dateValue: string): string => dateValue.replace(/-/g, "");

const toIcsDateTimeUtc = (value: Date): string =>
  value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const buildIcsCalendar = (stages: StageForCalendar[]): string => {
  const nowStamp = toIcsDateTimeUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OlymRoad//Roadmap Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const stage of stages) {
    const summary = `${stage.olympiad_title} - ${stage.stage_name}`;
    const descriptionParts = [
      `Season: ${stage.season}`,
      `Format: ${stage.format}`,
      `Registration deadline: ${stage.registration_deadline}`,
    ];
    if (stage.registration_status) {
      descriptionParts.push(`Registration status: ${stage.registration_status}`);
    }
    if (stage.online_link) {
      descriptionParts.push(`Online link: ${stage.online_link}`);
    }

    const eventStart = stage.date_start;
    const eventEndExclusive = addDaysToDate(stage.date_end ?? stage.date_start, 1);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:stage-${stage.stage_id}@olymroad.local`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(eventStart)}`);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(eventEndExclusive)}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`);
    if (stage.location) {
      lines.push(`LOCATION:${escapeIcsText(stage.location)}`);
    }
    if (stage.online_link) {
      lines.push(`URL:${escapeIcsText(stage.online_link)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};

const stageExportDescription = (stage: StageForCalendar): string => {
  const parts = [
    `Season: ${stage.season}`,
    `Format: ${stage.format}`,
    `Registration deadline: ${stage.registration_deadline}`,
  ];
  if (stage.registration_status) {
    parts.push(`Registration status: ${stage.registration_status}`);
  }
  if (stage.online_link) {
    parts.push(`Online link: ${stage.online_link}`);
  }
  return parts.join("\n");
};

const stageExportHash = (stage: StageForCalendar): string =>
  createHash("sha256")
    .update(
      JSON.stringify({
        title: stage.olympiad_title,
        stage: stage.stage_name,
        date_start: stage.date_start,
        date_end: stage.date_end,
        registration_deadline: stage.registration_deadline,
        location: stage.location,
        online_link: stage.online_link,
        format: stage.format,
        season: stage.season,
        registration_status: stage.registration_status,
      })
    )
    .digest("hex");

const updateSyncStatus = async (input: {
  integrationId: number;
  mode: CalendarSyncMode;
  status: "ok" | "failed";
  error: string | null;
}) => {
  await sql`
    UPDATE calendar_integrations
    SET
      last_sync_at = now(),
      last_sync_direction = ${input.mode},
      last_sync_status = ${input.status},
      last_sync_error = ${input.error}
    WHERE id = ${input.integrationId}
  `;
};

const syncStagesToGoogle = async (input: {
  integration: CalendarIntegrationRow;
  user: UserRow;
  fromDate: string | null;
  toDate: string | null;
}) => {
  const stages = await loadStagesForCalendar({
    user: input.user,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });

  const mappingRows = await sql`
    SELECT stage_id, google_event_id, synced_hash
    FROM calendar_sync_events
    WHERE integration_id = ${input.integration.id}
  `;
  const mappingByStage = new Map<
    number,
    { google_event_id: string; synced_hash: string }
  >();
  for (const row of mappingRows as Array<Record<string, unknown>>) {
    const stageId = typeof row.stage_id === "number" ? row.stage_id : null;
    const googleEventId =
      typeof row.google_event_id === "string" ? row.google_event_id : null;
    const syncedHash = typeof row.synced_hash === "string" ? row.synced_hash : null;
    if (stageId !== null && googleEventId && syncedHash) {
      mappingByStage.set(stageId, {
        google_event_id: googleEventId,
        synced_hash: syncedHash,
      });
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const stage of stages) {
    const hash = stageExportHash(stage);
    const existing = mappingByStage.get(stage.stage_id);
    if (existing && existing.synced_hash === hash) {
      skipped += 1;
      continue;
    }

    const syncResult = await upsertGoogleCalendarStageEvent({
      accessToken: input.integration.access_token,
      calendarId: input.integration.calendar_id,
      eventId: existing?.google_event_id ?? null,
      payload: {
        summary: `${stage.olympiad_title} - ${stage.stage_name}`,
        description: stageExportDescription(stage),
        location: stage.location,
        startDate: stage.date_start,
        endDate: stage.date_end,
        sourceUrl: stage.online_link,
      },
    });

    if (syncResult.created || !existing) {
      created += 1;
    } else {
      updated += 1;
    }

    await sql`
      INSERT INTO calendar_sync_events (
        integration_id,
        stage_id,
        google_calendar_id,
        google_event_id,
        synced_hash,
        synced_at
      )
      VALUES (
        ${input.integration.id},
        ${stage.stage_id},
        ${input.integration.calendar_id},
        ${syncResult.eventId},
        ${hash},
        now()
      )
      ON CONFLICT (integration_id, stage_id)
      DO UPDATE SET
        google_calendar_id = EXCLUDED.google_calendar_id,
        google_event_id = EXCLUDED.google_event_id,
        synced_hash = EXCLUDED.synced_hash,
        synced_at = EXCLUDED.synced_at
    `;
  }

  return {
    mode: "export" as const,
    stages_total: stages.length,
    created,
    updated,
    skipped,
  };
};

const syncImportsFromGoogle = async (input: {
  integration: CalendarIntegrationRow;
  fromDate: string;
  toDate: string;
}) => {
  const importedEvents = await listGoogleCalendarEvents({
    accessToken: input.integration.access_token,
    calendarId: input.integration.calendar_id,
    timeMin: `${input.fromDate}T00:00:00.000Z`,
    timeMax: `${input.toDate}T23:59:59.999Z`,
  });

  for (const event of importedEvents) {
    await sql`
      INSERT INTO calendar_import_events (
        integration_id,
        provider_event_id,
        calendar_id,
        summary,
        description,
        location,
        starts_at,
        ends_at,
        all_day,
        html_link,
        is_cancelled,
        raw_json,
        last_seen_at
      )
      VALUES (
        ${input.integration.id},
        ${event.providerEventId},
        ${event.calendarId},
        ${event.summary},
        ${event.description},
        ${event.location},
        ${event.startsAt},
        ${event.endsAt},
        ${event.allDay},
        ${event.htmlLink},
        ${event.isCancelled},
        ${JSON.stringify(event.rawJson)}::jsonb,
        now()
      )
      ON CONFLICT (integration_id, calendar_id, provider_event_id)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        description = EXCLUDED.description,
        location = EXCLUDED.location,
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        all_day = EXCLUDED.all_day,
        html_link = EXCLUDED.html_link,
        is_cancelled = EXCLUDED.is_cancelled,
        raw_json = EXCLUDED.raw_json,
        last_seen_at = EXCLUDED.last_seen_at
    `;
  }

  const previewRows = await sql`
    SELECT
      provider_event_id,
      calendar_id,
      summary,
      location,
      starts_at,
      ends_at,
      all_day,
      html_link,
      is_cancelled,
      updated_at
    FROM calendar_import_events
    WHERE integration_id = ${input.integration.id}
    ORDER BY starts_at ASC
    LIMIT 10
  `;

  return {
    mode: "import" as const,
    imported_total: importedEvents.length,
    preview: previewRows,
  };
};

export const registerCalendarRoutes = (app: Elysia) => {
  app.get("/calendar/ics", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const fromDate = query.from === undefined ? null : getDateString(query.from);
    const toDate = query.to === undefined ? null : getDateString(query.to);
    if ((query.from !== undefined && !fromDate) || (query.to !== undefined && !toDate)) {
      return fail(set, 400, "validation_error", "from/to must be in YYYY-MM-DD format.");
    }
    if (fromDate && toDate && fromDate > toDate) {
      return fail(set, 400, "validation_error", "from cannot be later than to.");
    }

    try {
      const stages = await loadStagesForCalendar({
        user,
        fromDate,
        toDate,
      });
      const calendarBody = buildIcsCalendar(stages);
      const filename = `olymroad-roadmap-${new Date().toISOString().slice(0, 10)}.ics`;

      return new Response(calendarBody, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return failForDbError(
        set,
        error,
        "calendar_export_failed",
        "Failed to build ICS export."
      );
    }
  });

  app.get("/integrations/google-calendar/status", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    try {
      const integration = await loadGoogleCalendarIntegration(user.id);
      if (!integration) {
        return { connected: false, integration: null, imported_events_count: 0 };
      }

      const summaryRows = await sql`
        SELECT COUNT(*)::int AS imported_events_count
        FROM calendar_import_events
        WHERE integration_id = ${integration.id}
      `;
      const summary = first<{ imported_events_count: number }>(summaryRows);

      return {
        connected: true,
        integration: toPublicIntegration(integration),
        imported_events_count: summary?.imported_events_count ?? 0,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "calendar_status_failed",
        "Failed to fetch calendar integration status."
      );
    }
  });

  app.post("/integrations/google-calendar/connect", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const accessToken = getString(body.access_token);
    const refreshTokenProvided = Object.prototype.hasOwnProperty.call(body, "refresh_token");
    const refreshToken = getNullableString(body.refresh_token);
    const calendarId = getString(body.calendar_id) ?? "primary";

    if (!accessToken) {
      return fail(set, 400, "validation_error", "access_token is required.");
    }
    if (refreshTokenProvided && refreshToken === undefined) {
      return fail(set, 400, "validation_error", "refresh_token must be a string or null.");
    }

    try {
      const identity = await verifyGoogleCalendarAccessToken(accessToken);
      if (!identity) {
        return fail(set, 401, "invalid_oauth_token", "Google access token is invalid or expired.");
      }
      if (!hasGoogleCalendarScope(identity.scope)) {
        return fail(
          set,
          400,
          "invalid_oauth_scope",
          "Google token is missing calendar scope."
        );
      }

      const scopeString = identity.scope.join(" ");
      const rows = await sql`
        INSERT INTO calendar_integrations (
          user_id,
          provider,
          provider_account_id,
          provider_email,
          access_token,
          refresh_token,
          token_expires_at,
          scope,
          calendar_id
        )
        VALUES (
          ${user.id},
          'google',
          ${identity.providerAccountId},
          ${identity.email},
          ${accessToken},
          ${refreshTokenProvided ? refreshToken : null},
          ${identity.tokenExpiresAt},
          ${scopeString.length > 0 ? scopeString : null},
          ${calendarId}
        )
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          provider_account_id = EXCLUDED.provider_account_id,
          provider_email = EXCLUDED.provider_email,
          access_token = EXCLUDED.access_token,
          refresh_token = CASE
            WHEN ${refreshTokenProvided}::boolean THEN EXCLUDED.refresh_token
            ELSE calendar_integrations.refresh_token
          END,
          token_expires_at = EXCLUDED.token_expires_at,
          scope = EXCLUDED.scope,
          calendar_id = EXCLUDED.calendar_id,
          updated_at = now()
        RETURNING
          id,
          user_id,
          provider,
          provider_account_id,
          provider_email,
          access_token,
          refresh_token,
          token_expires_at,
          scope,
          calendar_id,
          last_sync_at,
          last_sync_direction,
          last_sync_status,
          last_sync_error,
          created_at,
          updated_at
      `;
      const integration = first<CalendarIntegrationRow>(rows);
      if (!integration) {
        return fail(
          set,
          500,
          "calendar_connect_failed",
          "Failed to save Google Calendar integration."
        );
      }

      return {
        connected: true,
        integration: toPublicIntegration(integration),
      };
    } catch (error) {
      if (isGoogleUnauthorizedError(error)) {
        return fail(set, 401, "invalid_oauth_token", "Google access token is invalid or expired.");
      }
      if (error instanceof GoogleApiError) {
        return fail(
          set,
          502,
          "calendar_connect_failed",
          `Google Calendar connection failed: ${error.message}`
        );
      }
      return failForDbError(
        set,
        error,
        "calendar_connect_failed",
        "Failed to connect Google Calendar."
      );
    }
  });

  app.delete("/integrations/google-calendar/disconnect", async ({ headers, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    try {
      const rows = await sql`
        DELETE FROM calendar_integrations
        WHERE user_id = ${user.id}
          AND provider = 'google'
        RETURNING id
      `;
      const deleted = first<{ id: number }>(rows);
      return {
        disconnected: Boolean(deleted),
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "calendar_disconnect_failed",
        "Failed to disconnect Google Calendar."
      );
    }
  });

  app.post("/integrations/google-calendar/sync", async ({ headers, body, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const mode = parseSyncMode(body.mode);
    if (!mode) {
      return fail(set, 400, "validation_error", "mode must be import, export, or both.");
    }

    const fromDateInput = body.from === undefined ? null : getDateString(body.from);
    const toDateInput = body.to === undefined ? null : getDateString(body.to);
    if ((body.from !== undefined && !fromDateInput) || (body.to !== undefined && !toDateInput)) {
      return fail(set, 400, "validation_error", "from/to must be in YYYY-MM-DD format.");
    }

    const today = new Date();
    const defaultFromDate = toDateOnly(
      new Date(today.getTime() - DEFAULT_IMPORT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    );
    const defaultToDate = toDateOnly(
      new Date(today.getTime() + DEFAULT_IMPORT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000)
    );

    const fromDate = fromDateInput ?? defaultFromDate;
    const toDate = toDateInput ?? defaultToDate;
    if (!isDateOnly(fromDate) || !isDateOnly(toDate) || fromDate > toDate) {
      return fail(set, 400, "validation_error", "Invalid sync date range.");
    }

    const integration = await loadGoogleCalendarIntegration(user.id);
    if (!integration) {
      return fail(
        set,
        404,
        "calendar_integration_not_found",
        "Google Calendar is not connected."
      );
    }

    const integrationScope = toScopeArray(integration.scope);
    if ((mode === "import" || mode === "both") && !hasGoogleCalendarReadScope(integrationScope)) {
      return fail(
        set,
        409,
        "insufficient_oauth_scope",
        "Google token does not allow reading calendar events."
      );
    }
    if ((mode === "export" || mode === "both") && !hasGoogleCalendarWriteScope(integrationScope)) {
      return fail(
        set,
        409,
        "insufficient_oauth_scope",
        "Google token does not allow writing calendar events."
      );
    }

    try {
      const exportResult =
        mode === "import"
          ? null
          : await syncStagesToGoogle({
              integration,
              user,
              fromDate,
              toDate,
            });
      const importResult =
        mode === "export"
          ? null
          : await syncImportsFromGoogle({
              integration,
              fromDate,
              toDate,
            });

      await updateSyncStatus({
        integrationId: integration.id,
        mode,
        status: "ok",
        error: null,
      });
      const refreshedIntegration = await loadGoogleCalendarIntegration(user.id);

      return {
        mode,
        date_range: {
          from: fromDate,
          to: toDate,
        },
        integration: refreshedIntegration
          ? toPublicIntegration(refreshedIntegration)
          : toPublicIntegration(integration),
        export: exportResult,
        import: importResult,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google Calendar sync failed unexpectedly.";
      await updateSyncStatus({
        integrationId: integration.id,
        mode,
        status: "failed",
        error: message,
      });

      if (isGoogleUnauthorizedError(error)) {
        return fail(
          set,
          401,
          "invalid_oauth_token",
          "Google token is invalid or expired. Reconnect Google Calendar."
        );
      }
      if (error instanceof GoogleApiError) {
        return fail(set, 502, "calendar_sync_failed", `Google sync failed: ${error.message}`);
      }
      return failForDbError(set, error, "calendar_sync_failed", "Failed to sync Google Calendar.");
    }
  });

  app.get("/integrations/google-calendar/imported-events", async ({ headers, query, set }) => {
    const user = await requireUser(headers.authorization, set);
    if (!user) {
      return fail(set, 401, "unauthorized", "Unauthorized.");
    }

    const limitRaw = query.limit === undefined ? 50 : getInteger(query.limit);
    const offsetRaw = query.offset === undefined ? 0 : getInteger(query.offset);
    if (limitRaw === null || offsetRaw === null || limitRaw <= 0 || offsetRaw < 0) {
      return fail(set, 400, "validation_error", "limit/offset must be valid integers.");
    }
    const limit = Math.min(limitRaw, 200);
    const offset = offsetRaw;

    try {
      const integration = await loadGoogleCalendarIntegration(user.id);
      if (!integration) {
        return { connected: false, items: [], total: 0 };
      }

      const rows = await sql`
        SELECT
          provider_event_id,
          calendar_id,
          summary,
          description,
          location,
          starts_at,
          ends_at,
          all_day,
          html_link,
          is_cancelled,
          updated_at
        FROM calendar_import_events
        WHERE integration_id = ${integration.id}
        ORDER BY starts_at ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const countRows = await sql`
        SELECT COUNT(*)::int AS total
        FROM calendar_import_events
        WHERE integration_id = ${integration.id}
      `;
      const count = first<{ total: number }>(countRows)?.total ?? 0;

      return {
        connected: true,
        total: count,
        items: rows,
      };
    } catch (error) {
      return failForDbError(
        set,
        error,
        "calendar_import_events_failed",
        "Failed to fetch imported events."
      );
    }
  });
};
