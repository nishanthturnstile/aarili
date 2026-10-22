import {
  designDraftReferenceReadSchema,
  designMediaSubjectSchema,
  designReferenceAssetsSchema,
  designReferencePageSchema,
} from "@aarili/contracts/design-references";
import { draftErrorSchema } from "@aarili/contracts/drafts";
import { type MediaVariant, mediaReadSchema } from "@aarili/contracts/media";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createDesignReferencesRoutes } from "./design-references.js";

const client = () =>
  hc<ReturnType<typeof createDesignReferencesRoutes>>("/api");
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const e = draftErrorSchema.safeParse(data),
      code = e.success ? e.data.error.code : "REQUEST_FAILED";
    if (r.status === 401 || (r.status === 403 && code === "SHOP_ACCESS_DENIED"))
      clearOwnerState();
    throw new OwnerRequestError(code);
  }
  return data;
}
const init = (signal: AbortSignal) => ({ cache: "no-store" as const, signal });
export async function readDesignDraftReferenceBytes(
  shopId: string,
  draftId: string,
  referenceId: string,
  variant?: MediaVariant,
) {
  return designDraftReferenceReadSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].drafts.read.$post(
          {
            param: { shopId },
            json: { draftId, referenceId, ...(variant ? { variant } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readPrivateDesignSubjects(
  shopId: string,
  orderId: string,
  pieceId: string | null,
  before?: string,
) {
  return designReferencePageSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].subjects.list.$post(
          {
            param: { shopId },
            json: { orderId, pieceId, ...(before ? { before } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignSubjectAssets(
  shopId: string,
  subjectId: string,
  before?: string,
) {
  return designReferenceAssetsSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].assets.$post(
          {
            param: { shopId },
            json: { subjectId, ...(before ? { before } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignReferenceLibrary(
  shopId: string,
  before?: string,
) {
  return designReferencePageSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].library.$post(
          { param: { shopId }, json: { ...(before ? { before } : {}) } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignMediaSubject(shopId: string, id: string) {
  return designMediaSubjectSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].subjects[":id"].$get(
          { param: { shopId, id } },
          { init: init(s) },
        ),
      result,
    ),
  );
}
export async function readDesignReferenceBytes(
  shopId: string,
  versionId: string,
  referenceId: string,
  variant?: MediaVariant,
) {
  return mediaReadSchema.parse(
    await authenticatedResult(
      (s) =>
        client().shops[":shopId"]["design-references"].read.$post(
          {
            param: { shopId },
            json: { versionId, referenceId, ...(variant ? { variant } : {}) },
          },
          { init: init(s) },
        ),
      result,
    ),
  );
}
