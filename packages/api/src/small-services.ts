import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  acceptedServiceOrderSchema,
  bookingServiceScopeSchema,
  serviceChangeDraftSchema,
  serviceChangeReviewSchema,
  serviceIntakeDraftSchema,
  serviceIntakeReviewSchema,
  serviceLineCommandSchema,
  serviceLineProgressSchema,
  serviceLineResultSchema,
  serviceOrderDraftSchema,
  serviceOrderListSchema,
  serviceOrderReviewSchema,
  serviceProfileHistoryQuerySchema,
  serviceProfileHistorySchema,
  serviceProfileListSchema,
  serviceProfileQuerySchema,
  serviceProfileRevisionSchema,
  serviceScopeSchema,
  smallServiceErrorSchema,
} from "@aarili/contracts/small-services";
import { CustomerFailure } from "@aarili/core/customers";
import { DraftFailure } from "@aarili/core/drafts";
import { OrderFailure } from "@aarili/core/orders";
import {
  commandServiceLine,
  listServiceOrders,
  readBookingServiceScope,
  readServiceLineProgress,
  readServiceOrder,
  readServiceProfile,
  readServiceProfileHistory,
  readServiceProfiles,
  readServiceScope,
  reviewServiceChange,
  reviewServiceIntake,
  reviewServiceOrder,
} from "@aarili/core/small-services";
import { GuardianFailure, WearerFailure } from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private lightweight service intake",
  content: { "application/json": { schema } },
});
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
const error = response(smallServiceErrorSchema);
const failures = {
  401: error,
  403: error,
  404: error,
  409: error,
  412: error,
  413: error,
  422: error,
  428: error,
  429: error,
  503: error,
};
const params = z.object({ shopId: z.uuid() });
const identified = z.object({ shopId: z.uuid(), id: z.uuid() });

export function createSmallServiceRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerSmallServices" | "commandLimit">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check service intake fields",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/:shopId/small-services/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Request-Id", crypto.randomUUID());
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Use a request body" } },
        422,
      );
    if (
      !["GET", "HEAD"].includes(c.req.method) &&
      c.req.header("Origin") !== owner.origin
    )
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request denied" } },
        403,
      );
    const h = new Headers(c.req.raw.headers);
    if (
      c.req.method === "POST" &&
      c.req.path.includes("/small-services/progress/")
    ) {
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
    h.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers: h });
    return next();
  });
  app.use(
    "/shops/:shopId/small-services/*",
    bodyLimit({
      maxSize: 65536,
      onError: (c) =>
        c.json(
          { error: { code: "INVALID_REQUEST", message: "Request too large" } },
          413,
        ),
    }),
  );
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/profiles/list",
        request: { params, body: body(serviceProfileQuerySchema) },
        responses: { 200: response(serviceProfileListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceProfiles(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/small-services/profiles/{id}",
        request: { params: identified },
        responses: { 200: response(serviceProfileRevisionSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerSmallServices(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readServiceProfile(ctx, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/profiles/history",
        request: { params, body: body(serviceProfileHistoryQuerySchema) },
        responses: { 200: response(serviceProfileHistorySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceProfileHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/orders/review",
        request: { params, body: body(serviceOrderDraftSchema) },
        responses: { 200: response(serviceOrderReviewSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewServiceOrder(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/orders/list",
        request: { params, body: body(serviceProfileQuerySchema) },
        responses: { 200: response(serviceOrderListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => listServiceOrders(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/small-services/orders/{id}",
        request: { params: identified },
        responses: { 200: response(acceptedServiceOrderSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerSmallServices(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readServiceOrder(ctx, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/changes/review",
        request: { params, body: body(serviceChangeDraftSchema) },
        responses: { 200: response(serviceChangeReviewSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewServiceChange(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/intake/review",
        request: { params, body: body(serviceIntakeDraftSchema) },
        responses: { 200: response(serviceIntakeReviewSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewServiceIntake(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/small-services/scope/{id}",
        request: { params: identified },
        responses: { 200: response(serviceScopeSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerSmallServices(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readServiceScope(ctx, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    );
  const bookingScopeRoute = routes.openapi(
    createRoute({
      method: "get",
      path: "/shops/{shopId}/small-services/booking-scope/{id}",
      request: { params: identified },
      responses: { 200: response(bookingServiceScopeSchema), ...failures },
    }),
    async (c) => {
      const p = c.req.valid("param"),
        r = await owner.withOwnerSmallServices(
          c.req.raw.headers,
          p.shopId,
          (ctx) => readBookingServiceScope(ctx, p.id),
        );
      for (const cookie of r.headers.getSetCookie())
        c.header("Set-Cookie", cookie, { append: true });
      c.header("ETag", `"${r.data.scopeDigest}"`);
      return c.json(r.data, 200);
    },
  );
  const progressRoutes = bookingScopeRoute
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/small-services/progress/{id}",
        request: { params: identified },
        responses: { 200: response(serviceLineProgressSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerSmallServices(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readServiceLineProgress(ctx, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/small-services/progress/{id}/lines/{lineId}",
        request: {
          params: identified.extend({ lineId: z.uuid() }),
          body: body(serviceLineCommandSchema),
        },
        responses: { 200: response(serviceLineResultSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerSmallServices(
            c.req.raw.headers,
            p.shopId,
            (ctx) =>
              commandServiceLine(ctx, p.id, p.lineId, c.req.valid("json"), {
                key: c.req.header("Idempotency-Key"),
                ifMatch: c.req.header("If-Match"),
                requestId:
                  c.res.headers.get("X-Request-Id") ?? crypto.randomUUID(),
              }),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof DraftFailure || e instanceof OrderFailure)
      return c.json(e.body, e.status);
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      return c.json(
        { error: { code: e.message, message: "Service source unavailable" } },
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
          message: "Service intake temporarily unavailable",
        },
      },
      503,
    );
  });
  return progressRoutes;
}
