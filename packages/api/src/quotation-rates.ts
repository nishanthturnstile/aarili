import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  policyBindingQuerySchema,
  policyBindingsSchema,
  rateHistoryQuerySchema,
  rateHistorySchema,
  rateResolutionSchema,
  rateResolveQuerySchema,
  rateRevisionSchema,
  ratesListQuerySchema,
  ratesListSchema,
} from "@aarili/contracts/quotation-rates";
import { DraftFailure } from "@aarili/core/drafts";
import {
  listRates,
  policyHistory,
  rateHistory,
  rateRevision,
  resolveRate,
} from "@aarili/core/quotation-rates";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private quotation configuration",
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
export function createQuotationRatesRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerQuotationRates">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review quotation configuration fields",
            },
          },
          422,
        );
    },
  });
  const limit = bodyLimit({
    maxSize: 131072,
    onError: (c) =>
      c.json(
        { error: { code: "INVALID_REQUEST", message: "Request too large" } },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    if (
      !/^\/api\/shops\/[^/]+\/settings\/rates(?:\/.*)?$/.test(
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
    if (!["GET", "HEAD"].includes(c.req.method)) {
      if (c.req.header("Origin") !== owner.origin)
        return c.json(
          {
            error: { code: "UNSAFE_ORIGIN", message: "Request origin denied" },
          },
          403,
        );
      const h = new Headers(c.req.raw.headers);
      h.delete("Content-Length");
      c.req.raw = new Request(c.req.raw, { headers: h });
      return limit(c, next);
    }
    return next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/rates/list",
        request: { params, body: body(ratesListQuerySchema) },
        responses: { 200: response(ratesListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerQuotationRates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => listRates(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/rates/history",
        request: { params, body: body(rateHistoryQuerySchema) },
        responses: { 200: response(rateHistorySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerQuotationRates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => rateHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/rates/policies",
        request: { params, body: body(policyBindingQuerySchema) },
        responses: { 200: response(policyBindingsSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerQuotationRates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => policyHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/rates/resolve",
        request: { params, body: body(rateResolveQuerySchema) },
        responses: { 200: response(rateResolutionSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerQuotationRates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => resolveRate(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/rates/revisions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: { 200: response(rateRevisionSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerQuotationRates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => rateRevision(ctx, c.req.valid("param").id),
        );
        c.header("ETag", `"v${r.data.version}"`);
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
          error: {
            code: "VALIDATION_FAILED",
            message: "Review the request body",
          },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Quotation configuration unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
