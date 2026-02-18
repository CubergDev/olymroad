import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { first, sql } from "../db";
import { fail } from "../http";
import {
  getDateString,
  getInteger,
  getNullableString,
  getString,
  isEntityStatus,
  isOlympiadFormat,
  isRecord,
  normalizeChecklist,
} from "../validation";

const ensureAdmin = async (
  authorization: string | undefined,
  set: { status?: number }
) => {
  const user = await requireUser(authorization, set);
  if (!user) {
    return null;
  }
  if (!requireRole(user, ["admin"], set)) {
    return null;
  }
  return user;
};

export const registerAdminOlympiadRoutes = (app: Elysia) => {
  app.post("/admin/olympiads", async ({ headers, body, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const title = getString(body.title);
    const subjectId = getInteger(body.subject_id);
    const levelId = getInteger(body.level_id);
    const regionId = body.region_id === undefined ? null : getInteger(body.region_id);
    const formatRaw = getString(body.format);
    const organizer = getNullableString(body.organizer);
    const rulesUrl = getNullableString(body.rules_url);
    const season = getString(body.season);
    const statusRaw = getString(body.status) ?? "draft";

    if (!title || !subjectId || !levelId || !formatRaw || !season || !isOlympiadFormat(formatRaw)) {
      return fail(set, 400, "validation_error", "Missing required olympiad fields.");
    }
    if (!isEntityStatus(statusRaw)) {
      return fail(set, 400, "validation_error", "Invalid olympiad status.");
    }
    if (body.region_id !== undefined && body.region_id !== null && regionId === null) {
      return fail(set, 400, "validation_error", "region_id must be integer or null.");
    }
    if (organizer === undefined || rulesUrl === undefined) {
      return fail(set, 400, "validation_error", "organizer/rules_url must be string or null.");
    }

    try {
      const rows = await sql`
        INSERT INTO olympiads (
          title, subject_id, level_id, region_id, format, organizer, rules_url, season, status
        )
        VALUES (
          ${title},
          ${subjectId},
          ${levelId},
          ${regionId},
          ${formatRaw},
          ${organizer},
          ${rulesUrl},
          ${season},
          ${statusRaw}
        )
        RETURNING *
      `;
      return { olympiad: first(rows) };
    } catch {
      return fail(set, 500, "olympiad_create_failed", "Failed to create olympiad.");
    }
  });

  app.patch("/admin/olympiads/:id", async ({ headers, params, body, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const olympiadId = getInteger(params.id);
    if (!olympiadId) {
      return fail(set, 400, "validation_error", "Invalid olympiad id.");
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasSubjectId = Object.prototype.hasOwnProperty.call(body, "subject_id");
    const hasLevelId = Object.prototype.hasOwnProperty.call(body, "level_id");
    const hasRegionId = Object.prototype.hasOwnProperty.call(body, "region_id");
    const hasFormat = Object.prototype.hasOwnProperty.call(body, "format");
    const hasOrganizer = Object.prototype.hasOwnProperty.call(body, "organizer");
    const hasRulesUrl = Object.prototype.hasOwnProperty.call(body, "rules_url");
    const hasSeason = Object.prototype.hasOwnProperty.call(body, "season");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

    if (
      !hasTitle &&
      !hasSubjectId &&
      !hasLevelId &&
      !hasRegionId &&
      !hasFormat &&
      !hasOrganizer &&
      !hasRulesUrl &&
      !hasSeason &&
      !hasStatus
    ) {
      return fail(set, 400, "validation_error", "No fields to update.");
    }

    const title = getString(body.title);
    const subjectId = getInteger(body.subject_id);
    const levelId = getInteger(body.level_id);
    const regionId = body.region_id === null ? null : getInteger(body.region_id);
    const formatRaw = getString(body.format);
    const organizer = getNullableString(body.organizer);
    const rulesUrl = getNullableString(body.rules_url);
    const season = getString(body.season);
    const statusRaw = getString(body.status);

    if ((hasTitle && !title) || (hasSubjectId && !subjectId) || (hasLevelId && !levelId)) {
      return fail(set, 400, "validation_error", "Invalid olympiad fields.");
    }
    if (hasRegionId && body.region_id !== null && regionId === null) {
      return fail(set, 400, "validation_error", "region_id must be integer or null.");
    }
    if (hasFormat && (!formatRaw || !isOlympiadFormat(formatRaw))) {
      return fail(set, 400, "validation_error", "Invalid format.");
    }
    if (hasOrganizer && organizer === undefined) {
      return fail(set, 400, "validation_error", "organizer must be string or null.");
    }
    if (hasRulesUrl && rulesUrl === undefined) {
      return fail(set, 400, "validation_error", "rules_url must be string or null.");
    }
    if (hasSeason && !season) {
      return fail(set, 400, "validation_error", "season must be a non-empty string.");
    }
    if (hasStatus && (!statusRaw || !isEntityStatus(statusRaw))) {
      return fail(set, 400, "validation_error", "Invalid status.");
    }

    try {
      const rows = await sql`
        UPDATE olympiads
        SET
          title = CASE WHEN ${hasTitle}::boolean THEN ${title ?? ""} ELSE title END,
          subject_id = CASE WHEN ${hasSubjectId}::boolean THEN ${subjectId} ELSE subject_id END,
          level_id = CASE WHEN ${hasLevelId}::boolean THEN ${levelId} ELSE level_id END,
          region_id = CASE WHEN ${hasRegionId}::boolean THEN ${regionId} ELSE region_id END,
          format = CASE WHEN ${hasFormat}::boolean THEN ${formatRaw ?? "online"}::olympiad_format ELSE format END,
          organizer = CASE WHEN ${hasOrganizer}::boolean THEN ${organizer ?? null} ELSE organizer END,
          rules_url = CASE WHEN ${hasRulesUrl}::boolean THEN ${rulesUrl ?? null} ELSE rules_url END,
          season = CASE WHEN ${hasSeason}::boolean THEN ${season ?? ""} ELSE season END,
          status = CASE WHEN ${hasStatus}::boolean THEN ${statusRaw ?? "draft"}::entity_status ELSE status END
        WHERE id = ${olympiadId}
        RETURNING *
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "Olympiad not found.");
      }
      return { olympiad: updated };
    } catch {
      return fail(set, 500, "olympiad_update_failed", "Failed to update olympiad.");
    }
  });

  app.post("/admin/olympiads/:id/confirm", async ({ headers, params, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }

    const olympiadId = getInteger(params.id);
    if (!olympiadId) {
      return fail(set, 400, "validation_error", "Invalid olympiad id.");
    }

    try {
      const rows = await sql`
        UPDATE olympiads
        SET confirmed_by = ${user.id}, confirmed_at = now(), status = 'published'
        WHERE id = ${olympiadId}
        RETURNING *
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "Olympiad not found.");
      }
      return { olympiad: updated };
    } catch {
      return fail(set, 500, "olympiad_confirm_failed", "Failed to confirm olympiad.");
    }
  });

  app.post("/admin/olympiads/:id/stages", async ({ headers, params, body, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const olympiadId = getInteger(params.id);
    const name = getString(body.name);
    const dateStart = getDateString(body.date_start);
    const dateEnd = body.date_end === undefined || body.date_end === null ? null : getDateString(body.date_end);
    const registrationDeadline = getDateString(body.registration_deadline);
    const location = getNullableString(body.location);
    const onlineLink = getNullableString(body.online_link);
    const statusRaw = getString(body.status) ?? "draft";
    const checklist = normalizeChecklist(body.checklist_json);

    if (!olympiadId || !name || !dateStart || !registrationDeadline) {
      return fail(set, 400, "validation_error", "Missing required stage fields.");
    }
    if (body.date_end !== undefined && body.date_end !== null && !dateEnd) {
      return fail(set, 400, "validation_error", "date_end must be date or null.");
    }
    if (location === undefined || onlineLink === undefined) {
      return fail(set, 400, "validation_error", "location/online_link must be string or null.");
    }
    if (!isEntityStatus(statusRaw)) {
      return fail(set, 400, "validation_error", "Invalid stage status.");
    }

    try {
      const rows = await sql`
        INSERT INTO stages (
          olympiad_id, name, date_start, date_end, registration_deadline, location, online_link, checklist_json, status
        )
        VALUES (
          ${olympiadId},
          ${name},
          ${dateStart},
          ${dateEnd},
          ${registrationDeadline},
          ${location},
          ${onlineLink},
          ${JSON.stringify(checklist)}::jsonb,
          ${statusRaw}
        )
        RETURNING *
      `;
      return { stage: first(rows) };
    } catch {
      return fail(set, 500, "stage_create_failed", "Failed to create stage.");
    }
  });

  app.patch("/admin/stages/:id", async ({ headers, params, body, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }
    if (!isRecord(body)) {
      return fail(set, 400, "validation_error", "Invalid request body.");
    }

    const stageId = getInteger(params.id);
    if (!stageId) {
      return fail(set, 400, "validation_error", "Invalid stage id.");
    }

    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasDateStart = Object.prototype.hasOwnProperty.call(body, "date_start");
    const hasDateEnd = Object.prototype.hasOwnProperty.call(body, "date_end");
    const hasRegistrationDeadline = Object.prototype.hasOwnProperty.call(body, "registration_deadline");
    const hasLocation = Object.prototype.hasOwnProperty.call(body, "location");
    const hasOnlineLink = Object.prototype.hasOwnProperty.call(body, "online_link");
    const hasChecklist = Object.prototype.hasOwnProperty.call(body, "checklist_json");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");

    if (
      !hasName &&
      !hasDateStart &&
      !hasDateEnd &&
      !hasRegistrationDeadline &&
      !hasLocation &&
      !hasOnlineLink &&
      !hasChecklist &&
      !hasStatus
    ) {
      return fail(set, 400, "validation_error", "No fields to update.");
    }

    const name = getString(body.name);
    const dateStart = getDateString(body.date_start);
    const dateEnd = body.date_end === null ? null : getDateString(body.date_end);
    const registrationDeadline = getDateString(body.registration_deadline);
    const location = getNullableString(body.location);
    const onlineLink = getNullableString(body.online_link);
    const statusRaw = getString(body.status);
    const checklist = hasChecklist ? normalizeChecklist(body.checklist_json) : null;

    if (hasName && !name) return fail(set, 400, "validation_error", "Invalid name.");
    if (hasDateStart && !dateStart) return fail(set, 400, "validation_error", "Invalid date_start.");
    if (hasDateEnd && body.date_end !== null && !dateEnd)
      return fail(set, 400, "validation_error", "Invalid date_end.");
    if (hasRegistrationDeadline && !registrationDeadline)
      return fail(set, 400, "validation_error", "Invalid registration_deadline.");
    if (hasLocation && location === undefined)
      return fail(set, 400, "validation_error", "Invalid location.");
    if (hasOnlineLink && onlineLink === undefined)
      return fail(set, 400, "validation_error", "Invalid online_link.");
    if (hasStatus && (!statusRaw || !isEntityStatus(statusRaw)))
      return fail(set, 400, "validation_error", "Invalid status.");

    try {
      const rows = await sql`
        UPDATE stages
        SET
          name = CASE WHEN ${hasName}::boolean THEN ${name ?? ""} ELSE name END,
          date_start = CASE WHEN ${hasDateStart}::boolean THEN ${dateStart} ELSE date_start END,
          date_end = CASE WHEN ${hasDateEnd}::boolean THEN ${dateEnd} ELSE date_end END,
          registration_deadline = CASE
            WHEN ${hasRegistrationDeadline}::boolean THEN ${registrationDeadline}
            ELSE registration_deadline
          END,
          location = CASE WHEN ${hasLocation}::boolean THEN ${location ?? null} ELSE location END,
          online_link = CASE WHEN ${hasOnlineLink}::boolean THEN ${onlineLink ?? null} ELSE online_link END,
          checklist_json = CASE
            WHEN ${hasChecklist}::boolean THEN ${JSON.stringify(checklist ?? normalizeChecklist({}))}::jsonb
            ELSE checklist_json
          END,
          status = CASE WHEN ${hasStatus}::boolean THEN ${statusRaw ?? "draft"}::entity_status ELSE status END
        WHERE id = ${stageId}
        RETURNING *
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "Stage not found.");
      }
      return { stage: updated };
    } catch {
      return fail(set, 500, "stage_update_failed", "Failed to update stage.");
    }
  });

  app.post("/admin/stages/:id/confirm", async ({ headers, params, set }) => {
    const user = await ensureAdmin(headers.authorization, set);
    if (!user) {
      return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
    }
    const stageId = getInteger(params.id);
    if (!stageId) {
      return fail(set, 400, "validation_error", "Invalid stage id.");
    }

    try {
      const rows = await sql`
        UPDATE stages
        SET confirmed_by = ${user.id}, confirmed_at = now(), status = 'published'
        WHERE id = ${stageId}
        RETURNING *
      `;
      const updated = first(rows);
      if (!updated) {
        return fail(set, 404, "not_found", "Stage not found.");
      }
      return { stage: updated };
    } catch {
      return fail(set, 500, "stage_confirm_failed", "Failed to confirm stage.");
    }
  });
};
