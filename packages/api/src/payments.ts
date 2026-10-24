import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  paymentDuplicateQuerySchema,
  paymentHistoryQuerySchema,
  paymentHistorySchema,
  paymentListSchema,
  paymentOptionsSchema,
  paymentPositionSchema,
  paymentQuerySchema,
  paymentReadSchema,
  paymentReceiptSchema,
} from "@aarili/contracts/payments";
import { DraftFailure } from "@aarili/core/drafts";
import {
  listPayments,
  paymentDuplicate,
  paymentHistory,
  paymentOptions,
  paymentPosition,
  readPayment,
} from "@aarili/core/payments";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private payment readback",
  content: { "application/json": { schema } },
});
const error = response(draftErrorSchema),
  failures = {
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
const params = z.object({ shopId: z.uuid() }),
  body = <S extends z.ZodType>(schema: S) => ({
    required: true,
    content: { "application/json": { schema } },
  });
export function createPaymentsRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerPayments">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review payment fields",
            },
          },
          422,
        );
    },
  });
  const limit = bodyLimit({
    maxSize: 65536,
    onError: (c) =>
      c.json(
        { error: { code: "INVALID_REQUEST", message: "Request too large" } },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    if (
      !/^\/api\/shops\/[^/]+\/payments(?:\/.*)?$/.test(
        new URL(c.req.url).pathname,
      )
    )
      return next();
    c.header("X-Request-Id", crypto.randomUUID());
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Use a request body" } },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request origin denied" } },
        403,
      );
    const h = new Headers(c.req.raw.headers);
    h.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers: h });
    return limit(c, next);
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/payments/options",
        request: { params, body: body(z.strictObject({})) },
        responses: { 200: response(paymentOptionsSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerPayments(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          paymentOptions,
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/payments/list",
        request: { params, body: body(paymentQuerySchema) },
        responses: { 200: response(paymentListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerPayments(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => listPayments(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/payments/read",
        request: { params, body: body(paymentReadSchema) },
        responses: { 200: response(paymentReceiptSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerPayments(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readPayment(ctx, c.req.valid("json").id),
        );
        c.header("ETag", `"v${r.data.current.version}"`);
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/payments/history",
        request: { params, body: body(paymentHistoryQuerySchema) },
        responses: { 200: response(paymentHistorySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerPayments(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => paymentHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/payments/position",
        request: {
          params,
          body: body(z.strictObject({ customerId: z.uuid() })),
        },
        responses: { 200: response(paymentPositionSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerPayments(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => paymentPosition(ctx, c.req.valid("json").customerId),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  const allRoutes = routes.openapi(
    createRoute({
      method: "post",
      path: "/shops/{shopId}/payments/duplicate",
      request: { params, body: body(paymentDuplicateQuerySchema) },
      responses: { 200: response(paymentReceiptSchema), ...failures },
    }),
    async (c) => {
      const r = await owner.withOwnerPayments(
        c.req.raw.headers,
        c.req.valid("param").shopId,
        (ctx) => paymentDuplicate(ctx, c.req.valid("json")),
      );
      for (const cookie of r.headers.getSetCookie())
        c.header("Set-Cookie", cookie, { append: true });
      return c.json(r.data, 200);
    },
  );
  app.onError((e, c) => {
    if (e instanceof DraftFailure) return c.json(e.body, e.status);
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Request denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (e instanceof HTTPException && [400, 415].includes(e.status))
      return c.json(
        {
          error: { code: "VALIDATION_FAILED", message: "Review request body" },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Payment readback unavailable",
        },
      },
      503,
    );
  });
  return allRoutes;
}
