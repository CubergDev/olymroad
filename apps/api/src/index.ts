import { Elysia } from "elysia";
import { CONFIG } from "./config";
import { registerHealthRoutes } from "./routes/health";
import { registerAuthProfileRoutes } from "./routes/auth-profile";
import { registerDictionaryRoutes } from "./routes/dictionaries";
import { registerAdminOlympiadRoutes } from "./routes/admin-olympiads";
import { registerRoadmapRegistrationResultRoutes } from "./routes/roadmap-registration-results";
import { registerPrepRoutes } from "./routes/prep";
import { registerTeacherRoutes } from "./routes/teacher";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerNotificationRoutes } from "./routes/notifications";

export const app = new Elysia();

registerHealthRoutes(app);
registerAuthProfileRoutes(app);
registerDictionaryRoutes(app);
registerAdminOlympiadRoutes(app);
registerRoadmapRegistrationResultRoutes(app);
registerPrepRoutes(app);
registerTeacherRoutes(app);
registerAnalyticsRoutes(app);
registerNotificationRoutes(app);

if (import.meta.main) {
  app.listen(CONFIG.port);
  console.log(
    `OlymRoad API running on ${app.server?.hostname}:${app.server?.port}`
  );
}
