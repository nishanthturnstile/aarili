import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  measurementFormsDefinitionSchema,
  measurementFormsEntrySchema,
  measurementFormsHistoryQuerySchema,
  measurementFormsHistorySchema,
  measurementFormsListSchema,
  measurementFormsQuerySchema,
  measurementFormsRevisionSchema,
} from "@aarili/contracts/measurement-forms";
import { DraftFailure } from "@aarili/core/drafts";
import {
  readMeasurementFormDefinition,
  readMeasurementFormEntry,
  readMeasurementFormHistory,
  readMeasurementFormRevision,
  readMeasurementForms,
} from "@aarili/core/measurement-forms";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private shop measurementForms",
  content: { "application/json": { schema } },
});
const error = response(draftErrorSchema);
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
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
export function createMeasurementFormsRoutes(
  owner: Pick<
    OwnerAuth,
    "origin" | "commandLimit" | "withOwnerMeasurementForms"
  >,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the measurementForms fields",
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
      !/^\/api\/shops\/[^/]+\/settings\/measurement-forms(?:\/.*)?$/.test(
        new URL(c.req.url).pathname,
      )
    )
      return next();
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.set("requestId", crypto.randomUUID());
    c.header("X-Request-Id", c.get("requestId"));
    if (new URL(c.req.url).search)
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Use request bodies for measurementForms queries",
          },
        },
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
      if (c.req.method === "PUT") {
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
      const h = new Headers(c.req.raw.headers);
      h.delete("Content-Length");
      c.req.raw = new Request(c.req.raw, { headers: h });
      return limit(c, next);
    }
    await next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/measurement-forms/list",
        request: { params, body: body(measurementFormsQuerySchema) },
        responses: { 200: response(measurementFormsListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerMeasurementForms(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readMeasurementForms(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/measurement-forms/entries/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: { 200: response(measurementFormsEntrySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerMeasurementForms(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readMeasurementFormEntry(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/measurement-forms/history",
        request: { params, body: body(measurementFormsHistoryQuerySchema) },
        responses: {
          200: response(measurementFormsHistorySchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerMeasurementForms(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readMeasurementFormHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/measurement-forms/revisions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: {
          200: response(measurementFormsRevisionSchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerMeasurementForms(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readMeasurementFormRevision(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/measurement-forms/definitions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: {
          200: response(measurementFormsDefinitionSchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerMeasurementForms(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readMeasurementFormDefinition(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof DraftFailure) {
      return c.json(e.body, e.status);
    }
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
            message: "Check the request body",
          },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Shop measurementForms is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
