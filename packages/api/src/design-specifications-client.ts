import {
  type DesignReuseRequest,
  type DesignSpecificationQuery,
  designReuseRequestSchema,
  designSpecificationDraftSchema,
  designSpecificationQuerySchema,
  designSpecificationStateSchema,
  designSpecificationVersionSchema,
} from "@aarili/contracts/design-specifications";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createDesignSpecificationsRoutes } from "./design-specifications.js";

const client = () =>
  hc<ReturnType<typeof createDesignSpecificationsRoutes>>("/api");
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
export async function readDesignSpecifications(
  shopId: string,
  input: DesignSpecificationQuery,
) {
  return designSpecificationStateSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-specifications"].list.$post(
          {
            param: { shopId },
            json: designSpecificationQuerySchema.parse(input),
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignSpecification(shopId: string, id: string) {
  return designSpecificationVersionSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-specifications"].versions[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function previewDesignReuse(
  shopId: string,
  input: DesignReuseRequest,
) {
  return designSpecificationDraftSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-specifications"].reuse.$post(
          { param: { shopId }, json: designReuseRequestSchema.parse(input) },
          { init: init(s) },
        ),
      result,
    ),
  );
}
