import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  type PatternQuery,
  patternCompareQuerySchema,
  patternComparisonSchema,
  patternPageSchema,
  patternQuerySchema,
} from "@aarili/contracts/manual-patterns";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createManualPatternsRoutes } from "./manual-patterns.js";

const client = () => hc<ReturnType<typeof createManualPatternsRoutes>>("/api");
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const e = draftErrorSchema.safeParse(data),
      code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
export async function readPatterns(shopId: string, q: PatternQuery) {
  return patternPageSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["manual-patterns"].list.$post(
          { param: { shopId }, json: patternQuerySchema.parse(q) },
          { init: { cache: "no-store", signal: s } },
        ),
      result,
    ),
  );
}
export async function comparePattern(
  shopId: string,
  q: { orderId: string; pieceId: string | null; referenceId: string },
) {
  return patternComparisonSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["manual-patterns"].compare.$post(
          { param: { shopId }, json: patternCompareQuerySchema.parse(q) },
          { init: { cache: "no-store", signal: s } },
        ),
      result,
    ),
  );
}
