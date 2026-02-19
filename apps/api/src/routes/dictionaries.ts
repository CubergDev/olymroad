import type { Elysia } from "elysia";
import { requireRole, requireUser } from "../auth";
import { dbErrorCode, first, sql } from "../db";
import { fail } from "../http";
import type { DictionaryRow } from "../types";
import { getBoolean, getInteger, getString, isRecord } from "../validation";

const validateCreatePayload = (body: unknown) => {
  if (!isRecord(body)) {
    return null;
  }
  const code = getString(body.code);
  const nameRu = getString(body.name_ru);
  const nameKz = getString(body.name_kz);
  const isActive = body.is_active === undefined ? true : getBoolean(body.is_active);
  const sortOrder = body.sort_order === undefined ? 0 : getInteger(body.sort_order);

  if (!code || !nameRu || !nameKz || isActive === null || sortOrder === null) {
    return null;
  }
  return { code, nameRu, nameKz, isActive, sortOrder };
};

const validatePatchPayload = (body: unknown) => {
  if (!isRecord(body)) {
    return null;
  }
  const hasCode = Object.prototype.hasOwnProperty.call(body, "code");
  const hasNameRu = Object.prototype.hasOwnProperty.call(body, "name_ru");
  const hasNameKz = Object.prototype.hasOwnProperty.call(body, "name_kz");
  const hasIsActive = Object.prototype.hasOwnProperty.call(body, "is_active");
  const hasSortOrder = Object.prototype.hasOwnProperty.call(body, "sort_order");

  const code = getString(body.code);
  const nameRu = getString(body.name_ru);
  const nameKz = getString(body.name_kz);
  const isActive = hasIsActive ? getBoolean(body.is_active) : false;
  const sortOrder = hasSortOrder ? getInteger(body.sort_order) : 0;

  if ((hasCode && !code) || (hasNameRu && !nameRu) || (hasNameKz && !nameKz)) {
    return null;
  }
  if (hasIsActive && isActive === null) {
    return null;
  }
  if (hasSortOrder && sortOrder === null) {
    return null;
  }
  if (!hasCode && !hasNameRu && !hasNameKz && !hasIsActive && !hasSortOrder) {
    return null;
  }

  return {
    hasCode,
    hasNameRu,
    hasNameKz,
    hasIsActive,
    hasSortOrder,
    code: code ?? "",
    nameRu: nameRu ?? "",
    nameKz: nameKz ?? "",
    isActive,
    sortOrder,
  };
};

const listDictionaries = async (includeInactive: boolean) => {
  const subjects = (await sql`
    SELECT id, code, name_ru, name_kz, is_active, sort_order
    FROM subjects
    WHERE ${includeInactive}::boolean OR is_active
    ORDER BY sort_order ASC, id ASC
  `) as DictionaryRow[];

  const levels = (await sql`
    SELECT id, code, name_ru, name_kz, is_active, sort_order
    FROM levels
    WHERE ${includeInactive}::boolean OR is_active
    ORDER BY sort_order ASC, id ASC
  `) as DictionaryRow[];

  const regions = (await sql`
    SELECT id, code, name_ru, name_kz, is_active, sort_order
    FROM regions
    WHERE ${includeInactive}::boolean OR is_active
    ORDER BY sort_order ASC, id ASC
  `) as DictionaryRow[];

  const topicFrameworks = await sql`
    SELECT id, subject_code, name_ru, name_kz, description
    FROM topic_frameworks
    ORDER BY id ASC
  `;

  const topics = await sql`
    SELECT id, framework_id, parent_id, name_ru, name_kz, tags, sort_order
    FROM topics
    ORDER BY framework_id ASC, sort_order ASC, id ASC
  `;

  return {
    subjects,
    levels,
    regions,
    topic_frameworks: topicFrameworks,
    topics,
  };
};

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

