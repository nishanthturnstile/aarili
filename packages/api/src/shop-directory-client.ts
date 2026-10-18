import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  directoryEntrySchema,
  directoryHistorySchema,
  directoryListSchema,
} from "@aarili/contracts/shop-directory";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createShopDirectoryRoutes } from "./shop-directory.js";

const client = () => hc<ReturnType<typeof createShopDirectoryRoutes>>("/api");
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
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readShopDirectory(shopId: string, before?: string) {
  return directoryListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.directory.list.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDirectoryEntry(shopId: string, id: string) {
  return directoryEntrySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.directory.entries[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDirectoryHistory(
  shopId: string,
  entryId: string,
  beforeVersion?: number,
) {
  return directoryHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.directory.history.$post(
          {
            param: { shopId },
            json: { entryId, ...(beforeVersion ? { beforeVersion } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
