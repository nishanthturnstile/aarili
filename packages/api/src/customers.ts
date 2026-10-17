import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  customerContactSchema,
  customerCreateSchema,
  customerErrorSchema,
  customerMutationSchema,
  customerPolicySchema,
  customerProfileSchema,
  customerSearchPageSchema,
  customerSearchSchema,
} from "@aarili/contracts/customers";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  CustomerFailure,
  mutateCustomer,
  readCustomer,
  readCustomerPolicy,
  searchCustomers,
} from "@aarili/core/customers";
import { versionTag } from "@aarili/core/request-version";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const error = {
  description: "Customer request rejected",
  content: { "application/json": { schema: customerErrorSchema } },
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
const shop = z.object({ shopId: z.uuid() }),
  params = shop.extend({ id: z.uuid() });
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private customer result",
  content: { "application/json": { schema } },
});
export function createCustomerRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerCustomer">,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
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
  const limit = bodyLimit({
    maxSize: 32768,
    onError: (c) =>
      c.json(
        {
          error: { code: "INVALID_REQUEST", message: "Request body too large" },
        },
        413,
      ),
  });
  app.use("/shops/*", async (c, next) => {
    if (!/\/shops\/[^/]+\/customers(?:\/|$)/.test(new URL(c.req.url).pathname))
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
            message: "Customer queries belong in the request body",
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
      // Search is a bounded, authorised read. POST keeps private queries out of
      // URLs; it does not turn that read into a business mutation.
      const retry = c.req.path.endsWith("/customers/search")
        ? 0
        : await owner.commandLimit();
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
        path: "/shops/{shopId}/customers/policy",
        request: { params: shop },
        responses: { 200: response(customerPolicySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerCustomer(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          async (ctx) => readCustomerPolicy(ctx),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/customers/search",
        request: {
          params: shop,
          body: {
            required: true,
            content: { "application/json": { schema: customerSearchSchema } },
          },
        },
        responses: { 200: response(customerSearchPageSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerCustomer(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => searchCustomers(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/customers",
        request: {
          params: shop,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: customerCreateSchema } },
          },
        },
        responses: { 200: response(customerMutationSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerCustomer(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            mutateCustomer(ctx, "create", undefined, c.req.valid("json"), {
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
        method: "get",
        path: "/shops/{shopId}/customers/{id}",
        request: { params },
        responses: { 200: response(customerProfileSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param");
        const r = await owner.withOwnerCustomer(
          c.req.raw.headers,
          p.shopId,
          (ctx) => readCustomer(ctx, p.id),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", versionTag(r.data.version));
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/shops/{shopId}/customers/{id}",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: customerContactSchema } },
          },
        },
        responses: { 200: response(customerMutationSchema), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param");
        const r = await owner.withOwnerCustomer(
          c.req.raw.headers,
          p.shopId,
          (ctx) =>
            mutateCustomer(ctx, "correct", p.id, c.req.valid("json"), {
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
    );
  routes.onError((e, c) => {
    if (e instanceof CustomerFailure) {
      if (e.current) c.header("ETag", versionTag(e.current.version));
      return c.json(
        {
          error: {
            code: e.message,
            message:
              e.message === "CUSTOMER_POLICY_PENDING"
                ? "Privacy policy approval is pending; real customer registration is unavailable"
                : "Customer request rejected",
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
          message: "Customer service is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
