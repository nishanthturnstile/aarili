import { apiErrorSchema, healthResponseSchema } from "@aarili/contracts";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

const healthRoute = createRoute({
  method: "get",
  path: "/healthz",
  responses: {
    200: {
      description: "Process liveness only; not database readiness.",
      content: { "application/json": { schema: healthResponseSchema } },
    },
  },
});

export function createApi() {
  const app = new OpenAPIHono()
    .basePath("/api")
    .openapi(healthRoute, (c) =>
      c.json(
        healthResponseSchema.parse({ status: "ok", service: "aarili-web" }),
        200,
      ),
    );
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