const createDictionaryEntry = async (
  table: "subjects" | "levels" | "regions",
  payload: { code: string; nameRu: string; nameKz: string; isActive: boolean; sortOrder: number }
) => {
  if (table === "subjects") {
    return sql`
      INSERT INTO subjects (code, name_ru, name_kz, is_active, sort_order)
      VALUES (${payload.code}, ${payload.nameRu}, ${payload.nameKz}, ${payload.isActive}, ${payload.sortOrder})
      RETURNING id, code, name_ru, name_kz, is_active, sort_order
    `;
  }
  if (table === "levels") {
    return sql`
      INSERT INTO levels (code, name_ru, name_kz, is_active, sort_order)
      VALUES (${payload.code}, ${payload.nameRu}, ${payload.nameKz}, ${payload.isActive}, ${payload.sortOrder})
      RETURNING id, code, name_ru, name_kz, is_active, sort_order
    `;
  }
  return sql`
    INSERT INTO regions (code, name_ru, name_kz, is_active, sort_order)
    VALUES (${payload.code}, ${payload.nameRu}, ${payload.nameKz}, ${payload.isActive}, ${payload.sortOrder})
    RETURNING id, code, name_ru, name_kz, is_active, sort_order
  `;
};

const patchDictionaryEntry = async (
  table: "subjects" | "levels" | "regions",
  id: number,
  payload: {
    hasCode: boolean;
    hasNameRu: boolean;
    hasNameKz: boolean;
    hasIsActive: boolean;
    hasSortOrder: boolean;
    code: string;
    nameRu: string;
    nameKz: string;
    isActive: boolean | null;
    sortOrder: number | null;
  }
) => {
  if (table === "subjects") {
    return sql`
      UPDATE subjects
      SET
        code = CASE WHEN ${payload.hasCode}::boolean THEN ${payload.code} ELSE code END,
        name_ru = CASE WHEN ${payload.hasNameRu}::boolean THEN ${payload.nameRu} ELSE name_ru END,
        name_kz = CASE WHEN ${payload.hasNameKz}::boolean THEN ${payload.nameKz} ELSE name_kz END,
        is_active = CASE WHEN ${payload.hasIsActive}::boolean THEN ${payload.isActive} ELSE is_active END,
        sort_order = CASE WHEN ${payload.hasSortOrder}::boolean THEN ${payload.sortOrder} ELSE sort_order END
      WHERE id = ${id}
      RETURNING id, code, name_ru, name_kz, is_active, sort_order
    `;
  }
  if (table === "levels") {
    return sql`
      UPDATE levels
      SET
        code = CASE WHEN ${payload.hasCode}::boolean THEN ${payload.code} ELSE code END,
        name_ru = CASE WHEN ${payload.hasNameRu}::boolean THEN ${payload.nameRu} ELSE name_ru END,
        name_kz = CASE WHEN ${payload.hasNameKz}::boolean THEN ${payload.nameKz} ELSE name_kz END,
        is_active = CASE WHEN ${payload.hasIsActive}::boolean THEN ${payload.isActive} ELSE is_active END,
        sort_order = CASE WHEN ${payload.hasSortOrder}::boolean THEN ${payload.sortOrder} ELSE sort_order END
      WHERE id = ${id}
      RETURNING id, code, name_ru, name_kz, is_active, sort_order
    `;
  }
  return sql`
    UPDATE regions
    SET
      code = CASE WHEN ${payload.hasCode}::boolean THEN ${payload.code} ELSE code END,
      name_ru = CASE WHEN ${payload.hasNameRu}::boolean THEN ${payload.nameRu} ELSE name_ru END,
      name_kz = CASE WHEN ${payload.hasNameKz}::boolean THEN ${payload.nameKz} ELSE name_kz END,
      is_active = CASE WHEN ${payload.hasIsActive}::boolean THEN ${payload.isActive} ELSE is_active END,
      sort_order = CASE WHEN ${payload.hasSortOrder}::boolean THEN ${payload.sortOrder} ELSE sort_order END
    WHERE id = ${id}
    RETURNING id, code, name_ru, name_kz, is_active, sort_order
  `;
};

