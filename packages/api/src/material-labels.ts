import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  materialLabelCandidatesQuerySchema,
  materialLabelCandidatesSchema,
  materialLabelIssueResultSchema,
  materialLabelIssueSchema,
  materialLabelReviewCommandSchema,
  materialLabelReviewSchema,
} from "@aarili/contracts/material-labels";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import { DocumentFailure } from "@aarili/core/documents";
import { DraftFailure } from "@aarili/core/drafts";
import {
  issueMaterialLabels,
  listMaterialLabelCandidates,
  reviewMaterialLabels,
} from "@aarili/core/material-labels";
import { MediaFailure } from "@aarili/core/media";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Minimal material labels",
  content: { "application/json": { schema } },
});
const failure = response(
  z.strictObject({
    error: z.strictObject({ code: z.string(), message: z.string() }),
  }),
);
const errors = {
  401: failure,
  403: failure,
  404: failure,
  409: failure,
  412: failure,
  413: failure,
  422: failure,
  428: failure,
  429: failure,
  503: failure,
};
const params = z.object({ shopId: z.uuid() });
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
export function createMaterialLabelRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerMaterialLabels" | "commandLimit">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review selected label identities",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!/\/shops\/[^/]+\/material-labels(?:\/|$)/.test(url.pathname))
      return next();
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    if (url.search)
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Use the private request body",
          },
        },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Origin denied" } },
        403,
      );
    if (url.pathname.endsWith("/material-labels")) {
      const wait = await owner.commandLimit();
      if (wait) {
        c.header("Retry-After", String(wait));
        return c.json(
          { error: { code: "RATE_LIMITED", message: "Wait before retrying" } },
          429,
        );
      }
    }
    const headers = new Headers(c.req.raw.headers);
    headers.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers });
    return bodyLimit({
      maxSize: 12000,
      onError: (c) =>
        c.json(
          {
            error: { code: "VALIDATION_FAILED", message: "Request too large" },
          },
          413,
        ),
    })(c, next);
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/material-labels/candidates",
        request: { params, body: body(materialLabelCandidatesQuerySchema) },
        responses: { 200: response(materialLabelCandidatesSchema), ...errors },
      }),
      async (c) => {
        const result = await owner.withOwnerMaterialLabels(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => listMaterialLabelCandidates(ctx, c.req.valid("json")),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(materialLabelCandidatesSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/material-labels/review",
        request: { params, body: body(materialLabelReviewCommandSchema) },
        responses: { 200: response(materialLabelReviewSchema), ...errors },
      }),
      async (c) => {
        const result = await owner.withOwnerMaterialLabels(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewMaterialLabels(ctx, c.req.valid("json")),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.version}"`);
        return c.json(materialLabelReviewSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/material-labels",
        request: {
          params,
          headers: z.object({
            "idempotency-key": idempotencyHeaderSchema.optional(),
            "if-match": etagSchema.optional(),
          }),
          body: body(materialLabelIssueSchema),
        },
        responses: { 200: response(materialLabelIssueResultSchema), ...errors },
      }),
      async (c) => {
        const key = c.req.header("Idempotency-Key");
        if (!key)
          return c.json(
            {
              error: {
                code: "VALIDATION_FAILED",
                message: "Request identity required",
              },
            },
            422,
          );
        const result = await owner.withOwnerMaterialLabels(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            issueMaterialLabels(
              ctx,
              c.req.valid("json"),
              key,
              c.req.header("If-Match") ?? null,
            ),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.status.version}"`);
        return c.json(materialLabelIssueResultSchema.parse(result.data), 200);
      },
    );
  app.onError((error, c) => {
    if (error instanceof DocumentFailure || error instanceof MediaFailure)
      return c.json(
        {
          error: {
            code: error.code,
            message:
              "Minimal material labels unavailable; review the selected sources",
          },
        },
        error.status,
      );
    if (error instanceof DraftFailure) return c.json(error.body, error.status);
    if (error instanceof OwnerAccessError)
      return c.json(
        { error: { code: error.code, message: "Request denied" } },
        error.code === "UNAUTHENTICATED" ? 401 : 403,
      );
    if (error instanceof HTTPException && [400, 415].includes(error.status))
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
          code: "DOCUMENT_UNAVAILABLE",
          message: "Labels temporarily unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
