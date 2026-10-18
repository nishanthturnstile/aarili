import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  shopProfileErrorSchema,
  shopProfileHistoryQuerySchema,
  shopProfileHistorySchema,
  shopProfileInputSchema,
  shopProfileRevisionSchema,
  shopProfileStateSchema,
} from "@aarili/contracts/shop-profile";
import { versionTag } from "@aarili/core/request-version";
import {
  readShopProfile,
  readShopProfileHistory,
  readShopProfileRevision,
  reviseShopProfile,
  ShopProfileFailure,
} from "@aarili/core/shop-profile";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private shop profile",
  content: { "application/json": { schema } },
});
const error = response(shopProfileErrorSchema);
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
export function createShopProfileRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerShopProfile">,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the profile fields",
            },
          },
          422,
        );
    },
  });
  const limit = bodyLimit({
    maxSize: 16384,
    onError: (c) =>
      c.json(
        { error: { code: "INVALID_REQUEST", message: "Request too large" } },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    if (
      !/^\/api\/shops\/[^/]+\/settings\/profile(?:\/.*)?$/.test(
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
            message: "Use request bodies for profile queries",
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
        method: "get",
        path: "/shops/{shopId}/settings/profile",
        request: { params },
        responses: { 200: response(shopProfileStateSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerShopProfile(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          readShopProfile,
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "put",
        path: "/shops/{shopId}/settings/profile",
        request: {
          params,
          headers: z.object({
            "idempotency-key": idempotencyHeaderSchema.optional(),
            "if-match": etagSchema.optional(),
          }),
          body: body(shopProfileInputSchema),
        },
        responses: { 200: response(shopProfileStateSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerShopProfile(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            reviseShopProfile(ctx, c.req.valid("json"), {
              key: c.req.header("Idempotency-Key"),
              ifMatch: c.req.header("If-Match"),
              requestId: c.get("requestId"),
            }),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/settings/profile/history",
        request: { params, body: body(shopProfileHistoryQuerySchema) },
        responses: { 200: response(shopProfileHistorySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerShopProfile(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readShopProfileHistory(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/settings/profile/revisions/{id}",
        request: { params: params.extend({ id: z.uuid() }) },
        responses: { 200: response(shopProfileRevisionSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerShopProfile(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readShopProfileRevision(ctx, c.req.valid("param").id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof ShopProfileFailure) {
      if (e.current) c.header("ETag", versionTag(e.current.version));
      return c.json(
        {
          error: { code: e.code, message: "Profile change rejected" },
          ...(e.current ? { current: e.current } : {}),
        },
        e.status,
      );
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
          message: "Shop profile is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
