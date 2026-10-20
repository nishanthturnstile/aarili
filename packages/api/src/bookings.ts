import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  bookingDetailSchema,
  bookingDraftSchema,
  bookingHistorySchema,
  bookingListQuerySchema,
  bookingListSchema,
  bookingReadQuerySchema,
  bookingReviewSchema,
  groupIntakeDraftSchema,
  groupIntakeReviewSchema,
  orderErrorSchema,
  orderListSchema,
} from "@aarili/contracts/orders";
import { CustomerFailure } from "@aarili/core/customers";
import { DraftFailure } from "@aarili/core/drafts";
import {
  bookingCandidates,
  bookingHistory,
  listBookings,
  readBooking,
  reviewBooking,
  reviewGroupIntake,
} from "@aarili/core/orders";
import { GuardianFailure, WearerFailure } from "@aarili/core/wearers";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private order intake",
  content: { "application/json": { schema } },
});
export function createBookingRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerQuickOrder" | "commandLimit">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Check intake fields",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/:shopId/orders/bookings/*", async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (new URL(c.req.url).search)
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Use a request body" } },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request denied" } },
        403,
      );
    if (
      c.req.path.endsWith("/presentation") ||
      c.req.path.endsWith("/pieces/materialize")
    ) {
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
    const boundedHeaders = new Headers(c.req.raw.headers);
    boundedHeaders.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers: boundedHeaders });
    return next();
  });
  app.use("/shops/:shopId/orders/bookings/*", (c, next) =>
    bodyLimit({
      // Match durable-draft transport bounds; Tamil text uses multiple UTF-8 bytes.
      maxSize: c.req.path.endsWith("/intake-review") ? 512 * 1024 : 65536,
      onError: (c) =>
        c.json(
          { error: { code: "INVALID_REQUEST", message: "Request too large" } },
          413,
        ),
    })(c, next),
  );
  const error = response(orderErrorSchema);
  const bookingRoutes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/intake-review",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: groupIntakeDraftSchema } },
          },
        },
        responses: {
          200: response(groupIntakeReviewSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewGroupIntake(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/candidates",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: bookingListQuerySchema } },
          },
        },
        responses: {
          200: response(orderListSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => bookingCandidates(ctx, c.req.valid("json").before),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/review",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: bookingDraftSchema } },
          },
        },
        responses: {
          200: response(bookingReviewSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewBooking(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/read",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: bookingReadQuerySchema } },
          },
        },
        responses: {
          200: response(bookingDetailSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            readBooking(
              ctx,
              c.req.valid("json").id,
              c.req.valid("json").revision,
            ),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.booking.version}"`);
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/list",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: { "application/json": { schema: bookingListQuerySchema } },
          },
        },
        responses: {
          200: response(bookingListSchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => listBookings(ctx, c.req.valid("json").before),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/orders/bookings/history",
        request: {
          params: z.object({ shopId: z.uuid() }),
          body: {
            required: true,
            content: {
              "application/json": {
                schema: z.strictObject({
                  id: z.uuid(),
                  beforeVersion: z.number().int().positive().optional(),
                }),
              },
            },
          },
        },
        responses: {
          200: response(bookingHistorySchema),
          401: error,
          403: error,
          404: error,
          409: error,
          412: error,
          422: error,
          503: error,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerQuickOrder(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            bookingHistory(
              ctx,
              c.req.valid("json").id,
              c.req.valid("json").beforeVersion,
            ),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof DraftFailure) return c.json(e.body, e.status);
    if (
      e instanceof CustomerFailure ||
      e instanceof WearerFailure ||
      e instanceof GuardianFailure
    )
      return c.json(
        { error: { code: e.message, message: "Intake source unavailable" } },
        e.status,
      );
    if (e instanceof OwnerAccessError)
      return c.json(
        { error: { code: e.code, message: "Request denied" } },
        e.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (e instanceof HTTPException && [400, 415].includes(e.status))
      return c.json(
        { error: { code: "VALIDATION_FAILED", message: "Check request body" } },
        422,
      );
    return c.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Intake temporarily unavailable",
        },
      },
      503,
    );
  });
  return bookingRoutes;
}
