import {
  type WearerCreate,
  type WearerProfile,
  type WearerPurposeEvent,
  type WearerUpdate,
  wearerCreateSchema,
  wearerErrorSchema,
  wearerListSchema,
  wearerMutationSchema,
  wearerPolicySchema,
  wearerProfileSchema,
  wearerPurposeEventSchema,
  wearerSearchPageSchema,
  wearerSearchSchema,
  wearerUpdateSchema,
} from "@aarili/contracts/wearers";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createWearerRoutes } from "./wearers.js";

const client = () => hc<ReturnType<typeof createWearerRoutes>>("/api");
export class WearerRequestError extends OwnerRequestError {
  constructor(
    code: string,
    public readonly current?: WearerProfile,
    public readonly status = 0,
  ) {
    super(code);
  }
}
async function parse(response: Response, generation: number) {
  const data: unknown = await response.json();
  if (!isOwnerGeneration(generation))
    throw new WearerRequestError("UNAUTHENTICATED");
  if (!response.ok) {
    const parsed = wearerErrorSchema.safeParse(data),
      code = parsed.success ? parsed.data.error.code : "REQUEST_FAILED";
    if (
      response.status === 401 ||
      (response.status === 403 && code === "SHOP_ACCESS_DENIED")
    )
      clearOwnerState();
    const current = parsed.success ? parsed.data.current : undefined;
    if (current && response.headers.get("ETag") !== `"v${current.version}"`)
      throw new WearerRequestError("INVALID_RESPONSE");
    throw new WearerRequestError(code, current, response.status);
  }
  if (
    data &&
    typeof data === "object" &&
    "version" in data &&
    typeof data.version === "number" &&
    response.headers.get("ETag") !== `"v${data.version}"`
  )
    throw new WearerRequestError("INVALID_RESPONSE");
  return data;
}
const init = (signal: AbortSignal, outer?: AbortSignal) => ({
  cache: "no-store" as const,
  signal: outer ? AbortSignal.any([signal, outer]) : signal,
});
const read = (run: (signal: AbortSignal) => Promise<Response>) =>
  authenticatedResult(run, parse);
export async function readWearerPolicy(shopId: string, signal?: AbortSignal) {
  return wearerPolicySchema.parse(
    await read((s) =>
      client().shops[":shopId"].wearers.policy.$get(
        { param: { shopId } },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function searchWearers(
  shopId: string,
  input: { query: string; limit?: number; cursor?: string },
  signal?: AbortSignal,
) {
  return wearerSearchPageSchema.parse(
    await read((s) =>
      client().shops[":shopId"].wearers.search.$post(
        { param: { shopId }, json: wearerSearchSchema.parse(input) },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function listWearers(
  shopId: string,
  customerId: string,
  signal?: AbortSignal,
) {
  return wearerListSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":customerId"].wearers.$get(
        { param: { shopId, customerId } },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function readWearer(
  shopId: string,
  customerId: string,
  id: string,
  signal?: AbortSignal,
) {
  return wearerProfileSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":customerId"].wearers[":id"].$get(
        { param: { shopId, customerId, id } },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function registerWearer(
  shopId: string,
  customerId: string,
  input: WearerCreate,
  key: string,
  signal?: AbortSignal,
) {
  return wearerMutationSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":customerId"].wearers.$post(
        {
          param: { shopId, customerId },
          json: wearerCreateSchema.parse(input),
          header: { "idempotency-key": key },
        },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function correctWearer(
  shopId: string,
  customerId: string,
  id: string,
  input: WearerUpdate,
  key: string,
  etag: string,
  signal?: AbortSignal,
) {
  return wearerMutationSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":customerId"].wearers[":id"].$patch(
        {
          param: { shopId, customerId, id },
          json: wearerUpdateSchema.parse(input),
          header: { "idempotency-key": key, "if-match": etag },
        },
        { init: init(s, signal) },
      ),
    ),
  );
}
export async function recordWearerPurpose(
  shopId: string,
  customerId: string,
  id: string,
  input: WearerPurposeEvent,
  key: string,
  etag: string,
  signal?: AbortSignal,
) {
  return wearerMutationSchema.parse(
    await read((s) =>
      client().shops[":shopId"].customers[":customerId"].wearers[":id"][
        "consent-events"
      ].$post(
        {
          param: { shopId, customerId, id },
          json: wearerPurposeEventSchema.parse(input),
          header: { "idempotency-key": key, "if-match": etag },
        },
        { init: init(s, signal) },
      ),
    ),
  );
}
