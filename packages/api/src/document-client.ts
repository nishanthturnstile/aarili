import {
  type DocumentIssueInput,
  documentAccessSchema,
  documentStatusSchema,
} from "@aarili/contracts/documents";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createDocumentRoutes } from "./documents.js";
export function createDocumentClient() {
  return hc<ReturnType<typeof createDocumentRoutes>>("/api");
}
export class DocumentRequestError extends Error {
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
    throw new DocumentRequestError(401, "UNAUTHENTICATED");
  }
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (!r.ok) {
    const code =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "code" in data.error &&
      typeof data.error.code === "string"
        ? data.error.code
        : "REQUEST_FAILED";
    if (r.status === 403 && code === "SHOP_ACCESS_DENIED") clearOwnerState();
    throw new DocumentRequestError(r.status, code);
  }
  const status = documentStatusSchema.safeParse(data);
  if (status.success && r.headers.get("ETag") !== `"v${status.data.version}"`)
    throw new OwnerRequestError("REQUEST_FAILED");
  return data;
}
export async function requestDocumentIssue(
  shopId: string,
  input: DocumentIssueInput,
  key: string,
) {
  return documentStatusSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents.$post(
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
export async function requestDocumentStatus(
  shopId: string,
  docId: string,
  revision: number,
) {
  return documentStatusSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents[":docId"][
          ":revision"
        ].status.$get(
          { param: { shopId, docId, revision: String(revision) } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestDocumentRetry(
  shopId: string,
  docId: string,
  revision: number,
  key: string,
  version: number,
) {
  return documentStatusSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents[":docId"][
          ":revision"
        ].retry.$post(
          {
            param: { shopId, docId, revision: String(revision) },
            json: {},
            header: { "idempotency-key": key, "if-match": `"v${version}"` },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestDocumentAccess(
  shopId: string,
  docId: string,
  revision: number,
) {
  return documentAccessSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents[":docId"][
          ":revision"
        ].access.$get(
          { param: { shopId, docId, revision: String(revision) } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
