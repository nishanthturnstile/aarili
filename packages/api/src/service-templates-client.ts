import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  type ServiceTemplateContent,
  serviceRequirementsPreviewSchema,
  serviceTemplatesDefinitionSchema,
  serviceTemplatesEntrySchema,
  serviceTemplatesHistorySchema,
  serviceTemplatesListSchema,
} from "@aarili/contracts/service-templates";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createServiceTemplatesRoutes } from "./service-templates.js";

const client = () =>
  hc<ReturnType<typeof createServiceTemplatesRoutes>>("/api");
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
export async function readServiceTemplates(
  shopId: string,
  before?: string,
  query = "",
) {
  return serviceTemplatesListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["service-templates"].list.$post(
          { param: { shopId }, json: { query, ...(before ? { before } : {}) } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readServiceTemplateEntry(shopId: string, id: string) {
  return serviceTemplatesEntrySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["service-templates"].entries[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readServiceTemplateDefinition(
  shopId: string,
  id: string,
) {
  return serviceTemplatesDefinitionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["service-templates"].definitions[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readServiceTemplateHistory(
  shopId: string,
  entryId: string,
  beforeVersion?: number,
) {
  return serviceTemplatesHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["service-templates"].history.$post(
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

export async function previewServiceRequirements(
  shopId: string,
  content: ServiceTemplateContent,
  templateRevisionId?: string,
) {
  return serviceRequirementsPreviewSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["service-templates"].preview.$post(
          {
            param: { shopId },
            json: { content, templateRevisionId: templateRevisionId ?? null },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
