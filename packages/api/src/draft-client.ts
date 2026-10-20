import {
  type DraftCursor,
  type DraftError,
  type DraftSave,
  draftErrorSchema,
  draftListSchema,
  draftRecordSchema,
  draftSaveSchema,
  draftSuccessSchema,
} from "@aarili/contracts/drafts";
import { etagSchema } from "@aarili/contracts/request";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createDraftRoutes } from "./drafts.js";
export function createDraftClient() {
  return hc<ReturnType<typeof createDraftRoutes>>("/api");
}
export class DraftRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: DraftError,
    public readonly etag: string | null,
  ) {
    super(body.error.code);
  }
}
async function draftResult(
  response: Response,
  generation: number,
  requireETag = true,
) {
  const data: unknown = await response.json();
  // Body parsing can finish after sign-out/shop transition. Never expose its
  // old current state or let its error clear a newer authenticated session.
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  // Access invalidation must not depend on successful ETag validation.
  if (response.status === 401) clearOwnerState();
  const body = response.ok ? undefined : draftErrorSchema.parse(data);
  if (response.status === 403 && body?.error.code === "SHOP_ACCESS_DENIED")
    clearOwnerState();
  const etag = response.headers.get("ETag");
  if (etag !== null && !etagSchema.safeParse(etag).success)
    throw new OwnerRequestError("REQUEST_FAILED");
  if (body) {
    if (
      response.status === 412 &&
      body.current &&
      etag !== `"v${body.current.version}"`
    )
      throw new OwnerRequestError("REQUEST_FAILED");
    throw new DraftRequestError(response.status, body, etag);
  }
  if (requireETag) {
    const success = draftSuccessSchema.safeParse(data);
    const record = success.success
      ? success.data.draft
      : draftRecordSchema.parse(data);
    if (etag !== `"v${record.version}"`)
      throw new OwnerRequestError("REQUEST_FAILED");
  }
  return data;
}
export async function getDraft(shopId: string, id: string) {
  return draftRecordSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts[":id"].$get(
          { param: { shopId, id } },
          { init: { cache: "no-store", signal } },
        ),
      draftResult,
    ),
  );
}
export async function getDrafts(
  shopId: string,
  limit = 25,
  cursor?: DraftCursor,
) {
  return draftListSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts.$get(
          {
            param: { shopId },
            query: {
              limit: String(limit),
              ...(cursor ? { cursor: JSON.stringify(cursor) } : {}),
            },
          },
          { init: { cache: "no-store", signal } },
        ),
      (response, generation) => draftResult(response, generation, false),
    ),
  );
}
export async function putDraft(
  shopId: string,
  id: string,
  input: DraftSave,
  key: string,
  etag?: string,
) {
  const json = draftSaveSchema.parse(input);
  return draftSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts[":id"].$put(
          {
            param: { shopId, id },
            json,
            header: {
              "idempotency-key": key,
              ...(etag ? { "if-match": etag } : {}),
            },
          },
          { init: { cache: "no-store", signal } },
        ),
      draftResult,
    ),
  );
}
export async function convertDraft(
  shopId: string,
  id: string,
  key: string,
  etag: string,
) {
  return draftSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts[":id"].convert.$post(
          {
            param: { shopId, id },
            json: {},
            header: { "idempotency-key": key, "if-match": etag },
          },
          { init: { cache: "no-store", signal } },
        ),
      draftResult,
    ),
  );
}
export async function promoteDraft(
  shopId: string,
  id: string,
  key: string,
  etag: string,
) {
  return draftSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts[":id"].promote.$post(
          {
            param: { shopId, id },
            json: {},
            header: { "idempotency-key": key, "if-match": etag },
          },
          { init: { cache: "no-store", signal } },
        ),
      draftResult,
    ),
  );
}
export async function abandonDraft(
  shopId: string,
  id: string,
  key: string,
  etag: string,
) {
  return draftSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDraftClient().shops[":shopId"].drafts[":id"].abandon.$post(
          {
            param: { shopId, id },
            json: {},
            header: { "idempotency-key": key, "if-match": etag },
          },
          { init: { cache: "no-store", signal } },
        ),
      draftResult,
    ),
  );
}
