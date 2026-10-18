import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  wearerCreateSchema,
  wearerErrorSchema,
  wearerListSchema,
  wearerMutationSchema,
  wearerPolicySchema,
  wearerProfileSchema,
  wearerPurposeEventSchema,
  wearerSearchPageSchema,
  wearerSearchSchema,
  wearerUpdateSchema,
} from "@aarili/contracts/wearers";
import {
  listWearers,
  mutateWearer,
  readWearer,
  readWearerPolicy,
  searchWearers,
  WearerFailure,
} from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

export { createGuardianRoutes } from "./guardians.js";

const error = {
  description: "Wearer request rejected",
  content: { "application/json": { schema: wearerErrorSchema } },
};
const failures = {
  401: error,
  403: error,
  404: error,
  409: error,
  412: { ...error, headers: { ETag: { schema: { type: "string" as const } } } },
  413: error,
  422: error,
  428: error,
  429: error,
  503: error,
};
const response = <S extends z.ZodType>(schema: S, version = false) => ({
  description: "Private wearer result",
  content: { "application/json": { schema } },
  ...(version
    ? { headers: { ETag: { schema: { type: "string" as const } } } }
    : {}),
});
const shop = z.object({ shopId: z.uuid() }),
  customer = shop.extend({ customerId: z.uuid() }),
  params = customer.extend({ id: z.uuid() });
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
export function createWearerRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerWearer">,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the required wearer fields",
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
        {
          error: { code: "INVALID_REQUEST", message: "Request body too large" },
        },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    if (c.req.path.includes("/guardians")) return next();
    if (
      !/\/shops\/[^/]+\/(?:wearers|customers\/[^/]+\/wearers)(?:\/|$)/.test(
        c.req.path,
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
            message: "Wearer queries belong in the request body",
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
      if (!c.req.path.endsWith("/wearers/search")) {
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
        path: "/shops/{shopId}/wearers/policy",
        request: { params: shop },
        responses: { 200: response(wearerPolicySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerWearer(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          async (ctx) => readWearerPolicy(ctx),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/wearers/search",
        request: {
          params: shop,
          body: {
            required: true,
            content: { "application/json": { schema: wearerSearchSchema } },
          },
        },
        responses: { 200: response(wearerSearchPageSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerWearer(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => searchWearers(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/customers/{customerId}/wearers",
        request: { params: customer },
        responses: { 200: response(wearerListSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerWearer(c.req.raw.headers, p.shopId, (ctx) =>
            listWearers(ctx, p.customerId),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/customers/{customerId}/wearers",
        request: {
          params: customer,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: wearerCreateSchema } },
          },
        },
        responses: { 200: response(wearerMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerWearer(c.req.raw.headers, p.shopId, (ctx) =>
            mutateWearer(
              ctx,
              p.customerId,
              "create",
              undefined,
              c.req.valid("json"),
              {
                key: c.req.header("Idempotency-Key"),
                ifMatch: c.req.header("If-Match"),
                requestId: c.get("requestId"),
              },
            ),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}",
        request: { params },
        responses: { 200: response(wearerProfileSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerWearer(c.req.raw.headers, p.shopId, (ctx) =>
            readWearer(ctx, p.customerId, p.id),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: wearerUpdateSchema } },
          },
        },
        responses: { 200: response(wearerMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerWearer(c.req.raw.headers, p.shopId, (ctx) =>
            mutateWearer(
              ctx,
              p.customerId,
              "update",
              p.id,
              c.req.valid("json"),
              {
                key: c.req.header("Idempotency-Key"),
                ifMatch: c.req.header("If-Match"),
                requestId: c.get("requestId"),
              },
            ),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}/consent-events",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: {
              "application/json": { schema: wearerPurposeEventSchema },
            },
          },
        },
        responses: { 200: response(wearerMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerWearer(c.req.raw.headers, p.shopId, (ctx) =>
            mutateWearer(
              ctx,
              p.customerId,
              "purpose",
              p.id,
              c.req.valid("json"),
              {
                key: c.req.header("Idempotency-Key"),
                ifMatch: c.req.header("If-Match"),
                requestId: c.get("requestId"),
              },
            ),
          );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.version}"`);
        return c.json(r.data, 200);
      },
    );
  routes.onError((e, c) => {
    if (e instanceof WearerFailure) {
      if (e.current) c.header("ETag", `"v${e.current.version}"`);
      return c.json(
        {
          error: {
            code: e.message,
            message:
              e.message === "WEARER_POLICY_PENDING"
                ? "Privacy policy approval is pending; real wearer registration is unavailable"
                : "Wearer request rejected",
          },
          ...(e.current ? { current: e.current } : {}),
        },
        e.status,
      );
    }
    if (e instanceof HTTPException && (e.status === 400 || e.status === 415))
      return c.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Check the request body",
          },
        },
        422,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Request denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Wearer service is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
