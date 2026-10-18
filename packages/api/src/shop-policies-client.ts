import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  policyReadinessSchema,
  shopPoliciesHistorySchema,
  shopPoliciesRevisionSchema,
  shopPoliciesStateSchema,
} from "@aarili/contracts/shop-policies";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createShopPoliciesRoutes } from "./shop-policies.js";

const client = () => hc<ReturnType<typeof createShopPoliciesRoutes>>("/api");
export async function readShopPoliciesReadiness(shopId: string) {
  return policyReadinessSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.policies.readiness.$get(
          { param: { shopId } },
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
  const state = shopPoliciesStateSchema.safeParse(data);
  if (state.success && r.headers.get("ETag") !== `"v${state.data.version}"`)
    throw new OwnerRequestError("INVALID_RESPONSE");
  return data;
}
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readShopPolicies(shopId: string) {
  return shopPoliciesStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.policies.$get(
          { param: { shopId } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readShopPoliciesHistory(
  shopId: string,
  beforeVersion?: number,
) {
  return shopPoliciesHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.policies.history.$post(
          {
            param: { shopId },
            json: beforeVersion === undefined ? {} : { beforeVersion },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}

export async function readShopPoliciesRevision(shopId: string, id: string) {
  return shopPoliciesRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.policies.revisions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