const deleteDictionaryEntry = async (
  table: "subjects" | "levels" | "regions",
  id: number
) => {
  if (table === "subjects") {
    return sql`
      DELETE FROM subjects
      WHERE id = ${id}
      RETURNING id
    `;
  }
  if (table === "levels") {
    return sql`
      DELETE FROM levels
      WHERE id = ${id}
      RETURNING id
    `;
  }
  return sql`
    DELETE FROM regions
    WHERE id = ${id}
    RETURNING id
  `;
};

const labelFor = (table: "subjects" | "levels" | "regions") => {
  if (table === "subjects") return "subject";
  if (table === "levels") return "level";
  return "region";
};

export const registerDictionaryRoutes = (app: Elysia) => {
  app.get("/dictionaries", async ({ query, set }) => {
    const includeInactive =
      query.include_inactive === "true" || query.includeInactive === "true";
    try {
      return await listDictionaries(includeInactive);
    } catch {
      return fail(set, 500, "dictionaries_failed", "Failed to load dictionaries.");
    }
  });

  const tables: Array<"subjects" | "levels" | "regions"> = [
    "subjects",
    "levels",
    "regions",
  ];

  for (const table of tables) {
    const label = labelFor(table);
    app.post(`/admin/dictionaries/${table}`, async ({ headers, body, set }) => {
      const admin = await ensureAdmin(headers.authorization, set);
      if (!admin) {
        return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
      }
      const payload = validateCreatePayload(body);
      if (!payload) {
        return fail(set, 400, "validation_error", `Invalid ${label} payload.`);
      }

      try {
        const rows = await createDictionaryEntry(table, payload);
        return { [label]: first<DictionaryRow>(rows) };
      } catch (error) {
        if (dbErrorCode(error) === "23505") {
          return fail(set, 409, "duplicate_code", `${label} code already exists.`);
        }
        return fail(set, 500, `${label}_create_failed`, `Failed to create ${label}.`);
      }
    });

    app.patch(`/admin/dictionaries/${table}/:id`, async ({ headers, params, body, set }) => {
      const admin = await ensureAdmin(headers.authorization, set);
      if (!admin) {
        return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
      }
      const id = getInteger(params.id);
      const payload = validatePatchPayload(body);
      if (!id || !payload) {
        return fail(set, 400, "validation_error", `Invalid ${label} patch payload.`);
      }

      try {
        const rows = await patchDictionaryEntry(table, id, payload);
        const updated = first<DictionaryRow>(rows);
        if (!updated) {
          return fail(set, 404, "not_found", `${label} not found.`);
        }
        return { [label]: updated };
      } catch (error) {
        if (dbErrorCode(error) === "23505") {
          return fail(set, 409, "duplicate_code", `${label} code already exists.`);
        }
        return fail(set, 500, `${label}_update_failed`, `Failed to update ${label}.`);
      }
    });

    app.delete(`/admin/dictionaries/${table}/:id`, async ({ headers, params, set }) => {
      const admin = await ensureAdmin(headers.authorization, set);
      if (!admin) {
        return fail(set, set.status ?? 403, "forbidden", "Admin role required.");
      }
      const id = getInteger(params.id);
      if (!id) {
        return fail(set, 400, "validation_error", `Invalid ${label} id.`);
      }

      try {
        const rows = await deleteDictionaryEntry(table, id);
        const deleted = first<Record<string, unknown>>(rows);
        if (!deleted) {
          return fail(set, 404, "not_found", `${label} not found.`);
        }
        return { deleted: true, id, table };
      } catch (error) {
        if (dbErrorCode(error) === "23503") {
          return fail(
            set,
            409,
            `${label}_in_use`,
            `${label} is referenced by other records and cannot be deleted.`
          );
        }
        return fail(set, 500, `${label}_delete_failed`, `Failed to delete ${label}.`);
      }
    });
  }
};
