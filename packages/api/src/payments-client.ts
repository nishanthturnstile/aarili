import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  paymentHistorySchema,
  paymentListSchema,
  paymentOptionsSchema,
  paymentPositionSchema,
  paymentReceiptSchema,
} from "@aarili/contracts/payments";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createPaymentsRoutes } from "./payments.js";

const client = () => hc<ReturnType<typeof createPaymentsRoutes>>("/api"),
  init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function resolvePaymentReference(
  shopId: string,
  customerId: string,
  reference: string,
) {
  return paymentReceiptSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.duplicate.$post(
          { param: { shopId }, json: { customerId, reference } },
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
    const e = draftErrorSchema.safeParse(data);
    const code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
export async function readPaymentOptions(shopId: string) {
  return paymentOptionsSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.options.$post(
          { param: { shopId }, json: {} },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readPayments(
  shopId: string,
  customerId?: string,
  before?: string,
) {
  return paymentListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.list.$post(
          {
            param: { shopId },
            json: {
              ...(customerId ? { customerId } : {}),
              ...(before ? { before } : {}),
            },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readPaymentReceipt(shopId: string, id: string) {
  return paymentReceiptSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.read.$post(
          { param: { shopId }, json: { id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readPaymentHistory(
  shopId: string,
  id: string,
  beforeVersion?: number,
) {
  return paymentHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.history.$post(
          {
            param: { shopId },
            json: { id, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readPaymentPosition(shopId: string, customerId: string) {
  return paymentPositionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].payments.position.$post(
          { param: { shopId }, json: { customerId } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
