import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  mediaAdmissionSchema,
  mediaCompletionSchema,
  mediaReadSchema,
  mediaStatusSchema,
  mediaSuccessSchema,
  mediaUploadSchema,
  mediaVariantSchema,
} from "@aarili/contracts/media";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  admitMedia,
  completeMedia,
  MediaFailure,
  mediaStatus,
  readMedia,
} from "@aarili/core/media";
import { versionTag } from "@aarili/core/request-version";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const error = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
const rejected = {
  description: "Private media request rejected",
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
const shop = z.object({ shopId: z.uuid() });
const params = shop.extend({ id: z.uuid() });
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
export function createMediaRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerMedia">,
) {
  const router = new OpenAPIHono<{ Variables: { requestId: string } }>({
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
    maxSize: 8192,
    onError: (c) =>
      c.json(
        {
          error: { code: "INVALID_REQUEST", message: "Request body too large" },
        },
        413,
      ),
  });
  router.use("/shops/*", async (c, next) => {
    if (!/\/shops\/[^/]+\/files(?:\/|$)/.test(new URL(c.req.url).pathname))
      return next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.set("requestId", crypto.randomUUID());
    if (new URL(c.req.url).search)
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
      const retry = await owner.commandLimit();
      if (retry) {
        c.header("Retry-After", String(retry));
        return c.json(
          { error: { code: "RATE_LIMITED", message: "Wait before retrying" } },
          429,
        );
      }
      if (Number(c.req.header("Content-Length") ?? 0) > 8192)
        return c.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "Request body too large",
            },
          },
          413,
        );
      // Enforce actual streamed bytes even when a forged Content-Length is smaller.
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
        method: "get",
        path: "/shops/{shopId}/files/{id}/status",
        request: { params },
        responses: {
          200: {
            description:
              "Authorized private processing state and accepted derivative metadata",
            content: { "application/json": { schema: mediaStatusSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          mediaStatus(ctx, id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.asset.version));
        return c.json(mediaStatusSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/files/{id}/variants/{variant}/access",
        request: { params: params.extend({ variant: mediaVariantSchema }) },
        responses: {
          200: {
            description:
              "Authorized immutable private image derivative capability",
            content: { "application/json": { schema: mediaReadSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id, variant } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          readMedia(ctx, id, variant),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(mediaReadSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/files/uploads",
        request: {
          params: shop,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: mediaAdmissionSchema } },
          },
        },
        responses: {
          200: {
            description: "Private staging grant; never persist this capability",
            content: { "application/json": { schema: mediaUploadSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          admitMedia(ctx, c.req.valid("json"), {
            key: c.req.header("Idempotency-Key") ?? "",
            requestId: c.get("requestId"),
          }),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.asset.version));
        return c.json(mediaUploadSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/files/{id}/complete",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: mediaCompletionSchema } },
          },
        },
        responses: {
          200: {
            description: "Durably queued processing request",
            content: { "application/json": { schema: mediaSuccessSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          completeMedia(ctx, id, c.req.valid("json"), {
            key: c.req.header("Idempotency-Key") ?? "",
            ifMatch: c.req.header("If-Match"),
            requestId: c.get("requestId"),
          }),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.asset.version));
        return c.json(mediaSuccessSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/files/{id}/access",
        request: { params },
        responses: {
          200: {
            description: "Authorized bounded download capability",
            content: { "application/json": { schema: mediaReadSchema } },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          readMedia(ctx, id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(mediaReadSchema.parse(r.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/files/{id}",
        request: { params },
        responses: {
          303: {
            description:
              "Authorized private download redirect; bounded signed capability",
            headers: {
              Location: { schema: { type: "string", format: "uri" } },
            },
          },
          ...failures,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const r = await owner.withOwnerMedia(c.req.raw.headers, shopId, (ctx) =>
          readMedia(ctx, id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.redirect(mediaReadSchema.parse(r.data).url, 303);
      },
    );
  app.onError((e, c) => {
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
    if (e instanceof MediaFailure)
      return c.json(
        { error: { code: e.code, message: "Private media request rejected" } },
        e.status,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Access denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    return c.json(
      {
        error: {
          code: "MEDIA_UNAVAILABLE",
          message: "Private media temporarily unavailable",
        },
      },
      503,
    );
  });
  return app;
}
