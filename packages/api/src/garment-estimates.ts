import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  customerEstimateSchema,
  estimateDraftSchema,
  estimateHistorySchema,
  estimateQuerySchema,
  estimateReadSchema,
  estimateReviewSchema,
} from "@aarili/contracts/garment-estimates";
import { DraftFailure } from "@aarili/core/drafts";
import {
  estimateHistory,
  readEstimate,
  reviewEstimate,
} from "@aarili/core/garment-estimates";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private estimate response",
  content: { "application/json": { schema } },
});
const failures = {
  401: response(draftErrorSchema),
  403: response(draftErrorSchema),
  404: response(draftErrorSchema),
  409: response(draftErrorSchema),
  412: response(draftErrorSchema),
  413: response(draftErrorSchema),
  422: response(draftErrorSchema),
  503: response(draftErrorSchema),
};
const params = z.object({ shopId: z.uuid() }),
  idBody = z.strictObject({ id: z.uuid() });
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
export function createGarmentEstimatesRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerGarmentEstimates">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review estimate fields",
            },
          },
          422,
        );
    },
  });
  const limit = bodyLimit({
    maxSize: 250000,
    onError: (c) =>
      c.json(
        { error: { code: "INVALID_REQUEST", message: "Request too large" } },
        413,
      ),
  });
  app.use("/shops/*/estimates/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Request-Id", crypto.randomUUID());
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Origin denied" } },
        403,
      );
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "VALIDATION_FAILED", message: "Use a request body" } },
        422,
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
        path: "/shops/{shopId}/estimates/review",
        request: { params, body: body(estimateDraftSchema) },
        responses: { 200: response(estimateReviewSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerGarmentEstimates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewEstimate(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/estimates/read",
        request: { params, body: body(idBody) },
        responses: { 200: response(estimateReadSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerGarmentEstimates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readEstimate(ctx, c.req.valid("json").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/estimates/customer",
        request: { params, body: body(idBody) },
        responses: { 200: response(customerEstimateSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerGarmentEstimates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          async (ctx) =>
            (await readEstimate(ctx, c.req.valid("json").id)).version.customer,
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(customerEstimateSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/estimates/history",
        request: { params, body: body(estimateQuerySchema) },
        responses: { 200: response(estimateHistorySchema), ...failures },
      }),
      async (c) => {
        const q = c.req.valid("json"),
          r = await owner.withOwnerGarmentEstimates(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx) => estimateHistory(ctx, q.estimateId, q.beforeVersion),
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
          message: "Estimate unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
