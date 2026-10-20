import {
  acceptedServiceOrderSchema,
  type ServiceOrderDraft,
  serviceOrderListSchema,
  serviceOrderReviewSchema,
  serviceProfileHistorySchema,
  serviceProfileListSchema,
  serviceProfileRevisionSchema,
  smallServiceErrorSchema,
} from "@aarili/contracts/small-services";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createSmallServiceRoutes } from "./small-services.js";

const client = () => hc<ReturnType<typeof createSmallServiceRoutes>>("/api");
async function result(r: Response, generation: number) {
  if (r.status === 401) {
    if (isOwnerGeneration(generation)) clearOwnerState();
    throw new OwnerRequestError("UNAUTHENTICATED");
  }
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const p = smallServiceErrorSchema.safeParse(data);
    const code = p.success ? p.data.error.code : "REQUEST_FAILED";
    if (r.status === 403 && code === "SHOP_ACCESS_DENIED") clearOwnerState();
    throw new OwnerRequestError(code);
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
const init = (s: AbortSignal, signal?: AbortSignal) => ({
  cache: "no-store" as const,
  signal: signal ? AbortSignal.any([s, signal]) : s,
});
export async function readServiceProfiles(
  shopId: string,
  before?: string,
  signal?: AbortSignal,
) {
  return serviceProfileListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].profiles.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
export async function readServiceProfile(
  shopId: string,
  id: string,
  signal?: AbortSignal,
) {
  return serviceProfileRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].profiles[":id"].$get(
          { param: { shopId, id } },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
export async function readServiceProfileHistory(
  shopId: string,
  input: { entryId: string; beforeVersion?: number },
  signal?: AbortSignal,
) {
  return serviceProfileHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].profiles.history.$post(
          { param: { shopId }, json: input },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
export async function reviewServiceOrder(
  shopId: string,
  input: ServiceOrderDraft,
  signal?: AbortSignal,
) {
  return serviceOrderReviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].orders.review.$post(
          { param: { shopId }, json: input },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
export async function listServiceOrders(
  shopId: string,
  before?: string,
  signal?: AbortSignal,
) {
  return serviceOrderListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].orders.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
export async function readServiceOrder(
  shopId: string,
  id: string,
  signal?: AbortSignal,
) {
  return acceptedServiceOrderSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["small-services"].orders[":id"].$get(
          { param: { shopId, id } },
          { init: init(s, signal) },
        ),
      result,
    ),
  );
}
