import type { OwnerAuth } from "@aarili/auth";
import {
  apiErrorSchema,
  healthResponseSchema,
  healthUnavailableSchema,
} from "@aarili/contracts";
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { createDocumentRoutes } from "./documents.js";
import { createDraftRoutes } from "./drafts.js";
import { createMediaRoutes } from "./media.js";
import { createOwnerRoutes } from "./owner.js";

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

export function createApi(
  checkDatabase: () => Promise<boolean>,
  owner?: OwnerAuth,
  reportFailure?: () => void,
) {
  const router = new OpenAPIHono().basePath("/api");
  router.use("*", async (c, next) => {
    await next();
    // Observe final responses, including child routes with their own onError.
    // Health 503 is also an operational failure; no request/error data leaves.
    if (c.res.status >= 500) {
      try {
        reportFailure?.();
      } catch {
        /* Diagnostics never change responses. */
      }
    }
  });
  const app = router.openapi(healthRoute, async (c) => {
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
      healthResponseSchema.parse({ status: "ok", service: "aarili-web" }),
      200,
    );
  });
  if (owner) {
    app.route("/", createOwnerRoutes(owner));
    app.route("/", createDraftRoutes(owner));
    app.route("/", createMediaRoutes(owner));
    app.route("/", createDocumentRoutes(owner));
  }
  app.notFound((c) =>
    c.json(
      apiErrorSchema.parse({
        error: { code: "NOT_FOUND", message: "Route not found" },
      }),
      404,
    ),
  );
  app.onError((_error, c) => {
    return c.json(
      apiErrorSchema.parse({
        error: { code: "INTERNAL_ERROR", message: "Request failed" },
      }),
      500,
    );
  });
  return app;
}
export type HealthRoutes = ReturnType<typeof createApi>;
