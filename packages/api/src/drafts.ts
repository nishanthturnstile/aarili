import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  type DraftCursor,
  draftCursorSchema,
  draftErrorSchema,
  draftIdSchema,
  draftListQuerySchema,
  draftListSchema,
  draftPromotionSchema,
  draftRecordSchema,
  draftSaveSchema,
  draftSuccessSchema,
} from "@aarili/contracts/drafts";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  DraftFailure,
  listDrafts,
  mutateDraft,
  readDraft,
} from "@aarili/core/drafts";
import { versionTag } from "@aarili/core/request-version";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const error = {
  description: "Draft request rejected without foreign state disclosure.",
  content: { "application/json": { schema: draftErrorSchema } },
};
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
const success = {
  description: "Committed or replayed draft.",
  headers: { ETag: { schema: { type: "string" as const } } },
  content: { "application/json": { schema: draftSuccessSchema } },
};
const shop = z.object({ shopId: z.uuid() });
const params = shop.extend({ id: draftIdSchema });
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
export function createDraftRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerDraft">,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (result, c) => {
      if (!result.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the required fields",
            },
          },
          422,
        );
    },
  });
  const maximumBodyBytes = 512 * 1024;
  const rejectLargeBody = bodyLimit({
    maxSize: maximumBodyBytes,
    onError: (c) =>
      c.json(
        {
          error: { code: "INVALID_REQUEST", message: "Request body too large" },
        },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    // Other modules share /shops; never apply draft admission/rate limits to them.
    if (!/\/shops\/[^/]+\/drafts(?:\/|$)/.test(new URL(c.req.url).pathname))
      return next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    if (!["GET", "HEAD"].includes(c.req.method)) {
      if (new URL(c.req.url).search)
        return c.json(
          { error: { code: "INVALID_REQUEST", message: "Query rejected" } },
          422,
        );
      if (c.req.header("Origin") !== owner.origin)
        return c.json(
          {
            error: { code: "UNSAFE_ORIGIN", message: "Request origin denied" },
          },
          403,
        );
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
      if (Number(c.req.header("Content-Length") ?? 0) > maximumBodyBytes)
        return c.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "Request body too large",
            },
          },
          413,
        );
      // Enforce actual stream bytes even when a caller understates Content-Length.
      // Hono otherwise trusts that header and skips its streaming measurement.
      const boundedHeaders = new Headers(c.req.raw.headers);
      boundedHeaders.delete("Content-Length");
      c.req.raw = new Request(c.req.raw, { headers: boundedHeaders });
      return rejectLargeBody(c, next);
    }
    await next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/drafts",
        request: { params: shop, query: draftListQuerySchema },
        responses: {
          200: {
            description: "Committed active drafts in creation order.",
            content: { "application/json": { schema: draftListSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId } = c.req.valid("param");
        const q = c.req.valid("query");
        let cursor: DraftCursor | undefined;
        if (q.cursor) {
          try {
            cursor = draftCursorSchema.parse(JSON.parse(q.cursor));
          } catch {
            throw new DraftFailure(422, {
              error: { code: "VALIDATION_FAILED", message: "Invalid cursor" },
            });
          }
        }
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) => listDrafts(ctx, q.limit ? Number(q.limit) : 25, cursor),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftListSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/drafts/{id}",
        request: { params },
        responses: {
          200: {
            description: "Committed authorized draft.",
            headers: { ETag: { schema: { type: "string" } } },
            content: { "application/json": { schema: draftRecordSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) => readDraft(ctx, id),
        );
        c.header("ETag", versionTag(result.data.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftRecordSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/shops/{shopId}/drafts/{id}",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: draftSaveSchema } },
          },
        },
        responses: { 200: success, ...failures },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            mutateDraft(ctx, id, "save", c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId: c.get("requestId"),
            }),
        );
        c.header("ETag", versionTag(result.data.draft.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftSuccessSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/drafts/{id}/convert",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: draftPromotionSchema } },
          },
        },
        responses: { 200: success, ...failures },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            mutateDraft(ctx, id, "convert", c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId: c.get("requestId"),
            }),
        );
        c.header("ETag", versionTag(result.data.draft.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftSuccessSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/drafts/{id}/promote",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: draftPromotionSchema } },
          },
        },
        responses: { 200: success, ...failures },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            mutateDraft(ctx, id, "promote", c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId: c.get("requestId"),
            }),
        );
        c.header("ETag", versionTag(result.data.draft.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftSuccessSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/drafts/{id}/abandon",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: draftPromotionSchema } },
          },
        },
        responses: { 200: success, ...failures },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerDraft(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            mutateDraft(ctx, id, "abandon", c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId: c.get("requestId"),
            }),
        );
        c.header("ETag", versionTag(result.data.draft.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(draftSuccessSchema.parse(result.data), 200);
      },
    );
  routes.onError((failure, c) => {
    if (failure instanceof DraftFailure) {
      if (failure.body.current)
        c.header("ETag", versionTag(failure.body.current.version));
      return c.json(draftErrorSchema.parse(failure.body), failure.status);
    }
    if (failure instanceof HTTPException && failure.status === 400)
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check the required fields",
          },
        },
        422,
      );
    if (failure instanceof OwnerAccessError)
      return c.json(
        { error: { code: failure.code, message: "Request denied" } },
        failure.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    return c.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Request failed; retry with the same key",
        },
      },
      503,
    );
  });
  return routes;
}
