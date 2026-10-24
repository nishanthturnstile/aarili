import {
  customerQuotationSchema,
  type QuotationDraft,
  quotationEstimateOptionsSchema,
  quotationHistorySchema,
  quotationListSchema,
  quotationReadSchema,
  quotationReviewSchema,
} from "@aarili/contracts/booking-quotations";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import { hc } from "hono/client";
import type { createBookingQuotationsRoutes } from "./booking-quotations.js";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";

const client = () =>
  hc<ReturnType<typeof createBookingQuotationsRoutes>>("/api");
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function currentBookingQuotation(shopId: string, id: string) {
  return quotationReadSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.current.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function listBookingQuotations(shopId: string, before?: string) {
  return quotationListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function quotationEstimateOptions(shopId: string, id: string) {
  return quotationEstimateOptionsSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.estimates.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
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
export async function reviewBookingQuotation(
  shopId: string,
  value: QuotationDraft,
) {
  return quotationReviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.review.$post(
          { param: { shopId }, json: value },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readBookingQuotation(shopId: string, id: string) {
  return quotationReadSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.read.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function bookingQuotationHistory(
  shopId: string,
  familyId: string,
  beforeVersion?: number,
) {
  return quotationHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.history.$post(
          {
            param: { shopId },
            json: { familyId, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function customerBookingQuotation(shopId: string, id: string) {
  return customerQuotationSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].quotations.customer.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
