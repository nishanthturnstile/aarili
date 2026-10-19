import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  catalogueDefinitionSchema,
  catalogueEntrySchema,
  catalogueHistorySchema,
  catalogueListSchema,
  catalogueRevisionSchema,
} from "@aarili/contracts/service-catalogue";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createServiceCatalogueRoutes } from "./service-catalogue.js";

const client = () =>
  hc<ReturnType<typeof createServiceCatalogueRoutes>>("/api");
export async function readCatalogueRevision(shopId: string, id: string) {
  return catalogueRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.catalogue.revisions[":id"].$get(
          { param: { shopId, id } },
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
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readServiceCatalogue(
  shopId: string,
  before?: string,
  query = "",
) {
  return catalogueListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.catalogue.list.$post(
          { param: { shopId }, json: { query, ...(before ? { before } : {}) } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readCatalogueEntry(shopId: string, id: string) {
  return catalogueEntrySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.catalogue.entries[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readCatalogueDefinition(shopId: string, id: string) {
  return catalogueDefinitionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.catalogue.definitions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readCatalogueHistory(
  shopId: string,
  entryId: string,
  beforeVersion?: number,
) {
  return catalogueHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings.catalogue.history.$post(
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
