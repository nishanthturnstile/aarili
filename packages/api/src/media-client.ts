import {
  type MediaAdmission,
  type MediaVariant,
  mediaReadSchema,
  mediaStatusSchema,
  mediaSuccessSchema,
  mediaUploadSchema,
} from "@aarili/contracts/media";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createMediaRoutes } from "./media.js";
export function createMediaClient() {
  return hc<ReturnType<typeof createMediaRoutes>>("/api");
}
export class MediaRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
async function result(r: Response, generation: number) {
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (r.status === 401) {
    clearOwnerState();
    throw new MediaRequestError(401, "UNAUTHENTICATED");
  }
  const body: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (r.status === 401) clearOwnerState();
  if (!r.ok) {
    const code =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "code" in body.error &&
      typeof body.error.code === "string"
        ? body.error.code
        : "REQUEST_FAILED";
    if (r.status === 403 && code === "SHOP_ACCESS_DENIED") clearOwnerState();
    throw new MediaRequestError(r.status, code);
  }
  const mutation = mediaSuccessSchema.safeParse(body);
  if (
    mutation.success &&
    r.headers.get("ETag") !== `"v${mutation.data.asset.version}"`
  )
    throw new OwnerRequestError("REQUEST_FAILED");
  const upload = mediaUploadSchema.safeParse(body);
  if (
    upload.success &&
    r.headers.get("ETag") !== `"v${upload.data.asset.version}"`
  )
    throw new OwnerRequestError("REQUEST_FAILED");
  return body;
}
// Mutation preconditions deliberately derive from returned asset.version as `"v${version}"`.
// Server ETags are checked against this version before exposing a result.
// All returned capabilities are page-memory only. No query cache/storage/URL use.
export async function requestMediaUpload(
  shopId: string,
  input: MediaAdmission,
  key: string,
) {
  return mediaUploadSchema.parse(
    await authenticatedResult(
      (signal) =>
        createMediaClient().shops[":shopId"].files.uploads.$post(
          {
            param: { shopId },
            json: input,
            header: { "idempotency-key": key },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function completeMediaUpload(
  shopId: string,
  id: string,
  key: string,
  etag: string,
) {
  return mediaSuccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createMediaClient().shops[":shopId"].files[":id"].complete.$post(
          {
            param: { shopId, id },
            json: {},
            header: { "idempotency-key": key, "if-match": etag },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestMediaRead(shopId: string, id: string) {
  return mediaReadSchema.parse(
    await authenticatedResult(
      (signal) =>
        createMediaClient().shops[":shopId"].files[":id"].access.$get(
          { param: { shopId, id } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestMediaStatus(shopId: string, id: string) {
  return mediaStatusSchema.parse(
    await authenticatedResult(
      (signal) =>
        createMediaClient().shops[":shopId"].files[":id"].status.$get(
          { param: { shopId, id } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestMediaVariant(
  shopId: string,
  id: string,
  variant: MediaVariant,
) {
  return mediaReadSchema.parse(
    await authenticatedResult(
      (signal) =>
        createMediaClient().shops[":shopId"].files[":id"].variants[
          ":variant"
        ].access.$get(
          { param: { shopId, id, variant } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
