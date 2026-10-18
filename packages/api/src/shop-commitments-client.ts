import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  type CommitmentPreviewInput,
  commitmentPreviewSchema,
  shopCommitmentsHistorySchema,
  shopCommitmentsRevisionSchema,
  shopCommitmentsStateSchema,
} from "@aarili/contracts/shop-commitments";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createShopCommitmentsRoutes } from "./shop-commitments.js";

const client = () => hc<ReturnType<typeof createShopCommitmentsRoutes>>("/api");
export async function previewShopCommitments(
  shopId: string,
  input: CommitmentPreviewInput,
) {
  return commitmentPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.commitments.preview.$post(
          { param: { shopId }, json: input },
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
  const state = shopCommitmentsStateSchema.safeParse(data);
  if (state.success && r.headers.get("ETag") !== `"v${state.data.version}"`)
    throw new OwnerRequestError("INVALID_RESPONSE");
  return data;
}
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readShopCommitments(shopId: string) {
  return shopCommitmentsStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.commitments.$get(
          { param: { shopId } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readShopCommitmentsHistory(
  shopId: string,
  beforeVersion?: number,
) {
  return shopCommitmentsHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.commitments.history.$post(
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

export async function readShopCommitmentsRevision(shopId: string, id: string) {
  return shopCommitmentsRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.commitments.revisions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
