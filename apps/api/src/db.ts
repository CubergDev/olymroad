import { SQL } from "bun";
import { CONFIG } from "./config";

export const sql = new SQL(CONFIG.databaseUrl);

export const first = <T>(rows: unknown): T | null => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  return rows[0] as T;
};

export const dbErrorCode = (error: unknown): string | null => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
};
