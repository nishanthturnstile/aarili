import {
  type DocumentIssueInput,
  type DocumentShareCommand,
  documentAccessSchema,
  documentShareEventSchema,
  documentShareHistorySchema,
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
export async function requestDocumentFile(
  shopId: string,
  docId: string,
  revision: number,
  expectedHash: string,
  signal?: AbortSignal,
): Promise<File> {
  const file = await authenticatedResult(
    (requestSignal) =>
      createDocumentClient().shops[":shopId"].documents[":docId"][
        ":revision"
      ].file.$get(
        { param: { shopId, docId, revision: String(revision) } },
        {
          init: {
            cache: "no-store",
            signal: AbortSignal.any([
              requestSignal,
              AbortSignal.timeout(15000),
              ...(signal ? [signal] : []),
            ]),
          },
        },
      ),
    async (r, generation) => {
      if (!r.ok) return result(r, generation);
      if (
        r.headers.get("Content-Type") !== "application/pdf" ||
        r.headers.get("X-Document-Sha256") !== expectedHash
      )
        throw new DocumentRequestError(503, "DOCUMENT_BYTES_REJECTED");
      const reader = r.body?.getReader();
      if (!reader)
        throw new DocumentRequestError(503, "DOCUMENT_BYTES_REJECTED");
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 25 * 1024 * 1024)
            throw new DocumentRequestError(503, "DOCUMENT_BYTES_REJECTED");
          chunks.push(new Uint8Array(value));
        }
      } finally {
        await reader.cancel();
        reader.releaseLock();
      }
      const blob = new Blob(chunks, { type: "application/pdf" });
      const bytes = await blob.arrayBuffer();
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (!isOwnerGeneration(generation))
        throw new OwnerRequestError("UNAUTHENTICATED");
      if (
        hash !== expectedHash ||
        new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
      )
        throw new DocumentRequestError(503, "DOCUMENT_BYTES_REJECTED");
      return new File([blob], `document-${docId}-${revision}.pdf`, {
        type: "application/pdf",
      });
    },
  );
  return file as File;
}
export async function requestDocumentHistory(
  shopId: string,
  docId: string,
  revision: number,
) {
  return documentShareHistorySchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents[":docId"][
          ":revision"
        ].history.$get(
          { param: { shopId, docId, revision: String(revision) } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function requestDocumentShare(
  shopId: string,
  docId: string,
  revision: number,
  input: DocumentShareCommand,
  key: string,
) {
  return documentShareEventSchema.parse(
    await authenticatedResult(
      (signal) =>
        createDocumentClient().shops[":shopId"].documents[":docId"][
          ":revision"
        ].history.$post(
          {
            param: { shopId, docId, revision: String(revision) },
            json: input,
            header: { "idempotency-key": key },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
