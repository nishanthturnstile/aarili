import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { apiErrorSchema } from "@aarili/contracts";
import {
  commandErrorSchema,
  etagSchema,
  idempotencyHeaderSchema,
  syntheticChangeSchema,
  syntheticCreateSchema,
  syntheticRecordSchema,
  syntheticSuccessSchema,
} from "@aarili/contracts/command";
import {
  CommandFailure,
  executeSynthetic,
  readSynthetic,
  versionTag,
} from "@aarili/core/commands";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

const error = {
  description: "Common command error; inaccessible state is never disclosed.",
  content: { "application/json": { schema: commandErrorSchema } },
};
const responses = {
  200: {
    description: "Committed or replayed result.",
    headers: { ETag: { schema: { type: "string" as const } } },
    content: { "application/json": { schema: syntheticSuccessSchema } },
  },
  401: error,
  403: error,
  404: error,
  409: error,
  412: error,
  422: error,
  428: error,
  429: error,
  503: error,
};
const shopParams = z.object({ shopId: z.uuid() });
const recordParams = shopParams.extend({ id: z.uuid() });
// Optional to let core distinguish absent keys/versions from malformed values.
const headers = z.object({
  "idempotency-key": idempotencyHeaderSchema.optional(),
  "if-match": etagSchema.optional(),
});
export function createCommandRoutes(
  owner: Pick<OwnerAuth, "origin" | "commandLimit" | "withOwnerCommand">,
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
  app.use("/dev/shops/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    // Attribution is server generated; client X-Request/Actor/Shop IDs cannot
    // become authority or overwrite provenance.
    const requestId = crypto.randomUUID();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Query rejected" } },
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
    await next();
  });
  const routes = app
    .openapi(
      createRoute({
        method: "get",
        path: "/dev/shops/{shopId}/records/{id}",
        request: { params: recordParams },
        responses: {
          200: {
            description: "Authorized synthetic state.",
            headers: { ETag: { schema: { type: "string" } } },
            content: { "application/json": { schema: syntheticRecordSchema } },
          },
          401: error,
          403: error,
          404: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerCommand(
          c.req.raw.headers,
          shopId,
          (ctx) => readSynthetic(ctx, id),
        );
        c.header("ETag", versionTag(result.data.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(syntheticRecordSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/dev/shops/{shopId}/records",
        request: {
          params: shopParams,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: syntheticCreateSchema } },
          },
        },
        responses,
      }),
      async (c) => {
        const { shopId } = c.req.valid("param");
        const result = await owner.withOwnerCommand(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            executeSynthetic(
              ctx,
              { action: "create", ...c.req.valid("json") },
              {
                key: c.req.header("Idempotency-Key"),
                requestId: c.get("requestId"),
              },
              null,
            ),
        );
        c.header("ETag", versionTag(result.data.record.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(syntheticSuccessSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "patch",
        path: "/dev/shops/{shopId}/records/{id}",
        request: {
          params: recordParams,
          headers,
          body: {
            required: true,
            content: { "application/json": { schema: syntheticChangeSchema } },
          },
        },
        responses,
      }),
      async (c) => {
        const { shopId, id } = c.req.valid("param");
        const result = await owner.withOwnerCommand(
          c.req.raw.headers,
          shopId,
          (ctx) =>
            executeSynthetic(
              ctx,
              c.req.valid("json"),
              {
                key: c.req.header("Idempotency-Key"),
                ifMatch: c.req.header("If-Match"),
                requestId: c.get("requestId"),
              },
              id,
            ),
        );
        c.header("ETag", versionTag(result.data.record.version));
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(syntheticSuccessSchema.parse(result.data), 200);
      },
    );
  routes.onError((failure, c) => {
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
    if (failure instanceof CommandFailure) {
      if (failure.body.current)
        c.header("ETag", versionTag(failure.body.current.version));
      return c.json(commandErrorSchema.parse(failure.body), failure.status);
    }
    if (failure instanceof OwnerAccessError)
      return c.json(
        apiErrorSchema.parse({
          error: { code: failure.code, message: "Request denied" },
        }),
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
