import {
  type QuoteIssueCommand,
  type QuoteResponseCommand,
  quoteIssueReadSchema,
  quoteIssueResultSchema,
  quoteIssueReviewSchema,
  quoteResponseResultSchema,
} from "@aarili/contracts/quotation-issues";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createQuotationIssueRoutes } from "./quotation-issues.js";
export class QuoteIssueRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const client = () => hc<ReturnType<typeof createQuotationIssueRoutes>>("/api");
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (r.status === 401 || r.status === 403) clearOwnerState();
  if (!r.ok) {
    const error = data as { error?: { code?: string } };
    throw new QuoteIssueRequestError(
      r.status,
      error.error?.code ?? "REQUEST_FAILED",
    );
  }
  const review = quoteIssueReviewSchema.safeParse(data);
  const issue = quoteIssueResultSchema.safeParse(data);
  const read = quoteIssueReadSchema.safeParse(data);
  const response = quoteResponseResultSchema.safeParse(data);
  const version = response.success
    ? response.data.responseVersion
    : read.success
      ? read.data.responseVersion
      : review.success
        ? review.data.version
        : issue.success
          ? issue.data.status.version
          : null;
  if (!version || r.headers.get("ETag") !== `"v${version}"`)
    throw new OwnerRequestError("REQUEST_FAILED");
  return data;
}
export async function reviewQuotationIssue(
  shopId: string,
  input: {
    proposalId: string;
    language: "en" | "ta";
    expiryDate: string;
    customerLabel: string;
  },
) {
  return quoteIssueReviewSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["quotation-issues"].review.$post(
          { param: { shopId }, json: input },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function createQuotationIssue(
  shopId: string,
  input: QuoteIssueCommand,
  key: string,
  version: number,
) {
  return quoteIssueResultSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["quotation-issues"].$post(
          {
            param: { shopId },
            json: input,
            header: { "idempotency-key": key, "if-match": `"v${version}"` },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}

export async function readQuotationIssue(
  shopId: string,
  docId: string,
  revision: number,
) {
  return quoteIssueReadSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["quotation-issues"].read.$post(
          { param: { shopId }, json: { docId, revision } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function createQuotationResponse(
  shopId: string,
  input: QuoteResponseCommand,
  key: string,
  version: number,
) {
  return quoteResponseResultSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["quotation-issues"].response.$post(
          {
            param: { shopId },
            json: input,
            header: { "idempotency-key": key, "if-match": `"v${version}"` },
          },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
