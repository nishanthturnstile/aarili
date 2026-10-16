import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  documentAccessSchema,
  documentIssueSchema,
  documentStatusSchema,
} from "@aarili/contracts/documents";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  DocumentFailure,
  documentAccess,
  documentStatus,
  issueDocument,
  retryDocument,
} from "@aarili/core/documents";
import { versionTag } from "@aarili/core/request-version";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const error = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const rejected = {
  description: "Private document request rejected",
  content: { "application/json": { schema: error } },
};
const failures = {
  401: rejected,
  403: rejected,
  404: rejected,
  409: rejected,
  412: rejected,
  413: rejected,
  422: rejected,
  428: rejected,
  429: rejected,
  503: rejected,
};
const shop = z.object({
  shopId: z.uuid().transform((value) => value.toLowerCase()),
});
const params = shop.extend({
  docId: z.uuid().transform((value) => value.toLowerCase()),
  revision: z
    .string()
    .regex(/^[1-9][0-9]{0,9}$/)
    .transform(Number)
    .pipe(z.number().int().max(2147483647)),
});
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
export function createDocumentRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerDocument">,
) {
  const router = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check required fields",
            },
          },
          422,
        );
    },
  });
  const limit = bodyLimit({
    maxSize: 200000,
    onError: (c) =>
      c.json(
        {
          error: { code: "INVALID_REQUEST", message: "Request body too large" },
        },
        413,
      ),
  });
  router.use("/shops/*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!/\/shops\/[^/]+\/documents(?:\/|$)/.test(url.pathname)) return next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (url.search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Query rejected" } },
        422,
      );
    if (!["GET", "HEAD"].includes(c.req.method)) {
      if (c.req.header("Origin") !== owner.origin)
        return c.json(
          { error: { code: "UNSAFE_ORIGIN", message: "Origin denied" } },
          403,
        );
      const wait = await owner.commandLimit();
      if (wait) {
        c.header("Retry-After", String(wait));
        return c.json(
          { error: { code: "RATE_LIMITED", message: "Wait before retrying" } },
          429,
        );
      }
      if (Number(c.req.header("Content-Length") ?? 0) > 200000)
        return c.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "Request body too large",
            },
          },
          413,
        );
      const h = new Headers(c.req.raw.headers);
      h.delete("Content-Length");
      c.req.raw = new Request(c.req.raw, { headers: h });
      return limit(c, next);
    }
    return next();
  });
  const app = router
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/documents",
        request: {
          params: shop,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: documentIssueSchema } },
          },
        },
        responses: {
          200: {
            description: "Committed immutable revision queued for processing",
            content: { "application/json": { schema: documentStatusSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId } = c.req.valid("param"),
          input = c.req.valid("json"),
          h = c.req.valid("header");
        if (!h["idempotency-key"])
          throw new DocumentFailure(422, "IDEMPOTENCY_KEY_REQUIRED");
        const r = await owner.withOwnerDocument(
          c.req.raw.headers,
          shopId,
          (ctx) => issueDocument(ctx, input, h["idempotency-key"] ?? ""),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(documentStatusSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/documents/{docId}/{revision}/status",
        request: { params },
        responses: {
          200: {
            description: "Authorized current processing state",
            content: { "application/json": { schema: documentStatusSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, docId, revision } = c.req.valid("param");
        const r = await owner.withOwnerDocument(
          c.req.raw.headers,
          shopId,
          (ctx) => documentStatus(ctx, docId, revision),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(documentStatusSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/documents/{docId}/{revision}/retry",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: z.strictObject({}) } },
          },
        },
        responses: {
          200: {
            description: "Same revision queued for authorized retry",
            content: { "application/json": { schema: documentStatusSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, docId, revision } = c.req.valid("param"),
          h = c.req.valid("header");
        if (!h["idempotency-key"])
          throw new DocumentFailure(422, "IDEMPOTENCY_KEY_REQUIRED");
        const r = await owner.withOwnerDocument(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            retryDocument(
              ctx,
              docId,
              revision,
              h["idempotency-key"] ?? "",
              h["if-match"] ?? null,
            ),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(documentStatusSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/documents/{docId}/{revision}/access",
        request: { params },
        responses: {
          200: {
            description: "Authorized private immutable PDF capability",
            content: { "application/json": { schema: documentAccessSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, docId, revision } = c.req.valid("param");
        const r = await owner.withOwnerDocument(
          c.req.raw.headers,
          shopId,
          (ctx) => documentAccess(ctx, docId, revision),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(documentAccessSchema.parse(r.data), 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof DocumentFailure)
      return c.json(
        {
          error: { code: e.code, message: "Private document request rejected" },
        },
        e.status,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Access denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (e instanceof HTTPException && e.status === 400)
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check required fields",
          },
        },
        422,
      );
    return c.json(
      {
        error: {
          code: "DOCUMENT_UNAVAILABLE",
          message: "Private document temporarily unavailable",
        },
      },
      503,
    );
  });
  return app;
}
