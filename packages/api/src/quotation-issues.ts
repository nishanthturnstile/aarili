import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import {
  quoteIssueCommandSchema,
  quoteIssueLocatorSchema,
  quoteIssueReadSchema,
  quoteIssueResultSchema,
  quoteIssueReviewInputSchema,
  quoteIssueReviewSchema,
  quoteResponseCommandSchema,
  quoteResponseResultSchema,
} from "@aarili/contracts/quotation-issues";
import { etagSchema, idempotencyHeaderSchema } from "@aarili/contracts/request";
import { DocumentFailure } from "@aarili/core/documents";
import { DraftFailure } from "@aarili/core/drafts";
import { MediaFailure } from "@aarili/core/media";
import {
  issueQuotation,
  readIssuedQuotation,
  recordQuoteResponse,
  reviewQuoteIssue,
} from "@aarili/core/quotation-issues";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private quotation",
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
export function createQuotationIssueRoutes(
  owner: Pick<
    OwnerAuth,
    "origin" | "withOwnerQuotationIssues" | "commandLimit"
  >,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review quotation fields",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/*", async (c, next) => {
    const url = new URL(c.req.url);
    if (!/\/shops\/[^/]+\/quotation-issues(?:\/|$)/.test(url.pathname))
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
    if (
      url.pathname.endsWith("/quotation-issues") ||
      url.pathname.endsWith("/quotation-issues/response")
    ) {
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
        path: "/shops/{shopId}/quotation-issues/review",
        request: { params, body: body(quoteIssueReviewInputSchema) },
        responses: { 200: response(quoteIssueReviewSchema), ...errors },
      }),
      async (c) => {
        const result = await owner.withOwnerQuotationIssues(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewQuoteIssue(ctx, c.req.valid("json")),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.version}"`);
        return c.json(quoteIssueReviewSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/quotation-issues",
        request: {
          params,
          headers: z.object({
            "idempotency-key": idempotencyHeaderSchema.optional(),
            "if-match": etagSchema.optional(),
          }),
          body: body(quoteIssueCommandSchema),
        },
        responses: { 200: response(quoteIssueResultSchema), ...errors },
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
        const result = await owner.withOwnerQuotationIssues(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            issueQuotation(
              ctx,
              c.req.valid("json"),
              key,
              c.req.header("If-Match") ?? null,
            ),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.status.version}"`);
        return c.json(quoteIssueResultSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/quotation-issues/read",
        request: { params, body: body(quoteIssueLocatorSchema) },
        responses: { 200: response(quoteIssueReadSchema), ...errors },
      }),
      async (c) => {
        const v = c.req.valid("json"),
          result = await owner.withOwnerQuotationIssues(
            c.req.raw.headers,
            c.req.valid("param").shopId,
            (ctx) => readIssuedQuotation(ctx, v.docId, v.revision),
          );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.responseVersion}"`);
        return c.json(quoteIssueReadSchema.parse(result.data), 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/quotation-issues/response",
        request: {
          params,
          headers: z.object({
            "idempotency-key": idempotencyHeaderSchema.optional(),
            "if-match": etagSchema.optional(),
          }),
          body: body(quoteResponseCommandSchema),
        },
        responses: { 200: response(quoteResponseResultSchema), ...errors },
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
        const result = await owner.withOwnerQuotationIssues(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) =>
            recordQuoteResponse(
              ctx,
              c.req.valid("json"),
              key,
              c.req.header("If-Match") ?? null,
            ),
        );
        for (const cookie of result.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${result.data.responseVersion}"`);
        return c.json(quoteResponseResultSchema.parse(result.data), 200);
      },
    );
  app.onError((error, c) => {
    if (error instanceof DocumentFailure || error instanceof MediaFailure)
      return c.json(
        {
          error: {
            code: error.code,
            message:
              "Private quotation unavailable; review the selected sources",
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
          message: "Quotation temporarily unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
