import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  customerEstimateSchema,
  type EstimateDraft,
  estimateHistorySchema,
  estimateReadSchema,
  estimateReviewSchema,
} from "@aarili/contracts/garment-estimates";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createGarmentEstimatesRoutes } from "./garment-estimates.js";

const client = () =>
  hc<ReturnType<typeof createGarmentEstimatesRoutes>>("/api");
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const p = draftErrorSchema.safeParse(data),
      code = p.success ? p.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
export async function reviewGarmentEstimate(
  shopId: string,
  value: EstimateDraft,
) {
  return estimateReviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].estimates.review.$post(
          { param: { shopId }, json: value },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readGarmentEstimate(shopId: string, id: string) {
  return estimateReadSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].estimates.read.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function garmentEstimateHistory(
  shopId: string,
  estimateId: string,
  beforeVersion?: number,
) {
  return estimateHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].estimates.history.$post(
          {
            param: { shopId },
            json: { estimateId, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function customerGarmentEstimate(shopId: string, id: string) {
  return customerEstimateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].estimates.customer.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
