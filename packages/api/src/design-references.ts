import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  designDraftReferenceReadSchema,
  designMediaSubjectSchema,
  designReferenceAssetsSchema,
  designReferencePageSchema,
} from "@aarili/contracts/design-references";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import { mediaReadSchema, mediaVariantSchema } from "@aarili/contracts/media";
import {
  readDesignDraftReferenceBytes,
  readDesignMediaSubject,
  readDesignReferenceBytes,
  readDesignReferenceLibrary,
  readDesignSubjectAssets,
  readPrivateDesignSubjects,
} from "@aarili/core/design-references";
import { DraftFailure } from "@aarili/core/drafts";
import { MediaFailure } from "@aarili/core/media";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
export const designReferenceReadRequestSchema = z.strictObject({
  versionId: z.uuid(),
  referenceId: z.uuid(),
  variant: mediaVariantSchema.optional(),
});
const libraryQuery = z.strictObject({ before: z.uuid().optional() });
const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private design reference",
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
const params = z.object({ shopId: z.uuid() });
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
export function createDesignReferencesRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerDesignReferences">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review the private reference request",
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
      !/^\/api\/shops\/[^/]+\/design-references(?:\/.*)?$/.test(
        new URL(c.req.url).pathname,
      )
    )
      return next();
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Request-Id", crypto.randomUUID());
    if (new URL(c.req.url).search)
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Use the private request body",
          },
        },
        422,
      );
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      if (c.req.header("Origin") !== owner.origin)
        return c.json(
          { error: { code: "UNSAFE_ORIGIN", message: "Request denied" } },
          403,
        );
      const headers = new Headers(c.req.raw.headers);
      headers.delete("Content-Length");
      c.req.raw = new Request(c.req.raw, { headers });
      return limit(c, next);
    }
    await next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/design-references/drafts/read",
        request: {
          params,
          body: body(
            z.strictObject({
              draftId: z.uuid(),
              referenceId: z.uuid(),
              variant: mediaVariantSchema.optional(),
            }),
          ),
        },
        responses: {
          200: response(designDraftReferenceReadSchema),
          ...failures,
        },
      }),
      async (c) => {
        const p = c.req.valid("json"),
          r = await owner.withOwnerDesignReferences(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx, media) =>
              readDesignDraftReferenceBytes(
                ctx,
                media,
                p.draftId,
                p.referenceId,
                p.variant,
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
        path: "/shops/{shopId}/design-references/subjects/list",
        request: {
          params,
          body: body(
            z.strictObject({
              orderId: z.uuid(),
              pieceId: z.uuid().nullable(),
              before: z.uuid().optional(),
            }),
          ),
        },
        responses: { 200: response(designReferencePageSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("json"),
          r = await owner.withOwnerDesignReferences(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx) =>
              readPrivateDesignSubjects(ctx, p.orderId, p.pieceId, p.before),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/design-references/assets",
        request: {
          params,
          body: body(
            z.strictObject({
              subjectId: z.uuid(),
              before: z.uuid().optional(),
            }),
          ),
        },
        responses: { 200: response(designReferenceAssetsSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("json"),
          r = await owner.withOwnerDesignReferences(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx) => readDesignSubjectAssets(ctx, p.subjectId, p.before),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/design-references/library",
        request: { params, body: body(libraryQuery) },
        responses: { 200: response(designReferencePageSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerDesignReferences(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readDesignReferenceLibrary(ctx, c.req.valid("json").before),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/design-references/subjects/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: { 200: response(designMediaSubjectSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerDesignReferences(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readDesignMediaSubject(ctx, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/design-references/read",
        request: { params, body: body(designReferenceReadRequestSchema) },
        responses: { 200: response(mediaReadSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("json"),
          r = await owner.withOwnerDesignReferences(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx, media) =>
              readDesignReferenceBytes(
                ctx,
                media,
                p.versionId,
                p.referenceId,
                p.variant,
              ),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof DraftFailure) return c.json(e.body, e.status);
    if (e instanceof MediaFailure)
      return c.json(
        { error: { code: e.code, message: "Private reference unavailable" } },
        e.status,
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
            message: "Check the request body",
          },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Private references unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
