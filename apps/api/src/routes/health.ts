import type { Elysia } from "elysia";
import { sql } from "../db";
import { fail } from "../http";
import { checkStorageHealth } from "../storage";

export const registerHealthRoutes = (app: Elysia) => {
  app.get("/", () => ({
    service: "olymroad-api",
    status: "ok",
  }));

  app.get("/health", async ({ set }) => {
    try {
      await sql`SELECT 1`;
      const storageHealth = await checkStorageHealth();
      if (!storageHealth.ok) {
        return fail(
          set,
          503,
          "storage_unavailable",
          "Object storage connection failed.",
          {
            bucket: storageHealth.bucket,
            reason: storageHealth.reason ?? null,
          }
        );
      }

      return {
        status: "ok",
        database: "up",
        storage: "up",
        bucket: storageHealth.bucket,
      };
    } catch {
      return fail(set, 500, "db_unavailable", "Database connection failed.");
    }
  });
};
