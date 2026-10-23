import { OwnerAccessError, type OwnerAuth } from "@aarili/auth";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  patternAssetsQuerySchema,
  patternAssetsSchema,
  patternCompareQuerySchema,
  patternComparisonSchema,
  patternLegacyPageSchema,
  patternPageSchema,
  patternQuerySchema,
  patternReadQuerySchema,
  patternReadSchema,
  patternReuseQuerySchema,
  patternReuseSchema,
} from "@aarili/contracts/manual-patterns";
import { DraftFailure } from "@aarili/core/drafts";
import {
  comparePattern,
  readPatternAssets,
  readPatternBytes,
  readPatterns,
  reviewPatternReuse,
} from "@aarili/core/manual-patterns";
import { MediaFailure } from "@aarili/core/media";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";

const response = <S extends z.ZodType>(schema: S) => ({
  description: "Private manual pattern reference",
  content: { "application/json": { schema } },
});
const error = response(draftErrorSchema);
const failures = {
  401: error,
  403: error,
  404: error,
  409: error,
  412: error,
  413: error,
  422: error,
  428: error,
  503: error,
};
const params = z.object({ shopId: z.uuid() });
const body = <S extends z.ZodType>(schema: S) => ({
  required: true,
  content: { "application/json": { schema } },
});
export function createManualPatternsRoutes(
  owner: Pick<OwnerAuth, "origin" | "withOwnerManualPatterns">,
) {
  const app = new OpenAPIHono({
    defaultHook: (r, c) => {
      if (!r.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_FAILED",
              message: "Review pattern request fields",
            },
          },
          422,
        );
    },
  });
  app.use("/shops/*", async (c, next) => {
    if (
      !/^\/api\/shops\/[^/]+\/manual-patterns(?:\/.*)?$/.test(
        new URL(c.req.url).pathname,
      )
    )
      return next();
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    c.header("X-Request-Id", crypto.randomUUID());
    if (new URL(c.req.url).search)
      return c.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Use request bodies for private queries",
          },
        },
        422,
      );
    if (c.req.header("Origin") !== owner.origin)
      return c.json(
        { error: { code: "UNSAFE_ORIGIN", message: "Request origin denied" } },
        403,
      );
    const h = new Headers(c.req.raw.headers);
    h.delete("Content-Length");
    c.req.raw = new Request(c.req.raw, { headers: h });
    return bodyLimit({
      maxSize: 8192,
      onError: (c) =>
        c.json(
          { error: { code: "INVALID_REQUEST", message: "Request too large" } },
          413,
        ),
    })(c, next);
  });
  const routes = app
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/manual-patterns/assets",
        request: { params, body: body(patternAssetsQuerySchema) },
        responses: { 200: response(patternAssetsSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerManualPatterns(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readPatternAssets(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/manual-patterns/read",
        request: { params, body: body(patternReadQuerySchema) },
        responses: { 200: response(patternReadSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerManualPatterns(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx, media) => readPatternBytes(ctx, media, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/manual-patterns/reuse",
        request: { params, body: body(patternReuseQuerySchema) },
        responses: { 200: response(patternReuseSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerManualPatterns(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => reviewPatternReuse(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/manual-patterns/list",
        request: { params, body: body(patternQuerySchema) },
        responses: {
          200: response(z.union([patternPageSchema, patternLegacyPageSchema])),
          ...failures,
        },
      }),
      async (c) => {
        const r = await owner.withOwnerManualPatterns(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => readPatterns(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        c.header("ETag", `"v${r.data.state.version}"`);
        if (!c.req.valid("json").readerVersion) {
          if (
            r.data.selected?.output ||
            r.data.selected?.source ||
            r.data.state.versions.some((v) => v.output || v.source)
          )
            throw new DraftFailure(409, {
              error: {
                code: "REQUEST_CONFLICT",
                message:
                  "Open the current pattern viewer to review files and source lineage",
              },
            });
          const legacy = ({
            output: _output,
            source: _source,
            ...v
          }: (typeof r.data.state.versions)[number]) => v;
          return c.json(
            {
              ...r.data,
              state: {
                ...r.data.state,
                versions: r.data.state.versions.map(legacy),
              },
              selected: r.data.selected ? legacy(r.data.selected) : null,
            },
            200,
          );
        }
        return c.json(r.data, 200);
      },
    )
    .openapi(
      createRoute({
        method: "post",
        path: "/shops/{shopId}/manual-patterns/compare",
        request: { params, body: body(patternCompareQuerySchema) },
        responses: { 200: response(patternComparisonSchema), ...failures },
      }),
      async (c) => {
        const r = await owner.withOwnerManualPatterns(
          c.req.raw.headers,
          c.req.valid("param").shopId,
          (ctx) => comparePattern(ctx, c.req.valid("json")),
        );
        for (const cookie of r.headers.getSetCookie())
          c.header("Set-Cookie", cookie, { append: true });
        return c.json(r.data, 200);
      },
    );
  app.onError((e, c) => {
    if (e instanceof MediaFailure)
      return c.json(
        {
          error: {
            code: e.code,
            message: "Private pattern output unavailable",
          },
        },
        e.status,
      );
    if (e instanceof DraftFailure) return c.json(e.body, e.status);
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
          message: "Pattern references unavailable",
        },
      },
      503,
    );
  });
  return routes;
}
