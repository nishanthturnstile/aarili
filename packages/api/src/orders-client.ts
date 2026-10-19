import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  acceptedOrderSchema,
  type OrderError,
  orderErrorSchema,
  orderHistorySchema,
  orderListSchema,
  orderReviewSchema,
  type QuickOrderDraft,
  quickOrderPreviewSchema,
} from "@aarili/contracts/orders";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createOrderRoutes } from "./orders.js";

const client = () => hc<ReturnType<typeof createOrderRoutes>>("/api");
export class OrderRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: OrderError,
  ) {
    super(body.error.code);
  }
}
async function orderResult(r: Response, generation: number) {
  if (r.status === 401) {
    if (isOwnerGeneration(generation)) clearOwnerState();
    throw new OwnerRequestError("UNAUTHENTICATED");
  }
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const e = orderErrorSchema.parse(data);
    if (
      r.status === 401 ||
      (r.status === 403 && e.error.code === "SHOP_ACCESS_DENIED")
    )
      clearOwnerState();
    if (e.current && r.headers.get("ETag") !== `"v${e.current.version}"`)
      throw new OwnerRequestError("REQUEST_FAILED");
    throw new OrderRequestError(r.status, e);
  }
  if (
    data &&
    typeof data === "object" &&
    "version" in data &&
    r.headers.get("ETag") !== `"v${data.version}"`
  )
    throw new OwnerRequestError("REQUEST_FAILED");
  return data;
}
export async function reviewQuickOrder(shopId: string, input: QuickOrderDraft) {
  return orderReviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders.review.$post(
          { param: { shopId }, json: input },
          { init: { cache: "no-store", signal: s } },
        ),
      orderResult,
    ),
  );
}
export async function listAcceptedOrders(shopId: string, before?: string) {
  return orderListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: { cache: "no-store", signal: s } },
        ),
      orderResult,
    ),
  );
}
export async function readAcceptedOrder(shopId: string, id: string) {
  return acceptedOrderSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders[":id"].read.$post(
          { param: { shopId, id } },
          { init: { cache: "no-store", signal: s } },
        ),
      orderResult,
    ),
  );
}
export async function readOrderHistory(
  shopId: string,
  id: string,
  beforeVersion?: number,
) {
  return orderHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders[":id"].history.$post(
          {
            param: { shopId, id },
            json: beforeVersion ? { beforeVersion } : {},
          },
          { init: { cache: "no-store", signal: s } },
        ),
      orderResult,
    ),
  );
}
export async function changeOrderPresentation(
  shopId: string,
  id: string,
  mode: "simple" | "detailed",
  key: string,
  version: number,
) {
  return acceptedOrderSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders[":id"].presentation.$post(
          { param: { shopId, id }, json: { mode } },
          {
            headers: { "Idempotency-Key": key, "If-Match": `"v${version}"` },
            init: { cache: "no-store", signal: s },
          },
        ),
      orderResult,
    ),
  );
}
export async function previewQuickOrder(
  shopId: string,
  input: QuickOrderDraft,
  external?: AbortSignal,
) {
  return quickOrderPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].orders["intake-preview"].$post(
          { param: { shopId }, json: input },
          {
            init: {
              cache: "no-store",
              signal: external ? AbortSignal.any([s, external]) : s,
            },
          },
        ),
      async (r, generation) => {
        const data: unknown = await r.json();
        if (!isOwnerGeneration(generation))
          throw new OwnerRequestError("UNAUTHENTICATED");
        if (!r.ok) {
          const e = draftErrorSchema.safeParse(data);
          const code = e.success ? e.data.error.code : "REQUEST_FAILED";
          if (
            r.status === 401 ||
            (r.status === 403 && code === "SHOP_ACCESS_DENIED")
          )
            clearOwnerState();
          throw new OwnerRequestError(code);
        }
        return data;
      },
    ),
  );
}
