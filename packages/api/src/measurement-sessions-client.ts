import { draftErrorSchema } from "@aarili/contracts/drafts";
import {
  measurementQuerySchema,
  measurementSelectionSchema,
  measurementStateSchema,
  measurementTargetQuerySchema,
  measurementUseQuerySchema,
  measurementUseStateSchema,
  measurementVersionSchema,
} from "@aarili/contracts/measurement-sessions";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createMeasurementSessionsRoutes } from "./measurement-sessions.js";

const client = () =>
  hc<ReturnType<typeof createMeasurementSessionsRoutes>>("/api");
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
export async function readMeasurements(
  shopId: string,
  input: { customerId: string; wearerId: string; before?: string },
) {
  return measurementStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].measurements.list.$post(
          { param: { shopId }, json: measurementQuerySchema.parse(input) },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readMeasurementTarget(
  shopId: string,
  input: { orderId: string; pieceId: string | null },
) {
  return measurementSelectionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].measurements.target.$post(
          {
            param: { shopId },
            json: measurementTargetQuerySchema.parse(input),
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readMeasurementUse(
  shopId: string,
  input: { form: { entryId: string; revisionId: string } },
) {
  return measurementUseStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].measurements.use.$post(
          { param: { shopId }, json: measurementUseQuerySchema.parse(input) },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readMeasurement(shopId: string, id: string) {
  return measurementVersionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"].measurements.versions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
