import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { CONFIG } from "./config";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthProfileRoutes } from "./routes/auth-profile";
import { registerDictionaryRoutes } from "./routes/dictionaries";
import { registerAdminOlympiadRoutes } from "./routes/admin-olympiads";
import { registerRoadmapRegistrationResultRoutes } from "./routes/roadmap-registration-results";
import { registerPrepRoutes } from "./routes/prep";
import { registerTeacherRoutes } from "./routes/teacher";
import { registerTeacherRoutes as registerV2TeacherRoutes } from "./routes/v2-teacher";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerNotificationRoutes } from "./routes/notifications";
import { registerStorageRoutes } from "./routes/storage";
import { registerCalendarRoutes } from "./routes/calendar";
import { registerV2OlympiadPrepRoutes } from "./routes/v2-olympiad-prep";
import { registerV2AdminRoutes } from "./routes/v2-admin";
import { registerOnboardingRecommendationRoutes } from "./routes/onboarding-recommendations";
import { fail } from "./http";

export const app = new Elysia();

app.use(
  cors({
    origin: CONFIG.cors.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type"],
  })
);

app.onError(({ code, error, set }) => {
  if (code === "NOT_FOUND") {
    return fail(set, 404, "not_found", "Route not found.");
  }
  if (code === "VALIDATION" || code === "PARSE") {
    return fail(set, 400, "validation_error", "Request validation failed.");
  }

  console.error("Unhandled API error:", error);
  return fail(set, 500, "internal_error", "Unexpected server error.");
});

registerHealthRoutes(app);
registerAuthProfileRoutes(app);
registerDictionaryRoutes(app);
registerAdminOlympiadRoutes(app);
registerRoadmapRegistrationResultRoutes(app);
registerV2OlympiadPrepRoutes(app);
registerV2AdminRoutes(app);
registerV2TeacherRoutes(app);
registerPrepRoutes(app);
registerTeacherRoutes(app);
registerAnalyticsRoutes(app);
registerNotificationRoutes(app);
registerStorageRoutes(app);
registerCalendarRoutes(app);
registerOnboardingRecommendationRoutes(app);

if (import.meta.main) {
  app.listen(CONFIG.port);
  console.log(
    `OlymRoad API running on ${app.server?.hostname}:${app.server?.port}`
  );
}
