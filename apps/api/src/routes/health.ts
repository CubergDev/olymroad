import type { Elysia } from "elysia";
import { sql } from "../db";
import { fail } from "../http";

export const registerHealthRoutes = (app: Elysia) => {
  app.get("/", () => ({
    service: "olymroad-api",
    status: "ok",
  }));

  app.get("/health", async ({ set }) => {
    try {
      await sql`SELECT 1`;
      return { status: "ok", database: "up" };
    } catch {
      return fail(set, 500, "db_unavailable", "Database connection failed.");
    }
  });
};
