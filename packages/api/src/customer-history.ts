import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { apiErrorSchema } from "@aarili/contracts";
import {
  customerHistoryPageSchema,
  customerHistoryQuerySchema,
} from "@aarili/contracts/customer-history";
import { customerHistory, HistoryFailure } from "@aarili/core/customer-history";
import { CustomerFailure } from "@aarili/core/customers";
import { GuardianFailure, WearerFailure } from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

export function createCustomerHistoryRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerHistory">,
) {
  const error = {
    description: "Private history unavailable",
    content: { "application/json": { schema: apiErrorSchema } },
  };
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check history request",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/:shopId/customer-history", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Request-Id", crypto.randomUUID());
    if (new URL(c.req.url).search)
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Use private request body",
          },
        },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request denied" } },
        403,
      );
    return next();
  });
  app.use(
    "/shops/:shopId/customer-history",
    bodyLimit({
      maxSize: 16384,
      onError: (c) =>
        c.json(
          { error: { code: "INVALID_REQUEST", message: "Request too large" } },
          413,
        ),
    }),
  );
  const routes = app.openapi(
    createRoute({
      method: "post",
      path: "/shops/{shopId}/customer-history",
      request: {
        params: z.object({ shopId: z.uuid() }),
        body: {
          required: true,
          content: {
            "application/json": { schema: customerHistoryQuerySchema },
          },
        },
      },
      responses: {
        200: {
          description: "Authorised history projection",
          content: {
            "application/json": { schema: customerHistoryPageSchema },
          },
        },
        401: error,
        403: error,
        404: error,
        409: error,
        413: error,
        422: error,
        503: error,
      },
    }),
    async (c) => {
      const r = await owner.withOwnerHistory(
        c.req.raw.headers,
        c.req.valid("param").shopId,
        (ctx) => customerHistory(ctx, c.req.valid("json")),
      );
      for (const cookie of r.headers.getSetCookie())
        c.header("Set-Cookie", cookie, { append: true });
      return c.json(r.data, 200);
    },
  );
  app.onError((e, c) => {
    if (e instanceof HistoryFailure)
      return c.json(
        { error: { code: e.code, message: "Refresh history and try again" } },
        e.status,
      );
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      return c.json(
        { error: { code: "NOT_FOUND", message: "History unavailable" } },
        e.status === 404 ? 404 : 409,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Request denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (e instanceof HTTPException && [400, 415].includes(e.status))
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check history request",
          },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "History temporarily unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
