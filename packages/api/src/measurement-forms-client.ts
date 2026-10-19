import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  measurementFormsDefinitionSchema,
  measurementFormsEntrySchema,
  measurementFormsHistorySchema,
  measurementFormsListSchema,
} from "@aarili/contracts/measurement-forms";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createMeasurementFormsRoutes } from "./measurement-forms.js";

const client = () =>
  hc<ReturnType<typeof createMeasurementFormsRoutes>>("/api");
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
export async function readMeasurementForms(
  shopId: string,
  before?: string,
  query = "",
) {
  return measurementFormsListSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["measurement-forms"].list.$post(
          { param: { shopId }, json: { query, ...(before ? { before } : {}) } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readMeasurementFormEntry(shopId: string, id: string) {
  return measurementFormsEntrySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["measurement-forms"].entries[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readMeasurementFormDefinition(
  shopId: string,
  id: string,
) {
  return measurementFormsDefinitionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["measurement-forms"].definitions[
          ":id"
        ].$get({ param: { shopId, id } }, { init: init(s) }),
      result,
    ),
  );
}
export async function readMeasurementFormHistory(
  shopId: string,
  entryId: string,
  beforeVersion?: number,
) {
  return measurementFormsHistorySchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].settings["measurement-forms"].history.$post(
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
