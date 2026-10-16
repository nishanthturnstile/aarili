import type { OwnerAuth } from "@aarili/auth";
import { OwnerAccessError } from "@aarili/auth";
import {
  apiErrorSchema,
  googleConnectionSchema,
  ownerActionSchema,
  ownerShopSchema,
  reauthenticationSchema,
  recoveryRequestSchema,
  recoveryResetSchema,
  resendCommandSchema,
  setupCommandSchema,
  shopRecordSchema,
  signInCommandSchema,
  verificationCommandSchema,
} from "@aarili/contracts";
import { readShop } from "@aarili/core";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

const errorResponse = {
  description: "Request denied; no private configuration returned.",
  content: { "application/json": { schema: apiErrorSchema } },
};
const actionResponses = {
  200: {
    description: "Owner setup progress.",
    content: { "application/json": { schema: ownerActionSchema } },
  },
  401: errorResponse,
  403: errorResponse,
  409: errorResponse,
  422: errorResponse,
  429: errorResponse,
  503: errorResponse,
};
function sessionResponse<T extends Response>(response: T, headers: Headers): T {
  for (const cookie of headers.getSetCookie())
    response.headers.append("Set-Cookie", cookie);
  return response;
}
function command<const Path extends string, Body extends z.ZodType>(
  path: Path,
  body: Body,
) {
  return createRoute({
    method: "post",
    path,
    request: {
      body: {
        required: true,
        content: { "application/json": { schema: body } },
      },
    },
    responses: actionResponses,
  });
}

