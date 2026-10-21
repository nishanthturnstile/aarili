import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftSuccessSchema } from "@aarili/contracts/drafts";
import {
  createRepeatOrderSchema,
  orderErrorSchema,
  orderListQuerySchema,
  orderReviewSchema,
  repeatLinksSchema,
  repeatOrderDraftSchema,
  repeatSourceSchema,
} from "@aarili/contracts/orders";
import { CustomerFailure } from "@aarili/core/customers";
import { DraftFailure } from "@aarili/core/drafts";
import {
  createRepeatOrder,
  OrderFailure,
  readRepeatLinks,
  readRepeatSource,
  reviewRepeatOrder,
} from "@aarili/core/orders";
import { GuardianFailure, WearerFailure } from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private repeat intake",
  content: { "application/json": { schema } },
});
export function createRepeatOrderRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerQuickOrder" | "commandLimit">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check intake fields",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/:shopId/orders/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Use a request body" } },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request denied" } },
        403,
      );
    if (c.req.path.endsWith("/repeat/create")) {
      const retry = await owner.commandLimit();
      if (retry) {
        c.header("Retry-After", String(retry));
        return c.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: "Wait before trying again",
            },
          },
          429,
        );
      }
    }
    const boundedHeaders = new Headers(c.req.raw.headers);
    boundedHeaders.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers: boundedHeaders });
    return next();
  });
  app.use(
    "/shops/:shopId/orders/*",
    bodyLimit({
      maxSize: 65536,
      onError: (c) =>
        c.json(
          { error: { code: "INVALID_REQUEST", message: "Request too large" } },
          413,
        ),
    }),
  );
  const error = response(orderErrorSchema);
  const repeatRoutes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/{id}/repeat/source",
        request: { params: z.object({ shopId: z.uuid(), id: z.uuid() }) },
        responses: {
          200: response(repeatSourceSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const p = c.req.valid("param");
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          p.shopId,
          (ctx) => readRepeatSource(ctx, p.id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.order.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/{id}/repeat/create",
        request: {
          params: z.object({ shopId: z.uuid(), id: z.uuid() }),
          body: {
            required: true,
            content: {
              "application/json": { schema: createRepeatOrderSchema },
            },
          },
        },
        responses: {
          200: response(draftSuccessSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          428: error,
          429: error,
          503: error,
        },
      }),
      async (c) => {
        const p = c.req.valid("param");
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          p.shopId,
          (ctx) =>
            createRepeatOrder(ctx, p.id, c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId:
                c.req.header("X-Request-Id") ?? globalThis.crypto.randomUUID(),
            }),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.draft.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/repeat/review",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: repeatOrderDraftSchema } },
          },
        },
        responses: {
          200: response(orderReviewSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewRepeatOrder(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/{id}/repeat/links",
        request: {
          params: z.object({ shopId: z.uuid(), id: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: orderListQuerySchema } },
          },
        },
        responses: {
          200: response(repeatLinksSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const p = c.req.valid("param");
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          p.shopId,
          (ctx) => readRepeatLinks(ctx, p.id, c.req.valid("json").before),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof OrderFailure) {
      if (e.body.current) c.header("ETag", `"v${e.body.current.version}"`);
      return c.json(e.body, e.status);
    }
    if (e instanceof DraftFailure) return c.json(e.body, e.status);
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      return c.json(
        { error: { code: e.message, message: "Intake source unavailable" } },
        e.status,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Request denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (e instanceof HTTPException && [400, 415].includes(e.status))
      return c.json(
        { error: { code: "VALIDATION_FAILED", message: "Check request body" } },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Intake temporarily unavailable",
        },
      },
      503,
    );
  });
  return repeatRoutes;
}
