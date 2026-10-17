import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import {
  guardianClaimSchema,
  guardianErrorSchema,
  guardianMutationSchema,
  guardianPeoplePageSchema,
  guardianProfileSchema,
  guardianPurposeEventSchema,
  guardianVerificationSchema,
  wearerPolicySchema,
  wearerSearchSchema,
} from "@aarili/contracts/wearers";
import {
  GuardianFailure,
  mutateGuardian,
  readGuardianPolicy,
  readGuardians,
  searchGuardianPeople,
} from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const error = {
  description: "Guardian request rejected",
  content: { "application/json": { schema: guardianErrorSchema } },
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
  description: "Private guardian registration evidence",
  content: { "application/json": { schema } },
  ...(version
    ? { headers: { ETag: { schema: { type: "string" as const } } } }
    : {}),
});
const shop = z.object({ shopId: z.uuid() }),
  params = shop.extend({ customerId: z.uuid(), id: z.uuid() }),
  headers = z.object({
    "idempotency-key": idempotencyHeaderSchema.optional(),
    "if-match": etagSchema.optional(),
  });
export function createGuardianRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerGuardian">,
) {
  const app = new OpenAPIHono<{ Variables: { requestId: string } }>({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the required guardian fields",
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
    if (
      !/\/shops\/[^/]+\/(?:guardians\/policy|guardian-people\/search|customers\/[^/]+\/wearers\/[^/]+\/guardians(?:\/|$))/.test(
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
            message: "Guardian queries belong in the request body",
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
      if (!c.req.path.endsWith("/guardian-people/search")) {
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
        path: "/shops/{shopId}/guardians/policy",
        request: { params: shop },
        responses: { 200: response(wearerPolicySchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerGuardian(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          async (ctx) => readGuardianPolicy(ctx),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/guardian-people/search",
        request: {
          params: shop,
          body: {
            required: true,
            content: { "application/json": { schema: wearerSearchSchema } },
          },
        },
        responses: { 200: response(guardianPeoplePageSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerGuardian(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => searchGuardianPeople(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}/guardians",
        request: { params },
        responses: { 200: response(guardianProfileSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerGuardian(
            c.req.raw.headers,
            p.shopId,
            (ctx) => readGuardians(ctx, p.customerId, p.id),
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
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}/guardians",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: guardianClaimSchema } },
          },
        },
        responses: { 200: response(guardianMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerGuardian(
            c.req.raw.headers,
            p.shopId,
            (ctx) =>
              mutateGuardian(
                ctx,
                p.customerId,
                p.id,
                "claim",
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
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}/guardians/verification-events",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: {
              "application/json": { schema: guardianVerificationSchema },
            },
          },
        },
        responses: { 200: response(guardianMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerGuardian(
            c.req.raw.headers,
            p.shopId,
            (ctx) =>
              mutateGuardian(
                ctx,
                p.customerId,
                p.id,
                "verify",
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
        path: "/shops/{shopId}/customers/{customerId}/wearers/{id}/guardians/consent-events",
        request: {
          params,
          headers,
          body: {
            required: true,
            content: {
              "application/json": { schema: guardianPurposeEventSchema },
            },
          },
        },
        responses: { 200: response(guardianMutationSchema, true), ...failures },
      }),
      async (c) => {
        const p = c.req.valid("param"),
          r = await owner.withOwnerGuardian(
            c.req.raw.headers,
            p.shopId,
            (ctx) =>
              mutateGuardian(
                ctx,
                p.customerId,
                p.id,
                "purpose",
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
    if (e instanceof GuardianFailure) {
      if (e.current) c.header("ETag", `"v${e.current.version}"`);
      return c.json(
        {
          error: {
            code: e.message,
            message:
              e.message === "GUARDIAN_POLICY_PENDING"
                ? "Draft policy approval is pending; real guardian registration is unavailable"
                : "Guardian request rejected",
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
          message: "Guardian service is unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
