import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  policyBindingsSchema,
  type QuotePolicyReviewDraft,
  rateHistorySchema,
  rateResolutionSchema,
  rateRevisionSchema,
  ratesListSchema,
} from "@aarili/contracts/quotation-rates";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createQuotationRatesRoutes } from "./quotation-rates.js";

const client = () => hc<ReturnType<typeof createQuotationRatesRoutes>>("/api");
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const parsed = draftErrorSchema.safeParse(data),
      code = parsed.success ? parsed.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
export async function listQuotationRates(shopId: string, before?: string) {
  return ratesListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.rates.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function quotationRateHistory(
  shopId: string,
  rateId: string,
  beforeVersion?: number,
) {
  return rateHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.rates.history.$post(
          {
            param: { shopId },
            json: { rateId, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readQuotationRateRevision(shopId: string, id: string) {
  return rateRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.rates.revisions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function quotationPolicyHistory(
  shopId: string,
  kind: QuotePolicyReviewDraft["kind"],
  beforeVersion?: number,
) {
  return policyBindingsSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.rates.policies.$post(
          {
            param: { shopId },
            json: { kind, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function resolveQuotationRate(
  shopId: string,
  rateId: string,
  date: string,
) {
  return rateResolutionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.rates.resolve.$post(
          { param: { shopId }, json: { rateId, date } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
