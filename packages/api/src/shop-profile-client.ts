import {
  type ShopProfileInput,
  type ShopProfileState,
  shopProfileErrorSchema,
  shopProfileHistorySchema,
  shopProfileStateSchema,
} from "@aarili/contracts/shop-profile";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createShopProfileRoutes } from "./shop-profile.js";

const client = () => hc<ReturnType<typeof createShopProfileRoutes>>("/api");
export class ShopProfileRequestError extends OwnerRequestError {
  constructor(
    code: string,
    public readonly current?: ShopProfileState,
  ) {
    super(code);
  }
}
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new ShopProfileRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const e = shopProfileErrorSchema.safeParse(data);
    const code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    if (
      e.success &&
      e.data.current &&
      r.headers.get("ETag") !== `"v${e.data.current.version}"`
    )
      throw new ShopProfileRequestError("INVALID_RESPONSE");
    throw new ShopProfileRequestError(
      code,
      e.success ? e.data.current : undefined,
    );
  }
  const state = shopProfileStateSchema.safeParse(data);
  if (state.success && r.headers.get("ETag") !== `"v${state.data.version}"`)
    throw new ShopProfileRequestError("INVALID_RESPONSE");
  return data;
}
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readShopProfile(shopId: string) {
  return shopProfileStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.profile.$get(
          { param: { shopId } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function saveShopProfile(
  shopId: string,
  input: ShopProfileInput,
  key: string,
  etag: string,
) {
  return shopProfileStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.profile.$put(
          {
            param: { shopId },
            json: input,
            header: { "idempotency-key": key, "if-match": etag },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readShopProfileHistory(
  shopId: string,
  beforeVersion?: number,
) {
  return shopProfileHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.profile.history.$post(
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
