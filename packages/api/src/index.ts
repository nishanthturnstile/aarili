import {
  apiErrorSchema,
  healthResponseSchema,
  healthUnavailableSchema,
} from "@aarili/contracts";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

const healthRoute = createRoute({
  method: "get",
  path: "/healthz",
  responses: {
    200: {
      description: "Application and PostgreSQL readiness.",
      content: { "application/json": { schema: healthResponseSchema } },
    },
    503: {
      description: "Database is unavailable, unconfigured or timed out.",
      content: { "application/json": { schema: healthUnavailableSchema } },
    },
  },
});

export function createApi(checkDatabase: () => Promise<boolean>) {
  const app = new OpenAPIHono()
    .basePath("/api")
    .openapi(healthRoute, async (c) => {
      c.header("Cache-Control", "no-store");
      let ready = false;
      try {
        ready = await checkDatabase();
      } catch {
        /* Never expose driver/configuration errors. */
      }
      if (!ready)
        return c.json(
          healthUnavailableSchema.parse({
            error: {
              code: "DATABASE_UNAVAILABLE",
              message: "Database is unavailable",
            },
          }),
          503,
        );
      return c.json(
        healthResponseSchema.parse({ status: "ok", service: "aarili-worker" }),
        200,
      );
    });
  app.notFound((c) =>
    c.json(
      apiErrorSchema.parse({
        error: { code: "NOT_FOUND", message: "Route not found" },
      }),
      404,
    ),
  );
  app.onError((_error, c) =>
    c.json(
      apiErrorSchema.parse({
        error: { code: "INTERNAL_ERROR", message: "Request failed" },
      }),
      500,
    ),
  );
  return app;
}
export type HealthRoutes = ReturnType<typeof createApi>;
