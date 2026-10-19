import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  presentationStateSchema,
  serviceRequirementsPreviewRequestSchema,
  serviceRequirementsPreviewSchema,
  serviceTemplatesDefinitionSchema,
  serviceTemplatesEntrySchema,
  serviceTemplatesHistoryQuerySchema,
  serviceTemplatesHistorySchema,
  serviceTemplatesListSchema,
  serviceTemplatesQuerySchema,
  serviceTemplatesRevisionSchema,
} from "@aarili/contracts/service-templates";
import { DraftFailure } from "@aarili/core/drafts";
import {
  previewServiceRequirements,
  readPresentation,
  readServiceTemplateDefinition,
  readServiceTemplateEntry,
  readServiceTemplateHistory,
  readServiceTemplateRevision,
  readServiceTemplates,
} from "@aarili/core/service-templates";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private shop serviceTemplates",
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
export function createServiceTemplatesRoutes(
  owner: Pick<
    OwnerAuth,
    "origin" | "commandLimit" | "withOwnerServiceTemplates"
  >,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the serviceTemplates fields",
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
      !/^\/api\/shops\/[^/]+\/settings\/service-templates(?:\/.*)?$/.test(
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
            message: "Use request bodies for serviceTemplates queries",
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
        path: "/shops/{shopId}/settings/service-templates/presentation",
        request: {
          params,
          body: body(
            z.strictObject({
              beforeVersion: z.number().int().positive().optional(),
            }),
          ),
        },
        responses: { 200: response(presentationStateSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readPresentation(ctx, c.req.valid("json").beforeVersion),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/service-templates/preview",
        request: {
          params,
          body: body(serviceRequirementsPreviewRequestSchema),
        },
        responses: {
          200: response(serviceRequirementsPreviewSchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            previewServiceRequirements(
              ctx,
              c.req.valid("json").content,
              c.req.valid("json").templateRevisionId ?? undefined,
            ),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/service-templates/list",
        request: { params, body: body(serviceTemplatesQuerySchema) },
        responses: { 200: response(serviceTemplatesListSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceTemplates(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/service-templates/entries/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: { 200: response(serviceTemplatesEntrySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceTemplateEntry(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/service-templates/history",
        request: { params, body: body(serviceTemplatesHistoryQuerySchema) },
        responses: {
          200: response(serviceTemplatesHistorySchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceTemplateHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/service-templates/revisions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: {
          200: response(serviceTemplatesRevisionSchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceTemplateRevision(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/service-templates/definitions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: {
          200: response(serviceTemplatesDefinitionSchema),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerServiceTemplates(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readServiceTemplateDefinition(ctx, c.req.valid("param").id),
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
          message: "Shop serviceTemplates is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
