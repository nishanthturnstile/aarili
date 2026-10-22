import {
  designChoicesDefinitionSchema,
  designChoicesEntrySchema,
  designChoicesHistorySchema,
  designChoicesListSchema,
  designChoicesRevisionSchema,
  type designPreviewRequestSchema,
  designPreviewSchema,
} from "@aarili/contracts/design-choices";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createDesignChoicesRoutes } from "./design-choices.js";

const client = () => hc<ReturnType<typeof createDesignChoicesRoutes>>("/api");
export async function readDesignChoicesRevision(shopId: string, id: string) {
  return designChoicesRevisionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].revisions[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
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
export async function readDesignChoices(
  shopId: string,
  before?: string,
  query = "",
) {
  return designChoicesListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].list.$post(
          { param: { shopId }, json: { query, ...(before ? { before } : {}) } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignChoicesEntry(shopId: string, id: string) {
  return designChoicesEntrySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].entries[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readDesignChoicesDefinition(shopId: string, id: string) {
  return designChoicesDefinitionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].definitions[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readDesignChoicesHistory(
  shopId: string,
  entryId: string,
  beforeVersion?: number,
) {
  return designChoicesHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].history.$post(
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

export async function previewDesignChoices(
  shopId: string,
  input: import("zod").infer<typeof designPreviewRequestSchema>,
) {
  return designPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["design-choices"].preview.$post(
          { param: { shopId }, json: input },
          { init: init(s) },
        ),
      result,
    ),
  );
}