export function createOwnerRoutes(owner: OwnerAuth) {
  const app = new OpenAPIHono({
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
  app.use("*", async (c, next) => {
    // Shop modules own their admission rules. This owner middleware protects
    // owner/auth routes and its single shop-read path, not nested draft routes.
    const ownerOrAuth = /^\/api\/(owner|auth)\//.test(c.req.path);
    const shopRead = /^\/api\/shops\/[^/]+$/.test(c.req.path);
    if (
      (!ownerOrAuth && !shopRead) ||
      c.req.path === "/api/owner/sensitive-probe"
    )
      return next();
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    const googleCallback =
      c.req.method === "GET" && c.req.path === "/api/auth/callback/google";
    if (new URL(c.req.url).search && !googleCallback)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Request failed" } },
        422,
      );
    if (
      !["GET", "HEAD"].includes(c.req.method) &&
      c.req.header("Origin") !== owner.origin
    )
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request origin denied" } },
        403,
      );
    const limiter = c.req.path.endsWith("/recovery/request")
      ? owner.recoveryLimit
      : c.req.path.endsWith("/recovery/reset")
        ? owner.redemptionLimit
        : c.req.path.endsWith("/reauthenticate")
          ? owner.reauthLimit
          : c.req.path.endsWith("/resend")
            ? owner.resendLimit
            : c.req.path.endsWith("/verify")
              ? owner.verifyLimit
              : c.req.path.includes("/setup")
                ? owner.setupLimit
                : undefined;
    if (limiter) {
      const retry = await limiter();
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
    await next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "get",
        path: "/shops/{shopId}",
        request: { params: z.object({ shopId: z.uuid() }) },
        responses: {
          200: {
            description: "Authenticated operational shop read.",
            content: { "application/json": { schema: shopRecordSchema } },
          },
          401: errorResponse,
          403: errorResponse,
          422: errorResponse,
        },
      }),
      async (c) => {
        const shopId = c.req.valid("param").shopId;
        const result = await owner.withOwnerShop(
          c.req.raw.headers,
          shopId,
          (repository) => readShop(repository, shopId),
        );
        if (!result.data) throw new OwnerAccessError("SHOP_ACCESS_DENIED");
        return sessionResponse(
          c.json(shopRecordSchema.parse(result.data), 200),
          result.headers,
        );
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/owner/google",
        responses: {
          200: {
            description: "Owner Google connection status; no account tokens.",
            content: { "application/json": { schema: googleConnectionSchema } },
          },
          401: errorResponse,
        },
      }),
      async (c) => {
        const result = await owner.googleConnection(c.req.raw.headers);
        return sessionResponse(c.json(result.data, 200), result.headers);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/owner/google/disconnect",
        responses: actionResponses,
      }),
      async (c) => {
        const headers = await owner.disconnectGoogle(c.req.raw.headers);
        return sessionResponse(
          c.json({ state: "google-disconnected" as const }, 200),
          headers,
        );
      },
    )
    .openapi(
      command("/owner/recovery/request", recoveryRequestSchema),
      async (c) => {
        await owner.requestRecovery(c.req.valid("json").email);
        return c.json({ state: "recovery-requested" as const }, 200);
      },
    )
    .openapi(
      command("/owner/recovery/reset", recoveryResetSchema),
      async (c) => {
        await owner.resetPassword(c.req.valid("json"));
        return c.json({ state: "password-reset" as const }, 200);
      },
    )
    .openapi(
      command("/owner/reauthenticate", reauthenticationSchema),
      async (c) => {
        const headers = await owner.reauthenticate(
          c.req.raw.headers,
          c.req.valid("json").password,
        );
        return sessionResponse(
          c.json({ state: "reauthenticated" as const }, 200),
          headers,
        );
      },
    )
    .openapi(command("/owner/setup", setupCommandSchema), async (c) => {
      const key = c.req.header("Idempotency-Key");
      if (!key || !z.uuid().safeParse(key).success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED" as const,
              message: "Request key required",
            },
          },
          422,
        );
      await owner.admit(
        setupCommandSchema.parse(c.req.valid("json")),
        c.req.header("X-Setup-Token") ?? "",
        key,
      );
      return c.json({ state: "pending-verification" as const }, 200);
    })
    .openapi(command("/owner/resend", resendCommandSchema), async (c) => {
      const input = resendCommandSchema.parse(c.req.valid("json"));
      await owner.resend(
        input.email,
        input.password,
        c.req.header("X-Setup-Token") ?? "",
      );
      return c.json({ state: "pending-verification" as const }, 200);
    })
    .openapi(command("/owner/verify", verificationCommandSchema), async (c) => {
      await owner.verify(
        verificationCommandSchema.parse(c.req.valid("json")).code,
      );
      return c.json({ state: "verified" as const }, 200);
    })
    .openapi(
      createRoute({
        method: "post",
        path: "/owner/complete",
        responses: actionResponses,
      }),
      async (c) => {
        const result = await owner.complete(c.req.raw.headers);
        return sessionResponse(
          c.json({ state: "complete" as const, ...result.data }, 200),
          result.headers,
        );
      },
    )
    .openapi(
      createRoute({
        method: "get",
        path: "/owner/shop",
        responses: {
          200: {
            description: "Server-authorized initial shop.",
            content: { "application/json": { schema: ownerShopSchema } },
          },
          401: errorResponse,
        },
      }),
      async (c) => {
        const result = await owner.ownerShop(c.req.raw.headers);
        return sessionResponse(c.json(result.data, 200), result.headers);
      },
    );
  routes.on(["GET", "POST"], "/auth/*", async (c) => {
    const path = c.req.path.slice(c.req.path.indexOf("/auth") + 5);
    if (
      !(
        (c.req.method === "POST" &&
          [
            "/sign-in/email",
            "/sign-out",
            "/sign-in/social",
            "/link-social",
            "/unlink-account",
          ].includes(path)) ||
        (c.req.method === "GET" &&
          ["/get-session", "/callback/google"].includes(path))
      )
    )
      return c.json(
        { error: { code: "NOT_FOUND", message: "Route not found" } },
        404,
      );
    if (path === "/get-session") {
      try {
        const result = await owner.ownerShop(c.req.raw.headers);
        return sessionResponse(c.json({ state: "signed-in" }), result.headers);
      } catch {
        return c.json(
          { error: { code: "UNAUTHENTICATED", message: "Sign-in required" } },
          401,
        );
      }
    }
    let request = c.req.raw;
    if (path === "/sign-in/email") {
      const input = signInCommandSchema.safeParse(
        await request
          .clone()
          .json()
          .catch(() => undefined),
      );
      if (!input.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the required fields",
            },
          },
          422,
        );
      const headers = new Headers(request.headers);
      headers.delete("Content-Length");
      request = new Request(request, {
        headers,
        body: JSON.stringify(input.data),
      });
    }
    const response = await owner.auth.handler(request);
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Referrer-Policy", "no-referrer");
    responseHeaders.delete("Content-Length");
    if (
      [
        "/sign-in/social",
        "/link-social",
        "/unlink-account",
        "/callback/google",
      ].includes(path)
    )
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    if (path === "/sign-in/email" && response.ok) {
      // Native success includes a bearer token; browser gets only HttpOnly cookie.
      return new Response(JSON.stringify({ state: "signed-in" }), {
        status: 200,
        headers: responseHeaders,
      });
    }
    if (response.status === 429) {
      const retry = response.headers.get("X-Retry-After");
      if (retry) c.header("Retry-After", retry);
      return c.json(
        {
          error: { code: "RATE_LIMITED", message: "Wait before trying again" },
        },
        429,
      );
    }
    if (!response.ok)
      return c.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Sign-in failed" } },
        response.status === 403 ? 403 : 401,
      );
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  });
  routes.onError((error, c) => {
    if (error instanceof OwnerAccessError) {
      const status =
        error.code === "MAIL_UNAVAILABLE"
          ? 503
          : error.code === "UNAUTHENTICATED" ||
              error.code === "INVALID_CREDENTIALS"
            ? 401
            : error.code === "REQUEST_CONFLICT"
              ? 409
              : 403;
      return c.json(
        {
          error: {
            code: error.code,
            message:
              error.code === "MAIL_UNAVAILABLE"
                ? "Verification delivery failed; resume setup to retry"
                : "Request denied",
          },
        },
        status,
      );
    }
    return c.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Request failed; try again",
        },
      },
      503,
    );
  });
  return routes;
}
