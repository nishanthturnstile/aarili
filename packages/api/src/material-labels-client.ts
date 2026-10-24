import {
  type MaterialLabelIssue,
  type MaterialLabelSelection,
  materialLabelCandidatesSchema,
  materialLabelIssueResultSchema,
  materialLabelReviewSchema,
} from "@aarili/contracts/material-labels";
import { hc } from "hono/client";
import {
  authenticatedResult,
  clearOwnerState,
  isOwnerGeneration,
  OwnerRequestError,
} from "./client.js";
import type { createMaterialLabelRoutes } from "./material-labels.js";
export class MaterialLabelRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const client = () => hc<ReturnType<typeof createMaterialLabelRoutes>>("/api");
async function result(r: Response, generation: number) {
  const data: unknown = await r.json();
  if (!isOwnerGeneration(generation))
    throw new OwnerRequestError("UNAUTHENTICATED");
  if (r.status === 401 || r.status === 403) clearOwnerState();
  if (!r.ok) {
    const error = data as { error?: { code?: string } };
    throw new MaterialLabelRequestError(
      r.status,
      error.error?.code ?? "REQUEST_FAILED",
    );
  }
  if (materialLabelCandidatesSchema.safeParse(data).success) return data;
  const review = materialLabelReviewSchema.safeParse(data);
  const issue = materialLabelIssueResultSchema.safeParse(data);
  const version = review.success
    ? review.data.version
    : issue.success
      ? issue.data.status.version
      : null;
  if (!version || r.headers.get("ETag") !== `"v${version}"`)
    throw new OwnerRequestError("REQUEST_FAILED");
  return data;
}
export async function readMaterialLabel(
  shopId: string,
  selections: MaterialLabelSelection[],
) {
  return materialLabelReviewSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["material-labels"].review.$post(
          { param: { shopId }, json: { selections } },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
export async function createMaterialLabelIssue(
  shopId: string,
  input: MaterialLabelIssue,
  key: string,
  version: number,
) {
  return materialLabelIssueResultSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["material-labels"].$post(
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

export async function readMaterialLabelCandidates(
  shopId: string,
  before?: string,
) {
  return materialLabelCandidatesSchema.parse(
    await authenticatedResult(
      (signal) =>
        client().shops[":shopId"]["material-labels"].candidates.$post(
          { param: { shopId }, json: before ? { before } : {} },
          { init: { signal, cache: "no-store" } },
        ),
      result,
    ),
  );
}
