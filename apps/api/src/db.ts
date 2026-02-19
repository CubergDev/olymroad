import { SQL } from "bun";
import { CONFIG } from "./config";

export const sql = new SQL(CONFIG.databaseUrl);

export const first = <T>(rows: unknown): T | null => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0] as T;
};

const getStringField = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
};

export type DbErrorInfo = {
  code: string;
  constraint: string | null;
  table: string | null;
  column: string | null;
};

export const dbErrorInfo = (error: unknown): DbErrorInfo | null => {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const asRecord = error as Record<string, unknown>;
  const code = getStringField(asRecord, "code");
  if (!code) {
    return null;
  }

  return {
    code,
    constraint: getStringField(asRecord, "constraint"),
    table: getStringField(asRecord, "table"),
    column: getStringField(asRecord, "column"),
  };
};

export const dbErrorCode = (error: unknown): string | null => dbErrorInfo(error)?.code ?? null;

export type MappedDbError = {
  status: number;
  code: string;
  message: string;
  details: Record<string, string>;
};

export const mapDbError = (error: unknown): MappedDbError | null => {
  const info = dbErrorInfo(error);
  if (!info) {
    return null;
  }

  const details: Record<string, string> = { pg_code: info.code };
  if (info.constraint) {
    details.constraint = info.constraint;
  }
  if (info.table) {
    details.table = info.table;
  }
  if (info.column) {
    details.column = info.column;
  }

  switch (info.code) {
    case "23505":
      return {
        status: 409,
        code: "duplicate_resource",
        message: "A record with the same unique value already exists.",
        details,
      };
    case "23503":
      return {
        status: 409,
        code: "invalid_reference",
        message: "One of the referenced records does not exist.",
        details,
      };
    case "23502":
      return {
        status: 400,
        code: "required_field_missing",
        message: "A required value is missing.",
        details,
      };
    case "23514":
      return {
        status: 400,
        code: "constraint_violation",
        message: "Input violates a database constraint.",
        details,
      };
    case "22P02":
      return {
        status: 400,
        code: "invalid_value",
        message: "Input value has invalid format or type.",
        details,
      };
    case "22001":
      return {
        status: 400,
        code: "value_too_long",
        message: "Input value is too long for a database field.",
        details,
      };
    case "40P01":
    case "40001":
      return {
        status: 503,
        code: "database_retryable_error",
        message: "Temporary database error. Retry the request.",
        details,
      };
    case "42P01":
    case "42703":
      return {
        status: 503,
        code: "schema_not_migrated",
        message: "Database schema is outdated. Apply latest migrations.",
        details,
      };
    default:
      return null;
  }
};
